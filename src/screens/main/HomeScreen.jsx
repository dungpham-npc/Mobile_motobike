// src/screens/home/HomeScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';

import ModernButton from '../../components/ModernButton.jsx';
import ActiveRideCard from '../../components/ActiveRideCard.jsx';

import locationService from '../../services/LocationService';
import rideService from '../../services/rideService';
import authService from '../../services/authService';
import permissionService from '../../services/permissionService';
import websocketService from '../../services/websocketService';
import fcmService from '../../services/fcmService';
import paymentService from '../../services/paymentService';
import { locationStorageService } from '../../services/locationStorageService';
import activeRideService from '../../services/activeRideService';
import notificationService from '../../services/notificationService';

const HomeScreen = ({ navigation }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nearbyRides, setNearbyRides] = useState([]);
  const [loadingRides, setLoadingRides] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');
  const [activeTab, setActiveTab] = useState('book'); // 'book' | 'share'
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [pickupLocation, setPickupLocation] = useState(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [startLocationSearch, setStartLocationSearch] = useState('');
  const [endLocationSearch, setEndLocationSearch] = useState('');
  const searchTimeoutRef = useRef(null);
  const greetingName = currentUserName
    ? currentUserName.split(' ')[0]
    : 'bạn';
  const handleNotificationPress = useCallback(() => {
    navigation.navigate('Notifications');
  }, [navigation]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await notificationService.getNotifications(0, 50);
      const items = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.content)
        ? response.content
        : [];
      const unread = items.filter((item) => item && item.isRead === false).length;
      setUnreadCount(unread);
    } catch (error) {
      console.warn('Failed to fetch unread notifications:', error?.message || error);
    }
  }, []);

  useEffect(() => {
    initializeHome();
    initializeRiderWebSocket();
  }, []);


  useEffect(() => {
    const loadCurrentUserName = async () => {
      try {
        const cachedUser = authService.getCurrentUser();
        if (cachedUser?.user?.full_name) {
          setCurrentUserName(cachedUser.user.full_name);
          return;
        }
        const profile = await authService.getCurrentUserProfile();
        if (profile?.user?.full_name) {
          setCurrentUserName(profile.user.full_name);
        }
      } catch (error) {
        console.log('Could not load current user name:', error);
      }
    };
    loadCurrentUserName();
  }, []);

  useEffect(() => {
    if (activeTab === 'share') {
      loadNearbyRides(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  const initializeRiderWebSocket = async () => {
    try {
      try {
        await fcmService.initialize();
        await fcmService.registerToken();
      } catch (fcmError) {
        console.warn('FCM init failed, continue without push:', fcmError);
      }
      await websocketService.connectAsRider(handleRideMatchingUpdate, handleRiderNotification);
      setIsWebSocketConnected(true);
    } catch (error) {
      console.error('Failed to init rider WebSocket:', error);
      setIsWebSocketConnected(false);
    }
    fetchUnreadCount();
  };

  const handleRideMatchingUpdate = (data) => {
    console.log('📨 [HomeScreen] Ride matching update received:', JSON.stringify(data, null, 2));
    console.log('📨 [HomeScreen] Status:', data.status, 'RequestId:', data.requestId, 'RideId:', data.rideId);
    
    const requestId = data.requestId || data.sharedRideRequestId;
    const rideId = data.rideId || data.sharedRideId;
    const driverName = data.driverName || 'N/A';
    
    // Helper function to navigate to tracking screen
    const navigateToTracking = () => {
      if (!rideId) {
        console.warn('📨 [HomeScreen] Cannot navigate to tracking - missing rideId');
        return;
      }
      
      navigation.navigate('RideTracking', {
        rideId: rideId,
        requestId: requestId,
        driverInfo: {
          driverName: driverName,
          driverRating: data.driverRating || 4.8,
          vehicleModel: data.vehicleModel || '',
          vehiclePlate: data.vehiclePlate || '',
          totalFare: data.totalFare || data.fareAmount || 0,
          pickupLat: data.pickupLat || data.pickupLocation?.lat,
          pickupLng: data.pickupLng || data.pickupLocation?.lng,
          dropoffLat: data.dropoffLat || data.dropoffLocation?.lat,
          dropoffLng: data.dropoffLng || data.dropoffLocation?.lng,
          pickup_location_name: data.pickupLocationName || data.pickupLocation?.name,
          dropoff_location_name: data.dropoffLocationName || data.dropoffLocation?.name,
        },
        status: 'CONFIRMED',
      });
    };
    
    switch (data.status) {
      case 'ACCEPTED':
      case 'JOIN_REQUEST_ACCEPTED':
        // Handle both AI booking and JOIN_RIDE requests
        console.log('✅ [HomeScreen] Request accepted! Navigating to tracking...');
        
        // Save active ride to AsyncStorage
        activeRideService.saveActiveRide({
          rideId: rideId,
          requestId: requestId,
          status: 'CONFIRMED',
          userType: 'rider',
          driverInfo: {
            driverName: driverName,
            driverRating: data.driverRating || 4.8,
            vehicleModel: data.vehicleModel || '',
            vehiclePlate: data.vehiclePlate || '',
            totalFare: data.totalFare || data.fareAmount || 0,
            pickupLat: data.pickupLat || data.pickupLocation?.lat,
            pickupLng: data.pickupLng || data.pickupLocation?.lng,
            dropoffLat: data.dropoffLat || data.dropoffLocation?.lat,
            dropoffLng: data.dropoffLng || data.dropoffLocation?.lng,
            pickup_location_name: data.pickupLocationName || data.pickupLocation?.name,
            dropoff_location_name: data.dropoffLocationName || data.dropoffLocation?.name,
          },
          pickupLocation: {
            name: data.pickupLocationName || data.pickupLocation?.name || 'Điểm đón',
            lat: data.pickupLat || data.pickupLocation?.lat,
            lng: data.pickupLng || data.pickupLocation?.lng,
          },
          dropoffLocation: {
            name: data.dropoffLocationName || data.dropoffLocation?.name || 'Điểm đến',
            lat: data.dropoffLat || data.dropoffLocation?.lat,
            lng: data.dropoffLng || data.dropoffLocation?.lng,
          },
          totalFare: data.totalFare || data.fareAmount || 0,
        }).catch(err => console.warn('Failed to save active ride:', err));
        
        Alert.alert(
          'Chuyến đi được chấp nhận!',
          data.message || `Tài xế ${driverName} đã chấp nhận yêu cầu của bạn.`,
          [
            {
              text: 'Theo dõi chuyến đi',
              onPress: navigateToTracking,
            },
            {
              text: rideId ? 'Xem chi tiết' : 'OK',
              style: 'cancel',
              onPress: () => {
                if (rideId) {
                  navigation.navigate('RideDetails', { rideId: rideId });
                }
              },
            },
          ],
          { cancelable: false }
        );
        break;
      case 'NO_MATCH':
        console.log('❌ [HomeScreen] No match found');
        Alert.alert(
          'Không tìm thấy tài xế', 
          'Không có tài xế nào chấp nhận. Vui lòng thử lại.', 
          [{ text: 'OK' }]
        );
        break;
      case 'JOIN_REQUEST_FAILED':
      case 'REJECTED':
        console.log('❌ [HomeScreen] Join request rejected/failed');
        Alert.alert(
          'Yêu cầu bị từ chối',
          data.message || data.reason || 'Tài xế đã từ chối yêu cầu tham gia chuyến đi của bạn.',
          [{ text: 'OK' }],
        );
        break;
      case 'CANCELLED':
        console.log('❌ [HomeScreen] Request cancelled');
        Alert.alert(
          'Yêu cầu đã bị hủy',
          data.message || 'Yêu cầu của bạn đã bị hủy.',
          [{ text: 'OK' }],
        );
        break;
      case 'CONFIRMED':
        console.log('✅ [HomeScreen] Request confirmed');
        Alert.alert(
          'Yêu cầu đã được xác nhận!',
          data.message || `Yêu cầu của bạn đã được xác nhận bởi tài xế ${driverName}.`,
          [
            {
              text: 'Theo dõi chuyến đi',
              onPress: navigateToTracking,
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ],
        );
        break;
      case 'ONGOING':
        console.log('🚗 [HomeScreen] Ride is ongoing');
        // Navigate directly to tracking if ride is already ongoing
        navigateToTracking();
        break;
      case 'COMPLETED':
        console.log('✅ [HomeScreen] Ride completed');
        // Clear active ride from storage
        activeRideService.clearActiveRide().catch(err => console.warn('Failed to clear active ride:', err));
        
        Alert.alert(
          'Chuyến đi hoàn thành',
          data.message || 'Chuyến đi của bạn đã hoàn thành. Cảm ơn bạn đã sử dụng dịch vụ!',
          [
            {
              text: 'Đánh giá tài xế',
              onPress: () => {
                navigation.navigate('RideRating', {
                  ride: {
                    driverInfo: {
                      driverName: driverName,
                      driverRating: data.driverRating || 4.8,
                      vehicleModel: data.vehicleModel || '',
                      vehiclePlate: data.vehiclePlate || '',
                      totalFare: data.totalFare || data.fareAmount || 0,
                    },
                    pickupLocation: {
                      name: data.pickupLocationName || data.pickupLocation?.name || 'Điểm đón',
                    },
                    dropoffLocation: {
                      name: data.dropoffLocationName || data.dropoffLocation?.name || 'Điểm đến',
                    },
                    totalFare: data.totalFare || data.fareAmount || 0,
                  },
                  requestId: requestId,
                });
              },
            },
            {
              text: 'Để sau',
              style: 'cancel',
            },
          ]
        );
        break;
      default:
        console.log('⚠️ [HomeScreen] Unknown ride matching status:', data.status, 'Full data:', data);
        // Still show an alert for unknown statuses if there's a message
        if (data.message) {
          Alert.alert('Thông báo', data.message, [{ text: 'OK' }]);
        }
    }
  };

  const handleRiderNotification = (notification) => {
    console.log('🔔 [HomeScreen] Rider notification received:', notification);
    
    // Handle REQUEST_COMPLETED notifications
    if (notification.type === 'REQUEST_COMPLETED') {
      console.log('✅ [HomeScreen] Ride completed notification received');
      
      // Extract requestId from notification payload if available
      let requestId = null;
      let rideId = null;
      
      try {
        if (notification.payload) {
          const payload = typeof notification.payload === 'string' 
            ? JSON.parse(notification.payload) 
            : notification.payload;
          requestId = payload.requestId || payload.sharedRideRequestId || payload.bookingId;
          rideId = payload.rideId || payload.sharedRideId;
        }
      } catch (e) {
        console.warn('Failed to parse notification payload:', e);
      }
      
      // Clear active ride from storage
      activeRideService.clearActiveRide().catch(err => console.warn('Failed to clear active ride:', err));
      
      if (ratingAlertShownRef.current) {
        return;
      }
      if (!requestId) {
        return;
      }
      ratingAlertShownRef.current = true;

      Alert.alert(
        notification.title || 'Chuyến đi hoàn thành',
        notification.message || 'Chuyến đi của bạn đã hoàn thành. Cảm ơn bạn đã sử dụng dịch vụ!',
        [
          {
            text: 'Đánh giá tài xế',
            onPress: () => {
              navigation.navigate('RideRating', {
                ride: {
                  driverInfo: {
                    driverName: 'Tài xế',
                    driverRating: 4.8,
                    totalFare: 0,
                  },
                  pickupLocation: { name: 'Điểm đón' },
                  dropoffLocation: { name: 'Điểm đến' },
                  totalFare: 0,
                },
                requestId: requestId,
              });
            },
          },
          {
            text: 'Để sau',
            style: 'cancel',
          },
        ]
      );
    }
  };

  const initializeHome = async () => {
    try {
      setLoading(true);

      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      // Load wallet balance
      await loadWalletBalance();

      // Quyền vị trí
      const locationPermission = await permissionService.requestLocationPermission(true);
      if (locationPermission.granted) {
        const locationData = await locationStorageService.getCurrentLocationWithAddress();
        if (locationData.location) {
          setCurrentLocation(locationData.location);
          setPickupLocation(locationData.location);
          setPickupAddress(locationData.address || 'Vị trí hiện tại');
        } else {
          const location = await locationService.getCurrentLocation();
          setCurrentLocation(location);
          setPickupLocation(location);
          setPickupAddress('Vị trí hiện tại');
        }
      }


      // Tải danh sách chuyến gần bạn (nếu là rider)
      if (currentUser?.active_profile === 'rider') {
        await loadNearbyRides();
      }
    } catch (error) {
      console.error('Error initializing home:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWalletBalance = async () => {
    try {
      setLoadingWallet(true);
      const walletInfo = await paymentService.getWalletInfo();
      setWalletBalance(walletInfo?.balance || walletInfo?.availableBalance || 0);
    } catch (error) {
      console.error('Error loading wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setLoadingWallet(false);
    }
  };


  const loadNearbyRides = async (useSearchParams = true) => {
    try {
      setLoadingRides(true);
      const rides = await rideService.getAvailableRides(
        null, // startTime
        null, // endTime
        0, // page
        20, // size
        useSearchParams && startLocationSearch.trim() ? startLocationSearch.trim() : null, // startLocation
        useSearchParams && endLocationSearch.trim() ? endLocationSearch.trim() : null, // endLocation
        null, // currentLat
        null, // currentLng
        null  // radiusKm
      );
      setNearbyRides(rides?.data || rides?.content || []);
    } catch (error) {
      console.error('Error loading nearby rides:', error);
      setNearbyRides([]);
    } finally {
      setLoadingRides(false);
    }
  };

  const handleSearchInputChange = (field, value) => {
    if (field === 'start') {
      setStartLocationSearch(value);
    } else {
      setEndLocationSearch(value);
    }

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce: Only search after user stops typing for 500ms
    searchTimeoutRef.current = setTimeout(() => {
      if (activeTab === 'share') {
        loadNearbyRides(true);
      }
    }, 500);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadWalletBalance();
      await loadNearbyRides();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // No longer needed - navigation happens directly to RideBookingScreen

  const formatCurrency = (amount) => {
    if (!amount) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const getInitials = (name) => {
    if (!name) return 'T';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const formatScheduledTime = (scheduledTime) => {
    if (!scheduledTime) return 'Ngay lập tức';
    try {
      const date =
        scheduledTime instanceof Date
          ? scheduledTime
          : new Date(scheduledTime);

      if (Number.isNaN(date.getTime())) {
        return 'Ngay lập tức';
      }

      const formatted = date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      });
      return formatted;
    } catch (error) {
      console.error('Error formatting scheduled time:', error, scheduledTime);
      return 'Ngay lập tức';
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
      >
          <Animatable.View animation="fadeInDown" duration={380} useNativeDriver>
            <GlassHeader
              title={`Xin chào, ${greetingName}`}
              subtitle="Sẵn sàng cho chuyến đi tiếp theo"
              onBellPress={handleNotificationPress}
              badgeCount={unreadCount}
            />
          </Animatable.View>

          {/* Wallet Card */}
          <Animatable.View animation="fadeInDown" duration={400} useNativeDriver>
            <LinearGradient 
              colors={['#87CEEB', '#4169E1']} 
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCard}
            >
              <View style={styles.walletContent}>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletLabel}>Số dư ví</Text>
                  {loadingWallet ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.walletLoading} />
                  ) : (
                    <Text style={styles.walletAmount}>{formatCurrency(walletBalance)}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.topUpButton}
                  onPress={() => {
                    navigation.navigate('QRPayment', { type: 'topup' });
                  }}
                >
                  <Text style={styles.topUpButtonText}>Nạp tiền</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animatable.View>

          {/* Tab Switcher */}
          <Animatable.View animation="fadeInUp" duration={420} delay={50} useNativeDriver>
            <View style={styles.tabSwitcherCard}>
              <View style={styles.tabSwitcherCardInner}>
                <View style={styles.tabSwitcherInner}>
                  <View style={styles.tabSwitcher}>
                  <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'book' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('book')}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'book' && styles.tabButtonTextActive]}>
                      Đặt xe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'share' && styles.tabButtonActive]}
                    onPress={() => setActiveTab('share')}
                  >
                    <Text style={[styles.tabButtonText, activeTab === 'share' && styles.tabButtonTextActive]}>
                      Chuyến đi đang được chia sẻ
                    </Text>
                  </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Animatable.View>

          {/* Main Content */}
          <View style={styles.content}>
            {activeTab === 'book' ? (
              <Animatable.View animation="fadeInUp" duration={480} delay={100} useNativeDriver>
                <View style={styles.bookTabContent}>
                  {/* Single Location Selection Button */}
                  <View style={styles.locationCardContainer}>
                    <View style={styles.locationCardContainerInner}>
                      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16 }}>
                        <TouchableOpacity
                          style={styles.locationCard}
                          onPress={() => navigation.navigate('RideBooking', {
                            pickup: pickupLocation,
                            pickupAddress: pickupAddress,
                            dropoff: dropoffLocation,
                            dropoffAddress: dropoffAddress,
                          })}
                        >
                          <View style={styles.locationFieldContent}>
                            <Icon name="location-on" size={24} color="#4CAF50" />
                            <Text style={styles.locationFieldText}>Chọn địa điểm</Text>
                            <Icon name="chevron-right" size={24} color="#999" />
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </Animatable.View>
            ) : (
              <Animatable.View animation="fadeInUp" duration={480} delay={100} useNativeDriver>
                <View style={styles.shareTabContent}>
                  {/* Active Ride Card */}
                  <ActiveRideCard navigation={navigation} />

                  {/* Search Section */}
                  <View style={styles.searchContainer}>
                    <CleanCard style={styles.searchCard} contentStyle={styles.searchCardContent}>
                      <View style={styles.searchInputContainer}>
                        <Icon name="location-on" size={20} color={colors.primary} style={styles.searchIcon} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Tìm theo điểm đi..."
                          placeholderTextColor={colors.textMuted}
                          value={startLocationSearch}
                          onChangeText={(value) => handleSearchInputChange('start', value)}
                          returnKeyType="next"
                        />
                        {startLocationSearch.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setStartLocationSearch('')}
                            style={styles.clearButton}
                          >
                            <Icon name="close" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.searchInputContainer}>
                        <Icon name="location-on" size={20} color="#F44336" style={styles.searchIcon} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Tìm theo điểm đến..."
                          placeholderTextColor={colors.textMuted}
                          value={endLocationSearch}
                          onChangeText={(value) => handleSearchInputChange('end', value)}
                          returnKeyType="search"
                          onSubmitEditing={() => {
                            if (searchTimeoutRef.current) {
                              clearTimeout(searchTimeoutRef.current);
                            }
                            loadNearbyRides(true);
                          }}
                        />
                        {endLocationSearch.length > 0 && (
                          <TouchableOpacity
                            onPress={() => setEndLocationSearch('')}
                            style={styles.clearButton}
                          >
                            <Icon name="close" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={styles.searchActions}>
                        {(startLocationSearch.trim() || endLocationSearch.trim()) && (
                          <TouchableOpacity
                            style={styles.clearAllButton}
                            onPress={() => {
                              setStartLocationSearch('');
                              setEndLocationSearch('');
                            }}
                            activeOpacity={0.7}
                          >
                            <Icon name="clear" size={18} color={colors.textSecondary} />
                            <Text style={styles.clearAllText}>Xóa</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.searchButton}
                          onPress={() => {
                            if (searchTimeoutRef.current) {
                              clearTimeout(searchTimeoutRef.current);
                            }
                            loadNearbyRides(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <Icon name="search" size={20} color="#fff" />
                          <Text style={styles.searchButtonText}>Tìm kiếm</Text>
                        </TouchableOpacity>
                      </View>
                    </CleanCard>
                  </View>

                  {/* Available Shared Rides */}
                  <View style={styles.sharedRidesSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Chuyến đi đang chia sẻ</Text>
                      <TouchableOpacity onPress={() => loadNearbyRides(false)} style={styles.refreshButton}>
                        <Icon name="refresh" size={20} color="#4CAF50" />
                      </TouchableOpacity>
                    </View>

                    {loadingRides ? (
                      <View style={styles.loadingRidesContainer}>
                        <ActivityIndicator size="large" color="#4CAF50" />
                        <Text style={styles.loadingRidesText}>Đang tải chuyến đi...</Text>
                      </View>
                    ) : nearbyRides.length === 0 ? (
                      <View style={styles.emptyCardContainer}>
                        <View style={styles.emptyCardContainerInner}>
                          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16 }}>
                            <View style={styles.emptyCard}>
                              <Icon name="directions-car" size={48} color="#ccc" />
                              <Text style={styles.emptyText}>Không có chuyến đi nào</Text>
                              <Text style={styles.emptySubtext}>Hãy thử lại sau</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ) : (
                      nearbyRides.map((ride) => {
                        const rideId = ride.shared_ride_id || ride.sharedRideId || ride.rideId;
                        const driverName = ride.driver_name || ride.driverName || 'Tài xế';
                        const driverRating = ride.driver_rating || ride.driverRating || 4.8;
                        
                        
                        const getLocationDisplay = (location) => {
                          if (!location) return null;
                          const name = location.name;
                          const address = location.address;
                          // Return name if it exists and is not empty, otherwise return address
                          if (name && name.trim() !== '') return name.trim();
                          if (address && address.trim() !== '') return address.trim();
                          return null;
                        };
                        
                        const startLocation = getLocationDisplay(ride.start_location) || 
                                             getLocationDisplay(ride.startLocation) ||
                                             ride.startLocationName ||
                                             'Điểm đi';
                        const endLocation = getLocationDisplay(ride.end_location) || 
                                           getLocationDisplay(ride.endLocation) ||
                                           ride.endLocationName ||
                                           'Điểm đến';
                        const scheduledTime = ride.scheduled_time || ride.scheduledTime || ride.scheduledDepartureTime;
                        const availableSeats = ride.available_seats !== undefined ? ride.available_seats : 1;

                        return (
                          <View key={rideId} style={styles.rideCardContainer}>
                            <View style={styles.rideCardContainerInner}>
                              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16 }}>
                                <View style={styles.rideCard}>
                                  <View style={styles.rideCardHeader}>
                                    <View style={styles.rideDriverInfo}>
                                      <View style={styles.rideDriverAvatar}>
                                        <Text style={styles.rideDriverAvatarText}>
                                          {getInitials(driverName)}
                                        </Text>
                                      </View>
                                      <View>
                                        <Text style={styles.rideDriverName}>{driverName}</Text>
                                        <View style={styles.rideDriverMeta}>
                                          <Icon name="star" size={14} color="#FFD700" />
                                          <Text style={styles.rideDriverRating}>
                                            {driverRating.toFixed(1)}
                                          </Text>
                                        </View>
                                      </View>
                                    </View>
                                  </View>

                                  <View style={styles.rideRoute}>
                                    <View style={styles.routePoint}>
                                      <View style={styles.routeDot} />
                                      <Text style={styles.routeText} numberOfLines={1}>
                                        {startLocation}
                                      </Text>
                                    </View>
                                    <View style={styles.routeLine} />
                                    <View style={styles.routePoint}>
                                      <Icon name="location-on" size={16} color="#F44336" />
                                      <Text style={styles.routeText} numberOfLines={1}>
                                        {endLocation}
                                      </Text>
                                    </View>
                                  </View>

                                  <View style={styles.rideCardFooter}>
                                    <View style={styles.rideMeta}>
                                      <View style={styles.rideMetaItem}>
                                        <Icon name="access-time" size={14} color="#666" />
                                        <Text style={styles.rideMetaText}>
                                          {formatScheduledTime(scheduledTime)}
                                        </Text>
                                      </View>
                                      <View style={styles.rideMetaItem}>
                                        <Icon name="people" size={14} color="#666" />
                                        <Text style={styles.rideMetaText}>
                                          {availableSeats} chỗ trống
                                        </Text>
                                      </View>
                                    </View>
                                    <TouchableOpacity
                                      style={styles.joinButton}
                                      onPress={() => navigation.navigate('RideDetails', { rideId })}
                                    >
                                      <Text style={styles.joinButtonText}>Tham gia</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              </Animatable.View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  walletCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  walletContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  walletInfo: {
    flex: 1,
  },
  walletLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  walletAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  walletLoading: {
    marginTop: 8,
  },
  topUpButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  topUpButtonText: {
    color: '#4169E1',
    fontSize: 14,
    fontWeight: '600',
  },
  tabSwitcherCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    padding: 6,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  tabSwitcherCardInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  tabSwitcherInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 6,
  },
  tabSwitcher: {
    flexDirection: 'row',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#4CAF50',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bookTabContent: {
    gap: 16,
  },
  shareTabContent: {
    gap: 16,
  },
  locationCardContainer: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 0,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  locationCardContainerInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  locationCard: {
    padding: 16,
  },
  locationFieldContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationFieldText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '400',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sharedRidesSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  refreshButton: {
    padding: 4,
  },
  loadingRidesContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingRidesText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyCardContainer: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 0,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  emptyCardContainerInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  rideCardContainer: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 12,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  rideCardContainerInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  rideCard: {
    padding: 16,
    gap: 12,
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rideDriverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rideDriverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideDriverAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  rideDriverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  rideDriverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rideDriverRating: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  rideRoute: {
    gap: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  rideMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  rideMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rideMetaText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchCard: {
    marginBottom: 0,
  },
  searchCardContent: {
    padding: 16,
    gap: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148,163,184,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  searchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(148,163,184,0.1)',
    gap: 6,
  },
  clearAllText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});

export default HomeScreen;
