import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CleanCard from '../../components/ui/CleanCard';
import GoongMap from '../../components/GoongMap';
import rideService from '../../services/rideService';
import goongService from '../../services/goongService';
import { colors } from '../../theme/designTokens';

const DriverRideDetailsScreen = ({ navigation, route }) => {
  const { rideId } = route?.params || {};
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (rideId) {
      loadRideDetails();
      loadRideRequests();
    }
  }, [rideId]);

  const loadRideDetails = async () => {
    try {
      setLoading(true);
      console.log('📥 [DriverRideDetails] Loading ride details for rideId:', rideId);
      const response = await rideService.getRideDetails(rideId);
      console.log('📥 [DriverRideDetails] Ride details received:', JSON.stringify(response, null, 2));
      setRide(response);
      
      // Decode polyline if available
      const polyline = response.polyline || response.route?.polyline;
      if (polyline) {
        try {
          const decodedPolyline = goongService.decodePolyline(polyline);
          const formattedPolyline = decodedPolyline.map(point => [point.longitude, point.latitude]);
          setRoutePolyline(formattedPolyline);
        } catch (error) {
          console.error('❌ [DriverRideDetails] Error decoding polyline:', error);
        }
      }
    } catch (error) {
      console.error('❌ [DriverRideDetails] Error loading ride details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến xe. Vui lòng thử lại.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadRideRequests = async () => {
    try {
      const response = await rideService.getRideRequests(rideId);
      const requests = response?.data || response?.content || [];
      setRideRequests(requests);
    } catch (error) {
      console.error('❌ [DriverRideDetails] Error loading ride requests:', error);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Ngay lập tức';
    
    try {
      const date = new Date(dateTimeString);
      const now = new Date();
      const diffMs = date - now;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) return 'Đã qua';
      if (diffMins < 60) return `Trong ${diffMins} phút`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Trong ${diffHours} giờ`;
      
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return dateTimeString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 ₫';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(num);
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
        return '#FF9800';
      case 'ONGOING':
        return '#2196F3';
      case 'COMPLETED':
        return '#4CAF50';
      case 'CANCELLED':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
        return 'Đã lên lịch';
      case 'ONGOING':
        return 'Đang diễn ra';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status || 'Không xác định';
    }
  };

  const handleViewTracking = () => {
    if (!ride) return;
    
    navigation.navigate('DriverRideTracking', {
      rideId: ride.shared_ride_id || ride.sharedRideId || rideId,
      rideData: ride,
      status: ride.status,
    });
  };

  const handleCompleteRide = () => {
    if (!ride) {
      return;
    }

    const rideKey = ride.shared_ride_id || ride.sharedRideId || rideId;
    if (!rideKey) {
      Alert.alert('Lỗi', 'Không xác định được mã chuyến đi.');
      return;
    }

    Alert.alert(
      'Kết thúc chuyến đi',
      'Bạn có chắc chắn muốn hoàn thành chuyến đi này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              setCompleting(true);
              const response = await rideService.completeRide(rideKey);

              const actions = [];
              if (response) {
                actions.push({
                  text: 'Xem biên nhận',
                  onPress: () =>
                    navigation.navigate('DriverCompletion', {
                      completionData: response,
                    }),
                });
              }
              actions.push({ text: 'Đóng', style: 'cancel' });

              Alert.alert('Thành công', 'Chuyến đi đã được hoàn thành.', actions);

              await Promise.all([loadRideDetails(), loadRideRequests()]);
            } catch (error) {
              console.error('❌ [DriverRideDetails] Complete ride error:', error);
              Alert.alert(
                'Lỗi',
                error?.message || 'Không thể hoàn thành chuyến đi.'
              );
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>Không tìm thấy chuyến xe</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const startLocation = ride.start_location || ride.startLocation;
  const endLocation = ride.end_location || ride.endLocation;
  const scheduledTime = ride.scheduled_time || ride.scheduledTime;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết chuyến xe</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(ride.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
              {getStatusText(ride.status)}
            </Text>
          </View>
        </View>

        {/* Map */}
        {startLocation && endLocation && (
          <View style={styles.mapContainer}>
            <GoongMap
              style={styles.map}
              initialRegion={{
                latitude: (startLocation.lat || startLocation.latitude + endLocation.lat || endLocation.latitude) / 2,
                longitude: (startLocation.lng || startLocation.longitude + endLocation.lng || endLocation.longitude) / 2,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              polyline={routePolyline}
              markers={[
                {
                  coordinate: {
                    latitude: startLocation.lat || startLocation.latitude,
                    longitude: startLocation.lng || startLocation.longitude,
                  },
                  title: startLocation.name || 'Điểm bắt đầu',
                  pinColor: '#4CAF50',
                },
                {
                  coordinate: {
                    latitude: endLocation.lat || endLocation.latitude,
                    longitude: endLocation.lng || endLocation.longitude,
                  },
                  title: endLocation.name || 'Điểm kết thúc',
                  pinColor: '#F44336',
                },
              ]}
            />
          </View>
        )}

        {/* Route Information */}
        <CleanCard style={styles.card}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="radio-button-checked" size={20} color="#4CAF50" />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Điểm bắt đầu</Text>
              <Text style={styles.routeText}>
                {startLocation?.name || startLocation?.address || 'Không xác định'}
              </Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="location-on" size={20} color="#F44336" />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Điểm kết thúc</Text>
              <Text style={styles.routeText}>
                {endLocation?.name || endLocation?.address || 'Không xác định'}
              </Text>
            </View>
          </View>
        </CleanCard>

        {/* Ride Details */}
        <CleanCard style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin chuyến xe</Text>
          
          {scheduledTime && (
            <View style={styles.detailRow}>
              <Icon name="schedule" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Thời gian khởi hành</Text>
                <Text style={styles.detailValue}>{formatDateTime(scheduledTime)}</Text>
              </View>
            </View>
          )}

          {ride.estimated_distance && (
            <View style={styles.detailRow}>
              <Icon name="straighten" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Khoảng cách ước tính</Text>
                <Text style={styles.detailValue}>
                  {(ride.estimated_distance || ride.estimatedDistance || 0).toFixed(1)} km
                </Text>
              </View>
            </View>
          )}

          {ride.base_fare && (
            <View style={styles.detailRow}>
              <Icon name="attach-money" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Giá cơ bản</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(ride.base_fare || ride.baseFare)}
                </Text>
              </View>
            </View>
          )}
        </CleanCard>

        {/* Ride Requests */}
        {rideRequests.length > 0 && (
          <CleanCard style={styles.card}>
            <Text style={styles.cardTitle}>Yêu cầu tham gia ({rideRequests.length})</Text>
            {rideRequests.map((request, index) => (
              <View key={request.shared_ride_request_id || request.sharedRideRequestId || index} style={styles.requestItem}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestRiderName}>
                    {request.rider_name || request.riderName || 'Hành khách'}
                  </Text>
                  <Text style={styles.requestStatus}>
                    {getStatusText(request.status)}
                  </Text>
                </View>
                {request.total_fare && (
                  <Text style={styles.requestFare}>
                    {formatCurrency(request.total_fare || request.totalFare)}
                  </Text>
                )}
              </View>
            ))}
          </CleanCard>
        )}

        {/* Action Buttons */}
        {(ride.status === 'SCHEDULED' || ride.status === 'ONGOING') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.trackingButton]}
              onPress={handleViewTracking}
            >
              <Icon name="navigation" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>
                {ride.status === 'SCHEDULED'
                  ? 'Bắt đầu theo dõi'
                  : 'Xem theo dõi'}
              </Text>
            </TouchableOpacity>

            {ride.status === 'ONGOING' && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.completeButton,
                  completing && styles.disabledButton,
                ]}
                onPress={handleCompleteRide}
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="flag" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Kết thúc chuyến đi</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  statusContainer: {
    padding: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mapContainer: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
    marginLeft: 32,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailInfo: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  requestInfo: {
    flex: 1,
  },
  requestRiderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  requestStatus: {
    fontSize: 12,
    color: '#666',
  },
  requestFare: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtons: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  trackingButton: {
    backgroundColor: colors.primary,
  },
  completeButton: {
    backgroundColor: '#FF7043',
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DriverRideDetailsScreen;

