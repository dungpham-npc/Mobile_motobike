import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

import websocketService from '../../services/websocketService';
import fcmService from '../../services/fcmService';
import authService from '../../services/authService';
import vehicleService from '../../services/vehicleService';
import rideService from '../../services/rideService';
import { locationStorageService } from '../../services/locationStorageService';
import RideOfferModal from '../../components/RideOfferModal';
import notificationService from '../../services/notificationService';

const { width } = Dimensions.get('window');

const DriverHomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const baseTabBarHeight = Platform.OS === 'ios' ? 88 : 60;
  const bottomPadding = baseTabBarHeight + (insets.bottom || 0) + 32;

  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'shared'
  
  // Driver stats
  const [driverStats, setDriverStats] = useState({
    todayEarnings: 0,
    totalRides: 0,
    rating: 5.0,
    balance: 0,
  });
  
  // Ride offer states
  const [rideRequests, setRideRequests] = useState([]);
  const [broadcastRequests, setBroadcastRequests] = useState([]);
  const [loadingBroadcastRequests, setLoadingBroadcastRequests] = useState(false);
  const [currentOffer, setCurrentOffer] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerCountdown, setOfferCountdown] = useState(0);
  const [vehicleId, setVehicleId] = useState(null);
  
  // Shared ride states
  const [sharedRides, setSharedRides] = useState([]);
  const [loadingSharedRides, setLoadingSharedRides] = useState(false);
  const [activeSharedRide, setActiveSharedRide] = useState(null);
  const [pendingJoinRequests, setPendingJoinRequests] = useState({}); // { rideId: [requests] }
  const [unreadCount, setUnreadCount] = useState(0);
  
  const countdownInterval = useRef(null);

  const totalRequests = rideRequests.length + broadcastRequests.length;
  const combinedRequests = [...broadcastRequests, ...rideRequests];
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
      console.warn('Failed to fetch driver notifications:', error?.message || error);
    }
  }, []);

  useEffect(() => {
    initializeDriver();
    
    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
      websocketService.disconnect();
    };
  }, []);

  // Load shared rides when switching to shared tab
  useEffect(() => {
    if (activeTab === 'shared' && isOnline) {
      loadSharedRides();
    }
  }, [activeTab, isOnline]);

  useEffect(() => {
    if (activeTab === 'requests' && isOnline) {
      loadBroadcastRequests();
    }
  }, [activeTab, isOnline]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  const initializeDriver = async () => {
    try {
      setLoading(true);
      
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      
      const locationData = await locationStorageService.getCurrentLocationWithAddress();
      if (locationData.location) {
        setCurrentLocation(locationData.location);
      }
      
      await loadVehicles();
      
      try {
        await fcmService.initialize();
        await fcmService.registerToken();
      } catch (fcmError) {
        console.warn('FCM initialization failed:', fcmError);
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

  const loadSharedRides = async () => {
    try {
      setLoadingSharedRides(true);
      
      // Fetch SCHEDULED and ONGOING rides
      const response = await rideService.getMyRides(null, 0, 50, 'scheduledTime', 'asc');
      
      const rides = response?.data || response?.content || [];
      
      // Process rides and fetch passenger counts + pending requests
      const processedRides = await Promise.all(
        rides.map(async (ride) => {
          const rideId = ride.shared_ride_id || ride.sharedRideId;
          let currentPassengers = 0;
          let maxPassengers = 1; // System only allows 1 passenger per ride
          let pendingRequests = [];
          
          // Fetch ride requests to determine passenger count and pending requests
          try {
            const requestsResponse = await rideService.getRideRequests(rideId);
            const requests = requestsResponse?.data || requestsResponse?.content || [];
            
            // Check if there are any CONFIRMED or ONGOING requests
            const confirmedOrOngoingRequests = requests.filter(req => 
              req.status === 'CONFIRMED' || req.status === 'ONGOING'
            );
            
            if (confirmedOrOngoingRequests.length > 0) {
              currentPassengers = 1; // Has passenger
            } else {
              currentPassengers = 0; // No passenger
            }
            
            // Get pending join requests (PENDING status)
            pendingRequests = requests
              .filter(req => req.status === 'PENDING')
              .map(req => {
                // Extract fare properly from API response - handle BigDecimal (string), number, object
                const extractFare = (fareValue) => {
                  if (fareValue === null || fareValue === undefined) return null;
                  if (typeof fareValue === 'number') return fareValue;
                  if (typeof fareValue === 'object' && fareValue.amount !== undefined) {
                    return typeof fareValue.amount === 'number' ? fareValue.amount : parseFloat(fareValue.amount) || null;
                  }
                  if (typeof fareValue === 'string') {
                    const parsed = parseFloat(fareValue);
                    return isNaN(parsed) ? null : parsed;
                  }
                  return null;
                };
                
                const fare = extractFare(req.total_fare) || extractFare(req.totalFare) || extractFare(req.fareAmount) || 0;
                console.log('🎯 [DriverHomeScreen] Loading request fare - raw:', req.total_fare || req.totalFare || req.fareAmount, 'extracted:', fare);
                
                return {
                  ...req,
                  total_fare: fare,
                  totalFare: fare,
                  fareAmount: fare,
                };
              });
          } catch (error) {
            console.warn('Failed to fetch ride requests for ride', rideId, error);
            currentPassengers = 0;
            pendingRequests = [];
          }
          
          return {
            rideId: rideId,
            from: getLocationLabel(ride.start_location) || 
                  getLocationLabel(ride.startLocation) ||
                  'Điểm đi',
            to: getLocationLabel(ride.end_location) || 
                getLocationLabel(ride.endLocation) ||
                'Điểm đến',
            scheduledTime: formatScheduledTime(ride.scheduled_time || ride.scheduledTime),
            currentPassengers: currentPassengers,
            maxPassengers: maxPassengers, // Always 1
            status: ride.status,
            baseFare: ride.base_fare || ride.baseFare || 0,
            raw: ride,
            pendingRequests: pendingRequests,
          };
        })
      );
      
      // Filter for SCHEDULED and ONGOING rides
      const activeRides = processedRides.filter(ride => 
        ride.status === 'SCHEDULED' || ride.status === 'ONGOING'
      );
      
      setSharedRides(activeRides);
      
      // Store pending requests by rideId
      const requestsMap = {};
      activeRides.forEach(ride => {
        if (ride.pendingRequests && ride.pendingRequests.length > 0) {
          requestsMap[ride.rideId] = ride.pendingRequests;
        }
      });
      setPendingJoinRequests(requestsMap);
      
      // Set the first active ride as activeSharedRide if exists
      if (activeRides.length > 0) {
        const firstRide = activeRides[0];
        setActiveSharedRide({
          ...firstRide,
          status: firstRide.status === 'ONGOING' ? 'ongoing' : 'waiting',
        });
      } else {
        setActiveSharedRide(null);
      }
    } catch (error) {
      console.error('Failed to load shared rides:', error);
    } finally {
      setLoadingSharedRides(false);
    }
  };

  const loadBroadcastRequests = async () => {
    if (!isOnline) {
      setBroadcastRequests([]);
      return;
    }

    try {
      setLoadingBroadcastRequests(true);
      const response = await rideService.getBroadcastingRequests();
      const rawList = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.content)
        ? response.content
        : Array.isArray(response)
        ? response
        : [];

      const formatted = rawList.map((item, index) => {
        const requestId =
          item.rideRequestId ||
          item.sharedRideRequestId ||
          item.shared_ride_request_id ||
          item.requestId ||
          item.id;
        const pickupLocation =
          item.pickupLocation || item.pickup_location || item.pickup;
        const dropoffLocation =
          item.dropoffLocation || item.dropoff_location || item.dropoff;
        const desiredPickupTime =
          item.desiredPickupTime || item.desired_pickup_time;
        const fareAmount =
          extractAmount(item.totalFare) ||
          extractAmount(item.total_fare) ||
          extractAmount(item.fareAmount) ||
          extractAmount(item.fare) ||
          0;

        return {
          id: requestId || `broadcast-${index}`,
          requestId: requestId,
          pickup: getLocationLabel(pickupLocation) || 'Điểm đón',
          dropoff: getLocationLabel(dropoffLocation) || 'Điểm đến',
          pickupLocation,
          dropoffLocation,
          desiredPickupTime,
          time: formatScheduledTime(desiredPickupTime),
          fare: fareAmount,
          fareAmount: fareAmount,
          rider: 'Yêu cầu mở',
          riderName: 'Yêu cầu mở',
          riderRating: 5.0,
          rating: 5.0,
          broadcast: true,
          raw: item,
        };
      });

      setBroadcastRequests(formatted);
    } catch (error) {
      console.error('Failed to load broadcasting requests:', error);
    } finally {
      setLoadingBroadcastRequests(false);
    }
  };

  const formatScheduledTime = (scheduledTime) => {
    if (!scheduledTime) return 'Ngay lập tức';
    
    try {
      // Backend sends local time (Vietnam UTC+7) but marks it as UTC with 'Z'
      // Remove 'Z' to parse as local time without timezone conversion
      const localTimeString = scheduledTime.replace('Z', '');
      const date = new Date(localTimeString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Ngay lập tức';
      }
      
      // Get local time components (already in local timezone)
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    } catch (error) {
      console.error('Error formatting scheduled time:', error, scheduledTime);
      return 'Ngay lập tức';
    }
  };

  const getLocationLabel = (location) => {
    if (!location) return null;
    const candidates = [
      location.name,
      location.locationName,
      location.location_name,
      location.addressName,
      location.placeName,
    ];
    const label = candidates.find((value) => typeof value === 'string' && value.trim() !== '');
    if (label) {
      return label.trim();
    }
    const address =
      location.address ||
      location.addressText ||
      location.formatted_address ||
      location.description;
    if (address && address.trim() !== '') {
      return address.trim();
    }
    return null;
  };

  const handleRideOffer = (offer) => {
    console.log('🎯 [DriverHomeScreen] Received ride offer:', JSON.stringify(offer, null, 2));
    
    if (offer.type === 'TRACKING_START') {
      handleTrackingStart(offer);
      return;
    }
    
    // Check if this is a join request (proposalRank === 1 and has rideId)
    const isJoinRequest = offer.proposalRank === 1 && offer.rideId;
    console.log('🎯 [DriverHomeScreen] Is join request:', isJoinRequest, 'rideId:', offer.rideId);
    
    // Extract fare - handle BigDecimal (string), number, and object with amount property
    const extractFare = (fareValue) => {
      if (fareValue === null || fareValue === undefined) return null;
      if (typeof fareValue === 'number') return fareValue;
      if (typeof fareValue === 'object' && fareValue.amount !== undefined) {
        return typeof fareValue.amount === 'number' ? fareValue.amount : parseFloat(fareValue.amount) || null;
      }
      if (typeof fareValue === 'string') {
        const parsed = parseFloat(fareValue);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };
    
    // Backend sends totalFare as BigDecimal (string or number)
    const fareAmount = extractFare(offer.totalFare) || 
                       extractFare(offer.fareAmount) || 
                       extractFare(offer.fare) || 
                       extractFare(offer.estimatedFare) || 
                       0;
    console.log('🎯 [DriverHomeScreen] Raw offer.totalFare:', offer.totalFare, 'Type:', typeof offer.totalFare);
    console.log('🎯 [DriverHomeScreen] Extracted fare:', fareAmount);
    
    // Add to ride requests list
    setRideRequests(prev => {
      const exists = prev.some(r => 
        (r.id === offer.id) || 
        (r.requestId === offer.requestId) || 
        (isJoinRequest && r.rideId === offer.rideId && r.requestId === offer.requestId)
      );
      if (!exists) {
        return [...prev, {
          ...offer,
          id: offer.id || offer.requestId || Date.now(),
          requestId: offer.requestId,
          rider: offer.riderName || 'Hành khách',
          rating: offer.riderRating || 5.0,
          pickup: offer.pickupAddress || offer.pickupLocationName || offer.pickup?.address || offer.pickup?.name || 'Điểm đón',
          dropoff: offer.dropoffAddress || offer.dropoffLocationName || offer.dropoff?.address || offer.dropoff?.name || 'Điểm đến',
          distance: offer.distance ? `${(offer.distance / 1000).toFixed(1)} km` : 'N/A',
          fare: fareAmount,
          time: 'Now',
          type: isJoinRequest ? 'shared' : (offer.rideType || 'direct'),
          offerExpiresAt: offer.offerExpiresAt,
        }];
      }
      return prev;
    });
    
    // If it's a join request, also update pending requests for that ride
    if (isJoinRequest && offer.rideId) {
      setPendingJoinRequests(prev => {
        const rideId = offer.rideId;
        const existingRequests = prev[rideId] || [];
        const requestExists = existingRequests.some(
          req => (req.shared_ride_request_id || req.sharedRideRequestId) === offer.requestId
        );
        
        if (!requestExists) {
          const newRequest = {
            shared_ride_request_id: offer.requestId,
            sharedRideRequestId: offer.requestId,
            rider_name: offer.riderName,
            riderName: offer.riderName,
            total_fare: fareAmount,
            totalFare: fareAmount,
            fareAmount: fareAmount,
            pickup_location: offer.pickupLocation || { name: offer.pickupLocationName },
            pickupLocation: offer.pickupLocation || { name: offer.pickupLocationName },
            dropoff_location: offer.dropoffLocation || { name: offer.dropoffLocationName },
            dropoffLocation: offer.dropoffLocation || { name: offer.dropoffLocationName },
            status: 'PENDING',
          };
          
          console.log('🎯 [DriverHomeScreen] Adding join request to pending:', newRequest);
          
          return {
            ...prev,
            [rideId]: [...existingRequests, newRequest],
          };
        }
        return prev;
      });
      
      // Reload shared rides to refresh the list
      loadSharedRides();
    }
    
    // Show modal for real-time popup (ALWAYS show, not just when !showOfferModal)
    const offerData = {
      id: offer.id || offer.requestId || Date.now(),
      requestId: offer.requestId,
      rideId: offer.rideId,
      riderName: offer.riderName || 'Hành khách',
      riderRating: offer.riderRating || 5.0,
      pickupLocationName: offer.pickupAddress || offer.pickupLocationName || offer.pickup?.address || offer.pickup?.name || 'Điểm đón',
      dropoffLocationName: offer.dropoffAddress || offer.dropoffLocationName || offer.dropoff?.address || offer.dropoff?.name || 'Điểm đến',
      pickupLat: offer.pickupLat || offer.pickup?.lat,
      pickupLng: offer.pickupLng || offer.pickup?.lng,
      dropoffLat: offer.dropoffLat || offer.dropoff?.lat,
      dropoffLng: offer.dropoffLng || offer.dropoff?.lng,
      fareAmount: fareAmount,
      proposalRank: offer.proposalRank || (isJoinRequest ? 1 : null),
      broadcast: offer.broadcast || false,
      offerExpiresAt: offer.offerExpiresAt,
    };
    
    console.log('🎯 [DriverHomeScreen] Showing offer modal with data:', offerData);
    setCurrentOffer(offerData);
    setShowOfferModal(true);
    
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
            setCurrentOffer(null);
            setShowOfferModal(false);
            setRideRequests(prev => prev.filter(r => 
              r.id !== offerData.id && 
              r.requestId !== offerData.requestId &&
              (!isJoinRequest || r.rideId !== offerData.rideId)
            ));
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
    if (notification?.message) {
      Alert.alert('Thông báo', notification.message);
    }
    fetchUnreadCount();
  };

  const handleTrackingStart = async (trackingSignal) => {
    try {
      console.log('🎯 Received TRACKING_START signal for ride:', trackingSignal.rideId);
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
      Alert.alert('Cần vị trí', 'Vui lòng bật GPS để có thể nhận chuyến đi', [{ text: 'OK' }]);
      return;
    }
    
    try {
      if (value) {
        setConnectionStatus('connecting');
        await websocketService.connectAsDriver(handleRideOffer, handleNotification);
        setConnectionStatus('connected');
        console.log('✅ Driver is now online');
      } else {
        setConnectionStatus('disconnecting');
        websocketService.disconnect();
        setRideRequests([]);
        setBroadcastRequests([]);
        setConnectionStatus('disconnected');
        console.log('✅ Driver is now offline');
      }
      
      setIsOnline(value);
      
    } catch (error) {
      console.error('Error toggling online status:', error);
      setConnectionStatus('error');
      Alert.alert('Lỗi kết nối', `Không thể ${value ? 'kết nối' : 'ngắt kết nối'}: ${error.message}`, [{ text: 'OK' }]);
      if (value) {
        setIsOnline(false);
        setBroadcastRequests([]);
      }
    }
  };

  const handleOfferResponse = (accepted, reason = null) => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    setShowOfferModal(false);
    
    if (currentOffer) {
      const requestId = currentOffer.requestId;
      const rideId = currentOffer.rideId;
      const isJoinRequest = currentOffer.proposalRank === 1;
      
      // Remove from ride requests list
      setRideRequests(prev => prev.filter(r =>
        r.id !== currentOffer.id && r.rideId !== currentOffer.rideId
      ));

      if (currentOffer.broadcast) {
        setBroadcastRequests(prev =>
          prev.filter(r => (r.requestId || r.id) !== requestId)
        );
      }

      // If it was a join request for a shared ride, remove from pending requests
      if (isJoinRequest && rideId && requestId) {
        setPendingJoinRequests(prev => {
          const requests = prev[rideId] || [];
          const filtered = requests.filter(
            req => (req.shared_ride_request_id || req.sharedRideRequestId) !== requestId
          );
          if (filtered.length === 0) {
            const { [rideId]: removed, ...rest } = prev;
            return rest;
          }
          return { ...prev, [rideId]: filtered };
        });
        
        // Reload shared rides to refresh passenger count
        loadSharedRides();
      }
    }
    
    setCurrentOffer(null);
    setOfferCountdown(0);
  };

  const handleAcceptRequest = (request) => {
    const isBroadcastRequest = request.broadcast === true;

    // Normalize request data for the modal
    const offerData = {
      requestId: request.requestId || request.sharedRideRequestId || request.id,
      rideId: request.rideId || request.sharedRideId,
      riderName: request.riderName || request.rider_name || 'Hành khách',
      riderRating: request.riderRating || request.rider_rating || 5.0,
      pickupLocationName: request.pickupLocation?.name || request.pickup_location_name || request.pickup || 'Điểm đón',
      dropoffLocationName: request.dropoffLocation?.name || request.dropoff_location_name || request.dropoff || 'Điểm đến',
      pickupLat: request.pickupLocation?.lat || request.pickup_lat,
      pickupLng: request.pickupLocation?.lng || request.pickup_lng,
      dropoffLat: request.dropoffLocation?.lat || request.dropoff_lat,
      dropoffLng: request.dropoffLocation?.lng || request.dropoff_lng,
      fareAmount: request.fareAmount || request.total_fare || request.totalFare || request.fare || 0,
      proposalRank: request.proposalRank ?? (isBroadcastRequest ? null : 1),
      broadcast: isBroadcastRequest,
      offerExpiresAt: request.offerExpiresAt || null,
    };
    
    setCurrentOffer(offerData);
    setShowOfferModal(true);
  };

  const handleRejectRequest = async (request) => {
    Alert.alert('Từ chối yêu cầu', 'Bạn có chắc muốn từ chối yêu cầu này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Từ chối',
        style: 'destructive',
        onPress: async () => {
          try {
            const requestId = request.requestId || request.sharedRideRequestId || request.id;
            if (requestId) {
              await rideService.rejectRideRequest(requestId, 'Driver declined join request');
            }
            
            // Remove from local state
            setRideRequests(prev => prev.filter(r => r.id !== request.id));
            
            // Remove from pending join requests if it's a join request
            if (request.rideId) {
              setPendingJoinRequests(prev => {
                const rideId = request.rideId;
                const requests = prev[rideId] || [];
                const filtered = requests.filter(
                  req => (req.shared_ride_request_id || req.sharedRideRequestId) !== requestId
                );
                if (filtered.length === 0) {
                  const { [rideId]: removed, ...rest } = prev;
                  return rest;
                }
                return { ...prev, [rideId]: filtered };
              });
              
              // Reload shared rides to refresh passenger count
              loadSharedRides();
            }
          } catch (error) {
            console.error('Error rejecting request:', error);
            Alert.alert('Lỗi', 'Không thể từ chối yêu cầu. Vui lòng thử lại.');
          }
        }
      }
    ]);
  };

  const extractAmount = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'object') {
      if (typeof value.amount === 'number') return value.amount;
      if (typeof value.amount === 'string') {
        const parsed = parseFloat(value.amount);
        return isNaN(parsed) ? null : parsed;
      }
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang khởi tạo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.fullName || 'Tài xế'}</Text>
              <Text style={styles.userRole}>Tài xế</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Icon name="notifications" size={24} color="#333" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Online Toggle */}
        <View style={styles.onlineToggleContainer}>
          <View style={styles.onlineStatus}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#9E9E9E' }]} />
            <Text style={styles.onlineStatusText}>
              {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
            thumbColor={isOnline ? '#4CAF50' : '#9E9E9E'}
          />
        </View>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsContainer}>
        <LinearGradient colors={['#4CAF50', '#2196F3']} style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View>
              <Text style={styles.earningsLabel}>Thu nhập hôm nay</Text>
              <Text style={styles.earningsAmount}>
                {formatCurrency(driverStats.todayEarnings)}
              </Text>
            </View>
          </View>
          
          <View style={styles.earningsFooter}>
            <View style={styles.earningsStat}>
              <Icon name="navigation" size={16} color="#fff" />
              <Text style={styles.earningsStatText}>{driverStats.totalRides} chuyến</Text>
            </View>
            <View style={styles.earningsStat}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.earningsStatText}>{driverStats.rating.toFixed(1)}</Text>
            </View>
            <View style={styles.earningsStat}>
              <Icon name="account-balance-wallet" size={16} color="#fff" />
              <Text style={styles.earningsStatText}>{formatCurrency(driverStats.balance)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Yêu cầu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
          onPress={() => setActiveTab('shared')}
        >
          <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>
            Chuyến chia sẻ
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {!isOnline ? (
          <View style={styles.offlineContainer}>
            <View style={styles.offlineIcon}>
              <Icon name="navigation" size={48} color="#9E9E9E" />
            </View>
            <Text style={styles.offlineTitle}>Bạn đang ngoại tuyến</Text>
            <Text style={styles.offlineDescription}>
              Bật trạng thái hoạt động để nhận yêu cầu chuyến đi
            </Text>
            <TouchableOpacity
              style={styles.goOnlineButton}
              onPress={() => handleToggleOnline(true)}
            >
              <Text style={styles.goOnlineButtonText}>Bắt đầu nhận chuyến</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'requests' ? (
          <View style={styles.requestsContainer}>
            <View style={styles.requestsHeader}>
              <Text style={styles.requestsTitle}>Yêu cầu chuyến đi</Text>
              <View style={styles.requestsHeaderActions}>
                <Text style={styles.requestsCount}>{totalRequests} yêu cầu</Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadBroadcastRequests}
                  disabled={loadingBroadcastRequests}
                  accessibilityLabel="Làm mới danh sách yêu cầu"
                >
                  {loadingBroadcastRequests ? (
                    <ActivityIndicator size="small" color="#2196F3" />
                  ) : (
                    <Icon name="refresh" size={20} color="#2196F3" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
            
            {totalRequests === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="inbox" size={48} color="#9E9E9E" />
                <Text style={styles.emptyStateText}>Chưa có yêu cầu nào</Text>
                <Text style={styles.emptyStateSubtext}>Bạn sẽ nhận được thông báo hoặc có thể làm mới để xem yêu cầu mới</Text>
              </View>
            ) : (
              <View style={styles.requestsList}>
                {combinedRequests.map((request) => {
                  const isBroadcastRequest = request.broadcast === true;
                  const requestKey = `request-${request.id}`;
                  const priceAmount = request.fare || request.fareAmount || request.total_fare || 0;
                  return (
                  <View key={requestKey} style={[styles.requestCard, isBroadcastRequest && styles.broadcastCard]}>
                    <View style={styles.requestHeader}>
                      <View style={styles.riderInfo}>
                        <View style={styles.riderAvatar}>
                          <Text style={styles.riderAvatarText}>
                            {getInitials(request.rider)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.riderName}>{request.rider}</Text>
                          <View style={styles.riderMeta}>
                            <Icon name="star" size={14} color="#FFD700" />
                            <Text style={styles.riderRating}>{request.rating.toFixed(1)}</Text>
                            {!isBroadcastRequest && (
                              <>
                                <Text style={styles.riderMetaDot}>•</Text>
                                <View style={[
                                  styles.rideTypeBadge,
                                  request.type === 'shared' ? styles.rideTypeShared : styles.rideTypeDirect
                                ]}>
                                  <Text style={[
                                    styles.rideTypeText,
                                    request.type === 'shared' ? styles.rideTypeTextShared : styles.rideTypeTextDirect
                                  ]}>
                                    {request.type === 'shared' ? 'Chia sẻ' : 'Trực tiếp'}
                                  </Text>
                                </View>
                              </>
                            )}
                            {isBroadcastRequest && (
                              <View style={styles.broadcastBadge}>
                                <Icon name="campaign" size={14} color="#1565C0" />
                                <Text style={styles.broadcastBadgeText}>Yêu cầu mở</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.requestPrice}>
                        <Text style={styles.requestPriceAmount}>
                          {formatCurrency(priceAmount)}
                        </Text>
                        {request.distance ? (
                          <Text style={styles.requestDistance}>{request.distance}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.requestRoute}>
                      <View style={styles.routePoint}>
                        <View style={styles.routeDot} />
                        <Text style={styles.routeText}>{request.pickup}</Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routePoint}>
                        <Icon name="location-on" size={16} color="#F44336" />
                        <Text style={styles.routeText}>{request.dropoff}</Text>
                      </View>
                    </View>

                    <View style={styles.requestActions}>
                      <View style={styles.requestTime}>
                        <Icon name="access-time" size={14} color="#666" />
                        <Text style={styles.requestTimeText}>{request.time}</Text>
                      </View>
                      <View style={styles.requestButtons}>
                        {isBroadcastRequest ? (
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAcceptRequest(request)}
                          >
                            <Text style={styles.acceptButtonText}>Nhận chuyến</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => handleRejectRequest(request)}
                            >
                              <Text style={styles.rejectButtonText}>Từ chối</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => handleAcceptRequest(request)}
                            >
                              <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </View>
                );
                })}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.sharedContainer}>
            {loadingSharedRides ? (
              <View style={styles.sharedLoadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.sharedLoadingText}>Đang tải chuyến chia sẻ...</Text>
              </View>
            ) : (
              <>
                {/* Active Shared Ride */}
                {activeSharedRide && (
                  <TouchableOpacity
                    style={styles.activeSharedRideCard}
                    onPress={() => {
                      navigation.navigate('DriverRideDetails', {
                        rideId: activeSharedRide.rideId,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.activeSharedRideHeader}>
                      <View style={styles.activeSharedRideTitle}>
                        <Icon name="people" size={20} color="#2196F3" />
                        <Text style={styles.activeSharedRideTitleText}>Chuyến xe đang được chia sẻ</Text>
                      </View>
                      <View style={[
                        styles.activeSharedRideBadge,
                        activeSharedRide.status === 'ongoing' && styles.activeSharedRideBadgeOngoing
                      ]}>
                        <Text style={[
                          styles.activeSharedRideBadgeText,
                          activeSharedRide.status === 'ongoing' && styles.activeSharedRideBadgeTextOngoing
                        ]}>
                          {activeSharedRide.status === 'ongoing' ? 'Đang di chuyển' : 'Đang chờ'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.activeSharedRideRoute}>
                      <View style={styles.routePoint}>
                        <View style={[styles.routeDot, { backgroundColor: '#2196F3' }]} />
                        <Text style={styles.routeText}>{activeSharedRide.from}</Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routePoint}>
                        <Icon name="location-on" size={16} color="#F44336" />
                        <Text style={styles.routeText}>{activeSharedRide.to}</Text>
                      </View>
                    </View>

                    <View style={styles.activeSharedRideStats}>
                      <View style={styles.activeSharedRideStat}>
                        <Text style={styles.activeSharedRideStatLabel}>Thời gian</Text>
                        <Text style={styles.activeSharedRideStatValue}>
                          {activeSharedRide.scheduledTime}
                        </Text>
                      </View>
                      <View style={styles.activeSharedRideStat}>
                        <Text style={styles.activeSharedRideStatLabel}>Hành khách</Text>
                        <Text style={styles.activeSharedRideStatValue}>
                          {activeSharedRide.currentPassengers}/{activeSharedRide.maxPassengers}
                        </Text>
                      </View>
                    </View>

                    {/* Pending Join Requests */}
                    {pendingJoinRequests[activeSharedRide.rideId] && 
                     pendingJoinRequests[activeSharedRide.rideId].length > 0 && (
                      <View style={styles.pendingRequestsContainer}>
                        <Text style={styles.pendingRequestsTitle}>
                          Yêu cầu tham gia ({pendingJoinRequests[activeSharedRide.rideId].length})
                        </Text>
                        {pendingJoinRequests[activeSharedRide.rideId].map((req) => (
                          <View key={req.shared_ride_request_id || req.sharedRideRequestId} style={styles.pendingRequestCard}>
                            <View style={styles.pendingRequestHeader}>
                              <View style={styles.pendingRequestRiderInfo}>
                                <View style={styles.pendingRequestAvatar}>
                                  <Text style={styles.pendingRequestAvatarText}>
                                    {getInitials(req.rider_name || req.riderName || 'Hành khách')}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={styles.pendingRequestRiderName}>
                                    {req.rider_name || req.riderName || 'Hành khách'}
                                  </Text>
                                  <Text style={styles.pendingRequestFare}>
                                    {formatCurrency(req.total_fare || req.totalFare || req.fareAmount || 0)}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.pendingRequestActions}>
                                {req.status === 'PENDING' ? (
                                  <>
                                    <TouchableOpacity
                                      style={styles.pendingRequestRejectButton}
                                      onPress={() => {
                                        console.log('Rejecting request:', req);
                                        handleRejectRequest({
                                          ...req,
                                          requestId: req.shared_ride_request_id || req.sharedRideRequestId,
                                          rideId: activeSharedRide.rideId,
                                        });
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Icon name="close" size={18} color="#F44336" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.pendingRequestAcceptButton}
                                      onPress={() => {
                                        console.log('Accepting request:', req);
                                        handleAcceptRequest({
                                          ...req,
                                          requestId: req.shared_ride_request_id || req.sharedRideRequestId,
                                          rideId: activeSharedRide.rideId,
                                          pickupLocation: req.pickup_location || req.pickupLocation,
                                          dropoffLocation: req.dropoff_location || req.dropoffLocation,
                                        });
                                      }}
                                      activeOpacity={0.7}
                                    >
                                      <Icon name="check" size={18} color="#4CAF50" />
                                    </TouchableOpacity>
                                  </>
                                ) : (
                                  <View style={styles.pendingRequestExpiredBadge}>
                                    <Text style={styles.pendingRequestExpiredText}>
                                      {req.status === 'EXPIRED' ? 'Hết hạn' : req.status === 'CANCELLED' ? 'Đã hủy' : req.status}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity 
                      style={styles.viewDetailsButton}
                      onPress={() => {
                        navigation.navigate('DriverRideDetails', {
                          rideId: activeSharedRide.rideId,
                        });
                      }}
                    >
                      <Text style={styles.viewDetailsButtonText}>Xem chi tiết</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}

                {/* List of Other Shared Rides */}
                {sharedRides.length > 1 && (
                  <View style={styles.sharedRidesList}>
                    <Text style={styles.sharedRidesListTitle}>
                      Các chuyến khác ({sharedRides.length - 1})
                    </Text>
                    {sharedRides.slice(1).map((ride) => (
                      <TouchableOpacity
                        key={ride.rideId}
                        style={styles.sharedRideCard}
                        onPress={() => {
                          navigation.navigate('DriverRideDetails', {
                            rideId: ride.rideId || ride.shared_ride_id || ride.sharedRideId,
                          });
                        }}
                      >
                        <View style={styles.sharedRideCardHeader}>
                          <View style={styles.sharedRideCardRoute}>
                            <View style={styles.routePoint}>
                              <View style={styles.routeDot} />
                              <Text style={styles.routeText} numberOfLines={1}>{ride.from}</Text>
                            </View>
                            <View style={styles.routeLine} />
                            <View style={styles.routePoint}>
                              <Icon name="location-on" size={14} color="#F44336" />
                              <Text style={styles.routeText} numberOfLines={1}>{ride.to}</Text>
                            </View>
                          </View>
                          <View style={[
                            styles.sharedRideStatusBadge,
                            ride.status === 'ONGOING' && styles.sharedRideStatusBadgeOngoing
                          ]}>
                            <Text style={[
                              styles.sharedRideStatusText,
                              ride.status === 'ONGOING' && styles.sharedRideStatusTextOngoing
                            ]}>
                              {ride.status === 'ONGOING' ? 'Đang di chuyển' : 'Đang chờ'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.sharedRideCardFooter}>
                          <View style={styles.sharedRideCardInfo}>
                            <Icon name="access-time" size={14} color="#666" />
                            <Text style={styles.sharedRideCardInfoText}>{ride.scheduledTime}</Text>
                            <Text style={styles.sharedRideCardInfoDot}>•</Text>
                            <Icon name="people" size={14} color="#666" />
                            <Text style={styles.sharedRideCardInfoText}>
                              {ride.currentPassengers}/{ride.maxPassengers}
                            </Text>
                          </View>
                          <Icon name="chevron-right" size={20} color="#999" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Create Shared Ride */}
                <LinearGradient
                  colors={['#2196F3', '#9C27B0']}
                  style={styles.createSharedRideCard}
                >
                  <View style={styles.createSharedRideHeader}>
                    <View style={styles.createSharedRideIcon}>
                      <Icon name="people" size={24} color="#fff" />
                    </View>
                    <Text style={styles.createSharedRideTitle}>Chia sẻ chuyến đi</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.createSharedRideButton}
                    onPress={() => navigation.navigate('CreateSharedRide')}
                  >
                    <Text style={styles.createSharedRideButtonText}>Chia sẻ chuyến đi</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Ride Offer Modal */}
      {showOfferModal && currentOffer && (
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
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userRole: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  notificationButton: {
    padding: 8,
    position: 'relative',
    minWidth: 40,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  onlineToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  onlineStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  earningsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  earningsCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  earningsHeader: {
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  earningsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earningsStatText: {
    fontSize: 14,
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  offlineContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  offlineIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  offlineDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  goOnlineButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  goOnlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestsContainer: {
    marginTop: 16,
  },
  requestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requestsCount: {
    fontSize: 14,
    color: '#666',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  requestsList: {
    gap: 12,
    marginTop: 8,
  },
  broadcastCard: {
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  broadcastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  broadcastBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  riderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  riderRating: {
    fontSize: 12,
    color: '#666',
  },
  riderMetaDot: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 4,
  },
  rideTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  rideTypeShared: {
    backgroundColor: '#E3F2FD',
  },
  rideTypeDirect: {
    backgroundColor: '#F3E5F5',
  },
  rideTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rideTypeTextShared: {
    color: '#2196F3',
  },
  rideTypeTextDirect: {
    color: '#9C27B0',
  },
  requestPrice: {
    alignItems: 'flex-end',
  },
  requestPriceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  requestDistance: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  requestRoute: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginRight: 8,
    marginTop: 2,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E0E0E0',
    marginLeft: 5,
    marginBottom: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  requestTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  requestTimeText: {
    fontSize: 12,
    color: '#666',
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  sharedContainer: {
    marginTop: 16,
    gap: 16,
  },
  sharedLoadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedLoadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  activeSharedRideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeSharedRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeSharedRideTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeSharedRideTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activeSharedRideBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
  },
  activeSharedRideBadgeOngoing: {
    backgroundColor: '#E8F5E9',
  },
  activeSharedRideBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  activeSharedRideBadgeTextOngoing: {
    color: '#4CAF50',
  },
  activeSharedRideRoute: {
    marginBottom: 12,
  },
  activeSharedRideStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  activeSharedRideStat: {
    alignItems: 'center',
  },
  activeSharedRideStatLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  activeSharedRideStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  pendingRequestsContainer: {
    marginTop: 16,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  pendingRequestsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pendingRequestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pendingRequestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pendingRequestRiderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  pendingRequestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  pendingRequestRiderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  pendingRequestFare: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  pendingRequestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingRequestRejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestAcceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestExpiredBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  pendingRequestExpiredText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  viewDetailsButton: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  viewDetailsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createSharedRideCard: {
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  createSharedRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  createSharedRideIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createSharedRideTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  createSharedRideButton: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
  },
  createSharedRideButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  sharedRidesList: {
    marginTop: 16,
  },
  sharedRidesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sharedRideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sharedRideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sharedRideCardRoute: {
    flex: 1,
    marginRight: 12,
  },
  sharedRideStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  sharedRideStatusBadgeOngoing: {
    backgroundColor: '#E8F5E9',
  },
  sharedRideStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
  },
  sharedRideStatusTextOngoing: {
    color: '#4CAF50',
  },
  sharedRideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  sharedRideCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sharedRideCardInfoText: {
    fontSize: 12,
    color: '#666',
  },
  sharedRideCardInfoDot: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 4,
  },
});

export default DriverHomeScreen;

