import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Switch,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import websocketService from '../../services/websocketService';
import fcmService from '../../services/fcmService';
import authService from '../../services/authService';
import vehicleService from '../../services/vehicleService';
import { locationStorageService } from '../../services/locationStorageService';
import { locationTrackingService } from '../../services/locationTrackingService';
import RideOfferModal from '../../components/RideOfferModal';

const { width, height } = Dimensions.get('window');

const DriverHomeScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Ride offer states
  const [currentOffer, setCurrentOffer] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [vehicleId, setVehicleId] = useState(null);
  
  const countdownInterval = useRef(null);

  useEffect(() => {
    initializeDriver();
    
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      websocketService.disconnect();
    };
  }, []);

  // Track last disconnect time to avoid immediate reconnect after ride completion
  const lastDisconnectTime = useRef(null);
  
  // Update disconnect time when WebSocket disconnects
  useEffect(() => {
    if (!websocketService.isConnected) {
      lastDisconnectTime.current = Date.now();
    }
  }, [websocketService.isConnected]);

  // Re-check WebSocket connection when screen focuses
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only reconnect if driver intentionally wants to be online AND WebSocket is disconnected
      // Don't reconnect immediately after completing a ride (user might want to go offline)
      if (isOnline && !websocketService.isConnected) {
        // Don't reconnect if we just disconnected (< 10 seconds ago) - likely post-ride cleanup
        const timeSinceDisconnect = lastDisconnectTime.current 
          ? Date.now() - lastDisconnectTime.current 
          : Infinity;
        
        if (timeSinceDisconnect < 10000) {
          return;
        }
        
        // Give user 3 seconds before auto-reconnecting (in case they just finished a ride)
        setTimeout(() => {
          if (isOnline && !websocketService.isConnected) {
            handleToggleOnline(true);
          }
        }, 3000);
      }
    });

    return unsubscribe;
  }, [navigation, isOnline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      websocketService.disconnect();
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, []);

  const initializeDriver = async () => {
    try {
      setLoading(true);
      
      // Get user info
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      
      // Get current location
      const locationData = await locationStorageService.getCurrentLocationWithAddress();
      if (locationData.location) {
        setCurrentLocation(locationData.location);
      }
      
      // Load driver vehicles
      await loadVehicles();
      
      // Initialize and register FCM for driver notifications
      try {
        await fcmService.initialize();
        await fcmService.registerToken();
      } catch (fcmError) {
      }
      
    } catch (error) {
      console.error('Error initializing driver:', error);
      Alert.alert('Lỗi', 'Không thể khởi tạo ứng dụng tài xế');
    } finally {
      setLoading(false);
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
        
        // Set the first vehicle as default
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

  const handleRideOffer = (offer) => {
    // Check if this is a tracking start signal
    if (offer.type === 'TRACKING_START') {
      handleTrackingStart(offer);
      return;
    }
    
    setCurrentOffer(offer);
    setShowOfferModal(true);
    
    // Start countdown timer
    if (offer.offerExpiresAt) {
      const expiresAt = new Date(offer.offerExpiresAt);
      const now = new Date();
      const timeLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      setOfferCountdown(timeLeft);
      
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      
      countdownInterval.current = setInterval(() => {
        setOfferCountdown((prev) => {
          if (prev <= 1) {
            // Offer expired
            setCurrentOffer(null);
            setShowOfferModal(false);
            clearInterval(countdownInterval.current);
            Alert.alert('Hết thời gian', 'Yêu cầu đã hết thời gian chờ');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleNotification = (notification) => {
    // LOG ALL NOTIFICATIONS FOR DEBUG
    console.log('🔔 [DriverHome] Received notification:', notification);
    console.log('🔔 [DriverHome] Notification type:', notification.type);
    console.log('🔔 [DriverHome] Current userType: driver');
    
    // Show notification as alert or toast
    if (notification.message) {
      Alert.alert(notification.title || 'Thông báo', notification.message);
    }
  };

  const handleTrackingStart = async (trackingSignal) => {
    try {
      // Chỉ điều hướng nếu chưa ở màn hình tracking
      navigation.navigate('DriverRideTracking', {
        rideId: trackingSignal.rideId,
        startTracking: true
      });
    } catch (error) {
      console.error('Failed to start tracking:', error);
    }
  };

  const handleToggleOnline = async (value) => {
    if (value && !currentLocation) {
      Alert.alert(
        'Cần vị trí',
        'Vui lòng bật GPS để có thể nhận chuyến đi',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      if (value) {
        // Going online - chỉ connect WebSocket để nhận offers
        setConnectionStatus('connecting');
        
        await websocketService.connectAsDriver(
          handleRideOffer,
          handleNotification
        );
        
        setConnectionStatus('connected');
        
      } else {
        // Going offline - disconnect WebSocket
        setConnectionStatus('disconnecting');
        
        websocketService.disconnect();
        
        setConnectionStatus('disconnected');
      }
      
      setIsOnline(value);
      
    } catch (error) {
      console.error('Error toggling online status:', error);
      setConnectionStatus('error');
      
      Alert.alert(
        'Lỗi kết nối',
        `Không thể ${value ? 'kết nối' : 'ngắt kết nối'}: ${error.message}`,
        [{ text: 'OK' }]
      );
      
      // Reset toggle if connection failed
      if (value) {
        setIsOnline(false);
      }
    }
  };

  const handleOfferResponse = (accepted, reason = null) => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    setShowOfferModal(false);
    setCurrentOffer(null);
    setOfferCountdown(0);
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Đã kết nối';
      case 'connecting': return 'Đang kết nối...';
      case 'error': return 'Lỗi kết nối';
      default: return 'Chưa kết nối';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang khởi tạo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={isOnline ? ['#4CAF50', '#2E7D32'] : ['#9E9E9E', '#616161']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Icon name="person" size={32} color="#fff" />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.fullName || 'Tài xế'}</Text>
              <Text style={styles.userRole}>Tài xế xe ôm</Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.createRideButton}
              onPress={() => navigation.navigate('CreateSharedRide')}
            >
              <Icon name="add-circle" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.vehicleButton}
              onPress={() => navigation.navigate('VehicleManagement')}
            >
              <Icon name="motorcycle" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => navigation.navigate('DriverTest')}
            >
              <Icon name="bug-report" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton}>
              <Icon name="settings" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Online/Offline Toggle */}
        <Animatable.View 
          animation={isOnline ? "pulse" : "fadeIn"} 
          style={styles.statusCard}
        >
          <View style={styles.statusHeader}>
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot, 
                { backgroundColor: isOnline ? '#4CAF50' : '#9E9E9E' }
              ]} />
              <Text style={styles.statusTitle}>
                {isOnline ? 'ĐANG ONLINE' : 'OFFLINE'}
              </Text>
            </View>
            
              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
              trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
              thumbColor={isOnline ? '#4CAF50' : '#9E9E9E'}
              />
            </View>
          
          <Text style={styles.statusDescription}>
            {isOnline 
              ? 'Bạn đang sẵn sàng nhận chuyến đi' 
              : 'Bật để bắt đầu nhận chuyến đi'
            }
          </Text>
        </Animatable.View>

        {/* Connection Status */}
        <View style={styles.connectionCard}>
          <View style={styles.connectionHeader}>
            <Icon name="wifi" size={20} color={getConnectionStatusColor()} />
            <Text style={[
              styles.connectionText,
              { color: getConnectionStatusColor() }
            ]}>
              {getConnectionStatusText()}
            </Text>
          </View>
          
          {connectionStatus === 'error' && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => setIsOnline(true)}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Current Location */}
        {currentLocation && (
          <View style={styles.locationCard}>
            <Icon name="my-location" size={20} color="#4CAF50" />
            <Text style={styles.locationText}>
              Vị trí hiện tại đã được xác định
            </Text>
          </View>
        )}

        {/* Stats Cards */}
          <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="directions-car" size={24} color="#2196F3" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Chuyến hôm nay</Text>
        </View>

          <View style={styles.statCard}>
            <Icon name="star" size={24} color="#FF9800" />
            <Text style={styles.statNumber}>5.0</Text>
            <Text style={styles.statLabel}>Đánh giá</Text>
                  </View>
                  
          <View style={styles.statCard}>
            <Icon name="account-balance-wallet" size={24} color="#4CAF50" />
            <Text style={styles.statNumber}>0đ</Text>
            <Text style={styles.statLabel}>Thu nhập</Text>
                    </View>
                  </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('AvailableRequests')}
          >
            <Icon name="inbox" size={24} color="#9C27B0" />
            <Text style={styles.actionText}>Yêu cầu chờ</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <Icon name="history" size={24} color="#666" />
            <Text style={styles.actionText}>Lịch sử</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Earnings')}
          >
            <Icon name="trending-up" size={24} color="#666" />
            <Text style={styles.actionText}>Thu nhập</Text>
          </TouchableOpacity>
        </View>
        </View>

      {/* Ride Offer Modal */}
      {showOfferModal && currentOffer && (
        <>
          <RideOfferModal
            visible={showOfferModal}
            offer={currentOffer}
            countdown={offerCountdown}
            onAccept={() => handleOfferResponse(true)}
            onReject={(reason) => handleOfferResponse(false, reason)}
            onClose={() => handleOfferResponse(false)}
            vehicleId={vehicleId}
            navigation={navigation}
            currentLocation={currentLocation}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  createRideButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderRadius: 20,
    padding: 8,
    marginRight: 8,
  },
  vehicleButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    borderRadius: 20,
    padding: 8,
    marginRight: 8,
  },
  testButton: {
    padding: 8,
    marginRight: 8,
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusDescription: {
    fontSize: 14,
    color: '#666',
  },
  connectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F44336',
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default DriverHomeScreen;
