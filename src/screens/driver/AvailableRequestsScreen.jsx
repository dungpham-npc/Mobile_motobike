import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import rideService from '../../services/rideService';
import locationService from '../../services/LocationService';
import vehicleService from '../../services/vehicleService';

const AvailableRequestsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [vehicleId, setVehicleId] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  const initializeScreen = async () => {
    await Promise.all([
      loadAvailableRequests(),
      getCurrentLocation(),
      loadVehicles()
    ]);
  };

  const getCurrentLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      const response = await vehicleService.getDriverVehicles({
        page: 0,
        size: 50,
        sortBy: "createdAt",
        sortDir: "desc",
      });

      if (response && response.data) {
        const formattedVehicles = vehicleService.formatVehicles(response.data);
        
        if (formattedVehicles && formattedVehicles.length > 0) {
          const firstVehicle = formattedVehicles[0];
          const vehicleId = firstVehicle.id || firstVehicle.vehicleId;
          setVehicleId(vehicleId);
        }
      }
    } catch (error) {
      console.error('Failed to load vehicles:', error);
    }
  };

  const loadAvailableRequests = async () => {
    try {
      setLoading(true);
      const response = await rideService.getBroadcastingRequests();
      
      console.log('📋 [AvailableRequests] Raw response:', response);
      
      // Parse response
      const requests = Array.isArray(response) 
        ? response 
        : (response?.data || response?.content || response?.items || []);
      
      console.log('📋 [AvailableRequests] Parsed requests:', requests);
      
      // Filter pending/searching requests only
      const filteredRequests = requests.filter(req => 
        req.status === 'PENDING' || req.status === 'SEARCHING' || req.status === 'BROADCASTING'
      );

      console.log('📋 [AvailableRequests] Filtered requests:', filteredRequests.length);
      setAvailableRequests(filteredRequests);
    } catch (error) {
      console.error('Error loading available requests:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách yêu cầu');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAvailableRequests();
  }, []);

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    if (!lat1 || !lng1 || !lat2 || !lng2) return null;
    try {
      return locationService.calculateDistance(lat1, lng1, lat2, lng2);
    } catch {
      return null;
    }
  };

  const handleAcceptRequest = async (request) => {
    try {
      if (!vehicleId) {
        Alert.alert('Lỗi', 'Vui lòng thêm phương tiện trước khi nhận cuốc');
        return;
      }

      const pickupLat = request.pickup_location?.lat;
      const pickupLng = request.pickup_location?.lng;
      const pickupName = request.pickup_location?.name || request.pickup_location?.address;
      const dropoffName = request.dropoff_location?.name || request.dropoff_location?.address;

      Alert.alert(
        'Xác nhận nhận cuốc',
        `Điểm đón: ${pickupName || 'N/A'}\nĐiểm đến: ${dropoffName || 'N/A'}\n\nBạn có chắc chắn muốn nhận cuốc này không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Nhận cuốc',
            onPress: async () => {
              try {
                setLoading(true);
                
                // Accept broadcast request
                const response = await rideService.acceptBroadcastRequest(
                  request.shared_ride_request_id || request.requestId,
                  vehicleId,
                  currentLocation,
                  null // startLocationId - will use currentLocation coordinates
                );
                
                Alert.alert(
                  'Thành công', 
                  'Đã nhận cuốc! Bắt đầu di chuyển đến điểm đón.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Navigate to ride tracking
                        navigation.replace('DriverRideTracking', {
                          rideId: response.shared_ride_id || response.rideId,
                          startTracking: true,
                          rideData: response,
                          status: response.status || 'CONFIRMED'
                        });
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Error accepting request:', error);
                Alert.alert('Lỗi', error.message || 'Không thể nhận cuốc. Có thể đã có tài xế khác nhận rồi.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleAcceptRequest:', error);
    }
  };

  const renderRequestItem = ({ item }) => {
    const pickupLat = item.pickup_location?.lat;
    const pickupLng = item.pickup_location?.lng;
    const dropoffLat = item.dropoff_location?.lat;
    const dropoffLng = item.dropoff_location?.lng;
    
    // Calculate distance from driver to pickup point
    const distanceToPickup = currentLocation && pickupLat && pickupLng
      ? calculateDistance(currentLocation.latitude, currentLocation.longitude, pickupLat, pickupLng)
      : null;
    
    const fareAmount = item.fare_amount || item.fareAmount || 0;
    const createdAt = item.created_at || item.createdAt;

    return (
      <Animatable.View animation="fadeInUp" duration={600} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.riderInfo}>
            <View style={styles.riderAvatar}>
              <Icon name="person" size={24} color="#2196F3" />
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>
                {item.rider_name || 'Hành khách'}
              </Text>
              {createdAt && (
                <Text style={styles.timeText}>
                  {new Date(createdAt).toLocaleString('vi-VN')}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.fareInfo}>
            <Text style={styles.fareAmount}>
              {fareAmount.toLocaleString('vi-VN')}đ
            </Text>
          </View>
        </View>

        <View style={styles.routeInfo}>
          <View style={styles.routeRow}>
            <Icon name="radio-button-checked" size={18} color="#4CAF50" />
            <Text style={styles.locationText} numberOfLines={2}>
              {item.pickup_location?.name || item.pickup_location?.address || 'Điểm đón'}
            </Text>
          </View>
          
          <View style={styles.routeDivider} />
          
          <View style={styles.routeRow}>
            <Icon name="location-on" size={18} color="#F44336" />
            <Text style={styles.locationText} numberOfLines={2}>
              {item.dropoff_location?.name || item.dropoff_location?.address || 'Điểm đến'}
            </Text>
          </View>
        </View>

        <View style={styles.requestFooter}>
          <View style={styles.requestMetadata}>
            {distanceToPickup !== null && (
              <View style={styles.metaItem}>
                <Icon name="near-me" size={16} color="#666" />
                <Text style={styles.metaText}>
                  Cách {distanceToPickup < 1 
                    ? `${Math.round(distanceToPickup * 1000)}m` 
                    : `${distanceToPickup.toFixed(1)}km`}
                </Text>
              </View>
            )}
            
            {item.special_requests && item.special_requests !== 'N/A' && (
              <View style={styles.metaItem}>
                <Icon name="info-outline" size={16} color="#FF9800" />
                <Text style={styles.metaText} numberOfLines={1}>
                  {item.special_requests}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(item)}
          >
            <Icon name="check" size={18} color="#fff" />
            <Text style={styles.acceptButtonText}>Nhận cuốc</Text>
          </TouchableOpacity>
        </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yêu cầu đang chờ</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info-outline" size={20} color="#2196F3" />
        <Text style={styles.infoText}>
          Các yêu cầu chưa được ghép tự động, sẵn sàng để bạn nhận
        </Text>
      </View>

      {/* Requests List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang tải yêu cầu...</Text>
        </View>
      ) : availableRequests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="inbox" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Chưa có yêu cầu nào</Text>
          <Text style={styles.emptySubtext}>
            Vui lòng thử lại sau
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={handleRefresh}
          >
            <Text style={styles.retryButtonText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={availableRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item, index) => `request-${item.shared_ride_request_id || item.requestId || index}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4CAF50']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    gap: 16,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  fareInfo: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fareAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  routeInfo: {
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  routeDivider: {
    width: 2,
    height: 20,
    backgroundColor: '#ddd',
    marginLeft: 8,
    marginVertical: 4,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  requestMetadata: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AvailableRequestsScreen;

