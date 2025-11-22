import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import websocketService from '../../services/websocketService';
import authService from '../../services/authService';
import rideService from '../../services/rideService';
import activeRideService from '../../services/activeRideService';

const RiderMatchingScreen = ({ navigation, route }) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [matchingStatus, setMatchingStatus] = useState('searching'); // searching, matched, accepted, cancelled, no_drivers
  const [currentMatch, setCurrentMatch] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [rideRequest, setRideRequest] = useState(null);
  const [user, setUser] = useState(null);
  const [matchingTimer, setMatchingTimer] = useState(0); // Seconds elapsed
  
  const animationRef = useRef(null);
  const timerInterval = useRef(null);
  const matchingStartTime = useRef(Date.now());
  const matchingStatusRef = useRef('searching');
  const rideRequestRef = useRef(null);

  // Get ride request data from navigation params
  useEffect(() => {
    const requestData = route.params?.rideRequest;
    if (requestData) {
      setRideRequest(requestData);
      rideRequestRef.current = requestData;
    }
  }, [route.params]);
  
  // Update refs when state changes
  useEffect(() => {
    matchingStatusRef.current = matchingStatus;
  }, [matchingStatus]);
  
  useEffect(() => {
    rideRequestRef.current = rideRequest;
  }, [rideRequest]);

  // Initialize rider connection
  useEffect(() => {
    const initializeRider = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        setUser(currentUser);

        // Connect to WebSocket as rider
        setConnectionStatus('connecting');
        await websocketService.connectAsRider(
          handleRideMatching,
          handleNotification
        );
        setConnectionStatus('connected');

      } catch (error) {
        console.error('Error initializing rider:', error);
        setConnectionStatus('error');
        Alert.alert(
          'Lỗi kết nối',
          'Không thể kết nối đến server. Vui lòng thử lại.',
          [
            { text: 'Thử lại', onPress: initializeRider },
            { text: 'Quay lại', onPress: () => navigation.goBack() }
          ]
        );
      }
    };

    initializeRider();

    // Start matching timer (for display only, no timeout)
    matchingStartTime.current = Date.now();
    timerInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - matchingStartTime.current) / 1000);
      setMatchingTimer(elapsed);
    }, 1000);

    // Cleanup on unmount
    return () => {
      // DON'T disconnect WebSocket - let RideTrackingScreen reuse the connection
      // websocketService.disconnect();
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
      
      // Cancel pending request if user backs out during searching
      // (Don't cancel if already matched/accepted)
      if (matchingStatusRef.current === 'searching') {
        const currentRequest = rideRequestRef.current;
        const requestId = currentRequest?.shared_ride_request_id 
          || currentRequest?.sharedRideRequestId
          || currentRequest?.requestId 
          || currentRequest?.ride_request_id;
          
        if (requestId) {
          console.log('🚫 [RiderMatching] Auto-cancelling request on unmount:', requestId);
          rideService.cancelRequest(requestId)
            .then(() => {
              console.log('✅ [RiderMatching] Request auto-cancelled successfully');
              activeRideService.clearActiveRide();
            })
            .catch(err => {
              console.error('❌ [RiderMatching] Auto-cancel error:', err);
            });
        }
      }
    };
  }, []);

  const handleRideMatching = (matchingData) => {
    
    try {
      // Check both 'type' field and 'status' field for compatibility
      const updateType = matchingData.type || matchingData.status;
      
      switch (updateType) {
        case 'DRIVER_MATCHED':
          setMatchingStatus('matched');
          setCurrentMatch(matchingData);
          addNotification('🚗 Đã tìm thấy tài xế!', 'success');
          break;
          
        case 'RIDE_ACCEPTED':
        case 'ACCEPTED':
          setMatchingStatus('accepted');
          setCurrentMatch(matchingData);
          addNotification('✅ Tài xế đã chấp nhận chuyến đi!', 'success');
          
          // Navigate to ride tracking after 2 seconds
          setTimeout(() => {
            navigation.replace('RideTracking', {
              rideId: matchingData.rideId,
              requestId: matchingData.requestId,
              driverInfo: matchingData,
              isRider: true,
              status: 'CONFIRMED'
            });
          }, 2000);
          break;
          
        case 'RIDE_REJECTED':
          setMatchingStatus('searching');
          setCurrentMatch(null);
          addNotification('❌ Tài xế từ chối. Đang tìm tài xế khác...', 'warning');
          break;
          
        case 'NO_DRIVERS_AVAILABLE':
        case 'MATCHING_TIMEOUT':
          setMatchingStatus('no_drivers');
          addNotification('⏱️ Tất cả tài xế đang bận', 'warning');
          // Show alert with option to go home or wait
          Alert.alert(
            'Không tìm thấy tài xế',
            'Tất cả tài xế đang bận. Vui lòng thử lại sau.',
            [
              {
                text: 'Về trang chủ',
                onPress: () => navigation.navigate('Home')
              }
            ]
          );
          break;
          
        case 'RIDE_CANCELLED':
          setMatchingStatus('cancelled');
          addNotification('🚫 Chuyến đi đã bị hủy.', 'error');
          break;
          
        default:
          // Fallback: if we have rideId and status, treat as accepted
          if (matchingData.rideId && matchingData.status === 'ACCEPTED') {
            setMatchingStatus('accepted');
            setCurrentMatch(matchingData);
            addNotification('✅ Tài xế đã chấp nhận chuyến đi!', 'success');
            
            setTimeout(() => {
              navigation.replace('RideTracking', {
                rideId: matchingData.rideId,
                requestId: matchingData.requestId,
                driverInfo: matchingData,
                isRider: true,
                status: 'CONFIRMED'
              });
            }, 2000);
          } else {
            addNotification(`📱 ${matchingData.message || 'Cập nhật trạng thái'}`, 'info');
          }
      }
    } catch (error) {
      console.error('Error handling ride matching:', error);
    }
  };

  const handleNotification = (notification) => {
    addNotification(notification.message || 'Thông báo mới', 'info');
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Hủy chuyến đi',
      'Bạn có chắc chắn muốn hủy chuyến đi này không?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy chuyến',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get requestId from various possible sources
              const requestId = rideRequest?.shared_ride_request_id 
                || rideRequest?.sharedRideRequestId
                || rideRequest?.requestId 
                || rideRequest?.ride_request_id
                || route.params?.requestId;

              console.log('🚫 [RiderMatching] Cancelling request:', {
                requestId,
                rideRequest
              });

              if (requestId) {
                // Call cancel API
                await rideService.cancelRequest(requestId);
                console.log('✅ [RiderMatching] Request cancelled successfully');
                
                // Clear active ride from storage
                await activeRideService.clearActiveRide();
              } else {
                console.warn('⚠️ [RiderMatching] No requestId found, skipping API call');
              }

              // Update UI
              setMatchingStatus('cancelled');
              addNotification('🚫 Đã hủy chuyến đi', 'success');
              
              // Navigate back after a short delay
              setTimeout(() => {
                navigation.navigate('Home');
              }, 1000);
            } catch (error) {
              console.error('❌ [RiderMatching] Cancel error:', error);
              Alert.alert(
                'Lỗi',
                'Không thể hủy chuyến đi. Vui lòng thử lại.',
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const getStatusColor = () => {
    switch (matchingStatus) {
      case 'searching': return '#FF9800';
      case 'matched': return '#2196F3';
      case 'accepted': return '#4CAF50';
      case 'cancelled': return '#F44336';
      case 'no_drivers': return '#9C27B0';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (matchingStatus) {
      case 'searching': return 'Đang tìm tài xế...';
      case 'matched': return 'Đã tìm thấy tài xế!';
      case 'accepted': return 'Tài xế đã chấp nhận!';
      case 'cancelled': return 'Chuyến đi đã hủy';
      case 'no_drivers': return 'Tất cả tài xế đang bận';
      default: return 'Đang xử lý...';
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (matchingStatus) {
      case 'searching': return 'search';
      case 'matched': return 'person-pin';
      case 'accepted': return 'check-circle';
      case 'cancelled': return 'cancel';
      default: return 'help';
    }
  };

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
        <Text style={styles.headerTitle}>Tìm tài xế</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <Animatable.View
          ref={animationRef}
          animation={matchingStatus === 'searching' ? 'pulse' : 'fadeIn'}
          iterationCount={matchingStatus === 'searching' ? 'infinite' : 1}
          style={[styles.statusCard, { borderColor: getStatusColor() }]}
        >
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: getStatusColor() }]}>
              <Icon name={getStatusIcon()} size={32} color="#fff" />
            </View>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>

          {matchingStatus === 'searching' && (
            <View style={styles.searchingIndicator}>
              <ActivityIndicator size="large" color={getStatusColor()} />
              <Text style={styles.searchingText}>
                Đang tìm kiếm tài xế gần bạn...
              </Text>
              <Text style={styles.timerText}>
                Thời gian chờ: {formatTime(matchingTimer)}
              </Text>
            </View>
          )}
          
          {matchingStatus === 'no_drivers' && (
            <View style={styles.noDriversIndicator}>
              <Icon name="error-outline" size={48} color="#9C27B0" />
              <Text style={styles.noDriversText}>
                Tất cả tài xế đang bận
              </Text>
              <Text style={styles.noDriversSubtext}>
                Vui lòng thử lại sau hoặc tìm kiếm thủ công
              </Text>
            </View>
          )}
        </Animatable.View>

        {/* Ride Request Info */}
        {rideRequest && (
          <View style={styles.rideInfoCard}>
            <Text style={styles.cardTitle}>Thông tin chuyến đi</Text>
            
            <View style={styles.locationRow}>
              <Icon name="my-location" size={20} color="#4CAF50" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Điểm đón</Text>
                <Text style={styles.locationText}>
                  {rideRequest.pickupAddress || 'Vị trí hiện tại'}
                </Text>
              </View>
            </View>

            <View style={styles.locationRow}>
              <Icon name="place" size={20} color="#F44336" />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Điểm đến</Text>
                <Text style={styles.locationText}>
                  {rideRequest.dropoffAddress || 'Điểm đến'}
                </Text>
              </View>
            </View>

            {/*rideRequest.fare && (
              <View style={styles.fareRow}>
                {
                }
                <Icon name="attach-money" size={20} color="#FF9800" />
                <Text style={styles.fareText}>
                  {rideRequest.fare.total.toLocaleString() || '0'} VNĐ
                </Text>
              </View>
            )*/}
          </View>
        )}

        {/* Driver Info (when matched) */}
        {currentMatch && currentMatch.driver && (
          <View style={styles.driverCard}>
            <Text style={styles.cardTitle}>Thông tin tài xế</Text>
            
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                <Icon name="person" size={32} color="#fff" />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>
                  {currentMatch.driver.name || 'Tài xế'}
                </Text>
                <Text style={styles.driverPhone}>
                  {currentMatch.driver.phone || 'Đang cập nhật...'}
                </Text>
                <View style={styles.ratingRow}>
                  <Icon name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {currentMatch.driver.rating || '5.0'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Notifications */}
        <View style={styles.notificationsCard}>
          <Text style={styles.cardTitle}>Cập nhật trạng thái</Text>
          {notifications.length === 0 ? (
            <Text style={styles.noNotifications}>Chưa có cập nhật nào</Text>
          ) : (
            notifications.map((notification) => (
              <View key={notification.id} style={styles.notificationItem}>
                <Text style={styles.notificationTime}>
                  {notification.timestamp}
                </Text>
                <Text style={[
                  styles.notificationText,
                  { color: getNotificationColor(notification.type) }
                ]}>
                  {notification.message}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Cancel Button */}
        {(matchingStatus === 'searching' || matchingStatus === 'matched') && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRide}
          >
            <Icon name="cancel" size={20} color="#fff" />
            <Text style={styles.cancelButtonText}>Hủy chuyến đi</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getNotificationColor = (type) => {
  switch (type) {
    case 'success': return '#4CAF50';
    case 'warning': return '#FF9800';
    case 'error': return '#F44336';
    default: return '#2196F3';
  }
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  statusHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  searchingIndicator: {
    alignItems: 'center',
  },
  searchingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  timerText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
    textAlign: 'center',
  },
  manualModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  manualModeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9C27B0',
  },
  noDriversIndicator: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noDriversText: {
    marginTop: 12,
    fontSize: 16,
    color: '#9C27B0',
    textAlign: 'center',
    fontWeight: '600',
  },
  noDriversSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  rideInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  fareText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9800',
    marginLeft: 8,
  },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDetails: {
    marginLeft: 12,
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  driverPhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  notificationsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  noNotifications: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  notificationItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  notificationTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  notificationText: {
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RiderMatchingScreen;

