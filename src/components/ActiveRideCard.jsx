import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import activeRideService from '../services/activeRideService';
import rideService from '../services/rideService';
import authService from '../services/authService';

const ActiveRideCard = ({ navigation }) => {
  const [activeRide, setActiveRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadActiveRide();
    
    // Refresh when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      loadActiveRide();
    });
    
    // Refresh when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        loadActiveRide();
      }
    });
    
    return () => {
      unsubscribe();
      subscription?.remove();
    };
  }, [navigation]);

  const loadActiveRide = async () => {
    try {
      setLoading(true);
      
      // First try to get from AsyncStorage (for backward compatibility)
      let ride = await activeRideService.getActiveRide();
      
      // Validate requestId if ride exists in storage
      if (ride && (!ride.requestId || ride.requestId === 'undefined' || ride.requestId === 'null' || ride.requestId === '{requestId}')) {
        console.warn('⚠️ [ActiveRideCard] Invalid requestId in stored ride, clearing...');
        await activeRideService.clearActiveRide();
        ride = null;
      }
      
      // Always fetch from backend API to get the newest ONGOING request (only if we have riderId)
      try {
        const currentUser = authService.getCurrentUser();
        // Use userId from various possible locations (user_id is the standard field)
        const riderId = currentUser?.user?.user_id || currentUser?.user?.userId || currentUser?.userId || currentUser?.user?.id || currentUser?.id;
        
        console.log('🔍 [ActiveRideCard] Current user:', currentUser);
        console.log('🔍 [ActiveRideCard] User ID (riderId):', riderId);
        
        if (riderId) {
          // First, try to fetch ONGOING requests (highest priority)
          console.log('📥 [ActiveRideCard] Fetching ONGOING requests from backend for rider:', riderId);
          let response = await rideService.getRiderRequests(riderId, 'ONGOING', 0, 1);
          console.log('📥 [ActiveRideCard] ONGOING response:', JSON.stringify(response, null, 2));
          
          // Handle different response structures
          let requests = [];
          if (Array.isArray(response)) {
            requests = response;
          } else if (response?.data && Array.isArray(response.data)) {
            requests = response.data;
          } else if (response?.content && Array.isArray(response.content)) {
            requests = response.content;
          } else if (response?.pagination?.data && Array.isArray(response.pagination.data)) {
            requests = response.pagination.data;
          }
          
          console.log('📥 [ActiveRideCard] ONGOING requests extracted:', requests.length);
          
          // If no ONGOING request, try CONFIRMED requests
          if (requests.length === 0) {
            console.log('📥 [ActiveRideCard] No ONGOING request, fetching CONFIRMED requests...');
            response = await rideService.getRiderRequests(riderId, 'CONFIRMED', 0, 1);
            console.log('📥 [ActiveRideCard] CONFIRMED response:', JSON.stringify(response, null, 2));
            
            // Handle different response structures
            if (Array.isArray(response)) {
              requests = response;
            } else if (response?.data && Array.isArray(response.data)) {
              requests = response.data;
            } else if (response?.content && Array.isArray(response.content)) {
              requests = response.content;
            } else if (response?.pagination?.data && Array.isArray(response.pagination.data)) {
              requests = response.pagination.data;
            }
            
            console.log('📥 [ActiveRideCard] CONFIRMED requests extracted:', requests.length);
          }
          
          // Get the newest request (first one, sorted by createdAt desc)
          const activeRequest = requests.length > 0 ? requests[0] : null;
          
          if (activeRequest) {
            console.log('✅ [ActiveRideCard] Found active request:', JSON.stringify(activeRequest, null, 2));
            
            // Extract requestId and validate it
            const requestId = activeRequest.shared_ride_request_id || activeRequest.sharedRideRequestId || activeRequest.requestId || activeRequest.id;
            
            console.log('🔍 [ActiveRideCard] Extracted requestId:', requestId);
            
            // Validate requestId before saving
            if (!requestId || requestId === 'undefined' || requestId === 'null' || requestId === '{requestId}') {
              console.warn('⚠️ [ActiveRideCard] Invalid requestId from backend, skipping save');
              // Clear any old invalid data
              await activeRideService.clearActiveRide();
              ride = null;
            } else {
              // Transform backend response to activeRide format
              ride = {
                rideId: activeRequest.shared_ride_id || activeRequest.sharedRideId || activeRequest.rideId,
                requestId: requestId,
                status: activeRequest.status || activeRequest.requestStatus || 'ONGOING',
                userType: 'rider',
                driverInfo: {
                  driverName: activeRequest.driver_name || activeRequest.driverName || 'Tài xế',
                  driverRating: activeRequest.driver_rating || activeRequest.driverRating,
                  vehicleModel: activeRequest.vehicle_model || activeRequest.vehicleModel,
                  vehiclePlate: activeRequest.vehicle_plate || activeRequest.vehiclePlate,
                  totalFare: activeRequest.total_fare?.amount || activeRequest.totalFare?.amount || activeRequest.totalFare || 0,
                },
                pickupLocation: {
                  name: activeRequest.pickup_location?.name || activeRequest.pickupLocationName || 'Điểm đón',
                  lat: activeRequest.pickup_location?.lat || activeRequest.pickupLat,
                  lng: activeRequest.pickup_location?.lng || activeRequest.pickupLng,
                },
                dropoffLocation: {
                  name: activeRequest.dropoff_location?.name || activeRequest.dropoffLocationName || 'Điểm đến',
                  lat: activeRequest.dropoff_location?.lat || activeRequest.dropoffLat,
                  lng: activeRequest.dropoff_location?.lng || activeRequest.dropoffLng,
                },
                totalFare: activeRequest.total_fare?.amount || activeRequest.totalFare?.amount || activeRequest.totalFare || 0,
                timestamp: Date.now(),
              };
              
              console.log('💾 [ActiveRideCard] Saving active ride to storage:', ride);
              
              // Save to AsyncStorage for future quick access
              await activeRideService.saveActiveRide(ride);
            }
          } else {
            // No active request found, clear old data
            console.log('📭 [ActiveRideCard] No active request found, clearing old data');
            await activeRideService.clearActiveRide();
            ride = null;
          }
        } else {
          console.warn('⚠️ [ActiveRideCard] No riderId found, cannot fetch active requests');
        }
      } catch (apiError) {
        console.error('❌ [ActiveRideCard] Failed to fetch from API:', apiError);
        console.error('❌ [ActiveRideCard] Error details:', JSON.stringify(apiError, null, 2));
        // If API fails and we have cached data, use it; otherwise clear
        if (!ride) {
          await activeRideService.clearActiveRide();
        }
      }
      
      console.log('🎯 [ActiveRideCard] Setting activeRide state:', ride);
      setActiveRide(ride);
    } catch (error) {
      console.error('❌ [ActiveRideCard] Failed to load active ride:', error);
      setActiveRide(null);
    } finally {
      setLoading(false);
    }
  };
  
  // Debug: Log when activeRide changes
  useEffect(() => {
    console.log('🔄 [ActiveRideCard] activeRide state changed:', activeRide);
  }, [activeRide]);

  const handleResumeRide = () => {
    if (!activeRide) return;

    // Validate requestId before navigating
    if (!activeRide.requestId || activeRide.requestId === 'undefined' || activeRide.requestId === 'null' || activeRide.requestId === '{requestId}') {
      console.warn('⚠️ [ActiveRideCard] Invalid requestId, clearing active ride');
      Alert.alert(
        'Lỗi',
        'Thông tin chuyến đi không hợp lệ. Vui lòng thử lại.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await activeRideService.clearActiveRide();
              setActiveRide(null);
            }
          }
        ]
      );
      return;
    }

    const params = {
      rideId: activeRide.rideId,
      requestId: activeRide.requestId,
      driverInfo: activeRide.driverInfo,
      status: activeRide.status,
      rideData: activeRide,
      startTracking: false
    };

    if (activeRide.userType === 'driver') {
      navigation.navigate('DriverMain', {
        screen: 'DriverRideTracking',
        params,
      });
      return;
    }

    navigation.navigate('RideTracking', params);
  };

  const handleViewDetails = () => {
    if (!activeRide) return;
    
    if (activeRide.userType === 'driver') {
      // Navigate to driver ride details
      navigation.navigate('DriverMain', {
        screen: 'DriverRideDetails',
        params: { rideId: activeRide.rideId },
      });
    } else {
      // Validate requestId before navigating
      if (!activeRide.requestId || activeRide.requestId === 'undefined' || activeRide.requestId === 'null' || activeRide.requestId === '{requestId}') {
        console.warn('⚠️ [ActiveRideCard] Invalid requestId, clearing active ride');
        Alert.alert(
          'Lỗi',
          'Thông tin chuyến đi không hợp lệ. Vui lòng thử lại.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await activeRideService.clearActiveRide();
                setActiveRide(null);
              }
            }
          ]
        );
        return;
      }
      
      // Navigate to ride tracking screen (which shows details)
      navigation.navigate('RideTracking', {
        rideId: activeRide.rideId,
        requestId: activeRide.requestId,
        driverInfo: activeRide.driverInfo,
        status: activeRide.status,
      });
    }
  };

  const handleCancelRide = () => {
    if (!activeRide) return;

    const isDriver = activeRide.userType === 'driver';

    Alert.alert(
      isDriver ? 'Hủy chuyến xe' : 'Hủy chuyến đi',
      isDriver
        ? 'Bạn có chắc chắn muốn hủy chuyến xe này?'
        : 'Bạn có chắc chắn muốn hủy chuyến đi đang diễn ra?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);

              if (isDriver) {
                if (!activeRide.rideId) {
                  throw new Error('Không tìm thấy mã chuyến xe để hủy.');
                }
                await rideService.cancelRide(activeRide.rideId);
              } else if (activeRide.requestId) {
                await rideService.cancelRequest(activeRide.requestId);
              } else {
                throw new Error('Không tìm thấy mã yêu cầu để hủy.');
              }

              await activeRideService.clearActiveRide();
              setActiveRide(null);
              Alert.alert('Thành công', isDriver ? 'Chuyến xe đã được hủy.' : 'Yêu cầu đã được hủy.');
            } catch (error) {
              console.error('Cancel ride error:', error);
              Alert.alert('Lỗi', error?.message || 'Không thể hủy chuyến. Vui lòng thử lại.');
            } finally {
              setCancelling(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return null;
  }

  if (!activeRide) {
    return null;
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'ONGOING':
        return 'Đang diễn ra';
      case 'PENDING':
        return 'Đang chờ';
      default:
        return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return '#4CAF50';
      case 'ONGOING':
        return '#2196F3';
      case 'PENDING':
        return '#FF9800';
      default:
        return '#666';
    }
  };

  return (
    <Animatable.View 
      animation="fadeInUp" 
      delay={200}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(activeRide.status) }]} />
          <Text style={styles.statusText}>
            {getStatusText(activeRide.status)}
          </Text>
        </View>
        <Text style={styles.rideId}>Chuyến #{activeRide.rideId}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.locationRow}>
          <Icon name="radio-button-checked" size={16} color="#4CAF50" />
          <Text style={styles.locationText} numberOfLines={1}>
            {activeRide.pickupLocation?.name || 'Điểm đón'}
          </Text>
        </View>
        
        <View style={styles.locationRow}>
          <Icon name="location-on" size={16} color="#F44336" />
          <Text style={styles.locationText} numberOfLines={1}>
            {activeRide.dropoffLocation?.name || 'Điểm đến'}
          </Text>
        </View>

        {activeRide.userType === 'rider' && activeRide.driverInfo && (
          <View style={styles.driverRow}>
            <Icon name="person" size={16} color="#666" />
            <Text style={styles.driverText}>
              Tài xế: {activeRide.driverInfo.driverName}
            </Text>
          </View>
        )}

        {activeRide.userType === 'driver' && activeRide.riderName && (
          <View style={styles.driverRow}>
            <Icon name="person" size={16} color="#666" />
            <Text style={styles.driverText}>
              Khách: {activeRide.riderName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.resumeButton}
          onPress={handleResumeRide}
        >
          <Icon name="play-arrow" size={20} color="#fff" />
          <Text style={styles.resumeText}>Theo dõi</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={handleViewDetails}
        >
          <Icon name="info-outline" size={18} color="#2196F3" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
          onPress={handleCancelRide}
          disabled={cancelling}
        >
          <Icon name="close" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#333',
  },
  rideId: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  content: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  driverText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  resumeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  detailsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
});

export default ActiveRideCard;
