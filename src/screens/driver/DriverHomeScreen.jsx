import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  RefreshControl,
  TextInput,
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
import paymentService from '../../services/paymentService';
import { locationStorageService } from '../../services/locationStorageService';
import RideOfferModal from '../../components/RideOfferModal';
import notificationService from '../../services/notificationService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors, typography, spacing } from '../../theme/designTokens';
import * as Animatable from 'react-native-animatable';

const { width } = Dimensions.get('window');

const extractAmount = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object') {
    if (typeof value.amount === 'number') return value.amount;
    if (typeof value.amount === 'string') {
      const parsed = parseFloat(value.amount);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

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
  const [pendingJoinRequests, setPendingJoinRequests] = useState({}); // { rideId: [requests] }
  const [sharedStartLocationSearch, setSharedStartLocationSearch] = useState('');
  const [sharedEndLocationSearch, setSharedEndLocationSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
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

  const loadDriverStats = useCallback(async () => {
    try {
      const [earningsSummary, transactionsResponse] = await Promise.all([
        paymentService.getDriverEarnings().catch(() => null),
        paymentService.getTransactionHistory(0, 100).catch(() => null),
      ]);

      const txnList = Array.isArray(transactionsResponse?.content)
        ? transactionsResponse.content
        : Array.isArray(transactionsResponse?.data)
          ? transactionsResponse.data
          : Array.isArray(transactionsResponse)
            ? transactionsResponse
            : [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let todayAmount = 0;
      const rideIds = new Set();

      txnList.forEach((txn) => {
        if (!txn) return;
        const type = (txn.type || '').toUpperCase();
        const direction = (txn.direction || '').toUpperCase();
        if (type !== 'CAPTURE_FARE' || direction !== 'IN') return;

        const createdRaw = txn.createdAt || txn.created_at;
        if (!createdRaw) return;
        const createdAt = new Date(createdRaw);
        if (Number.isNaN(createdAt.getTime()) || createdAt < todayStart) return;

        const amount = extractAmount(txn.amount);
        if (Number.isFinite(amount)) {
          todayAmount += amount;
        }

        const rideKey =
          txn.sharedRideId ||
          txn.shared_ride_id ||
          txn.sharedRideRequestId ||
          txn.shared_ride_request_id;
        if (rideKey) {
          rideIds.add(rideKey);
        }
      });

      const ratingValue =
        authService.getCurrentUser()?.driver_profile?.rating_average;

      setDriverStats((prev) => ({
        ...prev,
        todayEarnings: todayAmount,
        totalRides: rideIds.size,
        rating: typeof ratingValue === 'number' ? ratingValue : prev.rating,
        balance:
          extractAmount(earningsSummary?.availableBalance) ?? prev.balance,
      }));
    } catch (error) {
      console.error('Failed to load driver stats:', error);
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

  useEffect(() => {
    loadDriverStats();
  }, [loadDriverStats]);

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
      loadDriverStats();
    }, [fetchUnreadCount, loadDriverStats])
  );

  const initializeDriver = async () => {
    try {
      setLoading(true);
      
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
      if (currentUser?.driver_profile?.rating_average) {
        setDriverStats((prev) => ({
          ...prev,
          rating: currentUser.driver_profile.rating_average,
        }));
      }
      
      const locationData = await locationStorageService.getCurrentLocationWithAddress();
      if (locationData.location) {
        setCurrentLocation(locationData.location);
      }
      
      await loadVehicles();
      await loadDriverStats();
      
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
          
          const fromLabel =
            getLocationLabel(ride.start_location) ||
            getLocationLabel(ride.startLocation) ||
            'Điểm đi';
          const toLabel =
            getLocationLabel(ride.end_location) ||
            getLocationLabel(ride.endLocation) ||
            'Điểm đến';

          const startSearchFields = buildSearchFields(fromLabel, [
            ride.start_location?.name,
            ride.start_location?.address,
            ride.start_location?.description,
            ride.startLocationName,
            ride.pickup_location?.name,
            ride.pickup_location?.address,
          ]);

          const endSearchFields = buildSearchFields(toLabel, [
            ride.end_location?.name,
            ride.end_location?.address,
            ride.end_location?.description,
            ride.endLocationName,
            ride.dropoff_location?.name,
            ride.dropoff_location?.address,
          ]);

          return {
            rideId: rideId,
            from: fromLabel,
            to: toLabel,
            scheduledTime: formatScheduledTime(ride.scheduled_time || ride.scheduledTime),
            currentPassengers: currentPassengers,
            maxPassengers: maxPassengers, // Always 1
            status: ride.status,
            baseFare: ride.base_fare || ride.baseFare || 0,
            raw: ride,
            pendingRequests: pendingRequests,
            searchStartFields: startSearchFields,
            searchEndFields: endSearchFields,
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

  const handleSharedRideSearchChange = (type, value) => {
    if (type === 'start') {
      setSharedStartLocationSearch(value);
    } else {
      setSharedEndLocationSearch(value);
    }
  };

  const clearSharedRideSearch = () => {
    setSharedStartLocationSearch('');
    setSharedEndLocationSearch('');
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

      return date.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting scheduled time:', error, scheduledTime);
      return 'Ngay lập tức';
    }
  };

  const normalizeText = (value) => {
    if (typeof value !== 'string') return '';
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const buildSearchFields = (label, additional = []) => {
    const fields = [];
    if (typeof label === 'string' && label.trim()) {
      fields.push(label);
    }
    additional.forEach((item) => {
      if (typeof item === 'string' && item.trim()) {
        fields.push(item);
      }
    });
    return fields;
  };

  const rideMatchesSearch = (ride, startKeyword, endKeyword) => {
    const normalizedStart = normalizeText(startKeyword);
    const normalizedEnd = normalizeText(endKeyword);

    const startMatch =
      !normalizedStart ||
      (ride.searchStartFields || []).some((field) =>
        normalizeText(field).includes(normalizedStart)
      );

    const endMatch =
      !normalizedEnd ||
      (ride.searchEndFields || []).some((field) =>
        normalizeText(field).includes(normalizedEnd)
      );

    return startMatch && endMatch;
  };

  const filteredSharedRides = useMemo(() => {
    const startKeyword = sharedStartLocationSearch.trim();
    const endKeyword = sharedEndLocationSearch.trim();

    if (!startKeyword && !endKeyword) {
      return sharedRides;
    }

    return sharedRides.filter((ride) =>
      rideMatchesSearch(ride, startKeyword, endKeyword)
    );
  }, [sharedRides, sharedStartLocationSearch, sharedEndLocationSearch]);

  const activeSharedRide = filteredSharedRides.length > 0 ? filteredSharedRides[0] : null;
  const otherSharedRides = activeSharedRide
    ? filteredSharedRides.slice(1)
    : [];
  const isFilteringSharedRides =
    sharedStartLocationSearch.trim().length > 0 ||
    sharedEndLocationSearch.trim().length > 0;

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
    const fareAmount = extractFare(
      offer.totalFare ||
      offer.total_fare ||
      offer.fareAmount ||
      offer.fare_amount ||
      offer.fare?.total ||
      offer.fare?.amount ||
      offer.estimatedFare ||
      offer.totalFare?.amount ||
      offer.total_fare?.amount
    ) || 0;
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
          pickup: offer.pickupAddress || offer.pickupLocationName || offer.pickup_location_name || offer.pickup_location?.name || offer.pickup?.address || offer.pickup?.name || 'Điểm đón',
          dropoff: offer.dropoffAddress || offer.dropoffLocationName || offer.dropoff_location_name || offer.dropoff_location?.name || offer.dropoff?.address || offer.dropoff?.name || 'Điểm đến',
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
    
    // Resolve names without letting "N/A" override real names
    const resolvedPickupName =
      (typeof offer.pickupLocationName === 'string' && offer.pickupLocationName.toUpperCase() !== 'N/A' && offer.pickupLocationName) ||
      (typeof offer.pickup_location_name === 'string' && offer.pickup_location_name.toUpperCase() !== 'N/A' && offer.pickup_location_name) ||
      (offer.pickup_location && offer.pickup_location.name) ||
      (offer.pickup && offer.pickup.name) ||
      (offer.pickup && offer.pickup.address) ||
      null;

    const resolvedDropoffName =
      (typeof offer.dropoffLocationName === 'string' && offer.dropoffLocationName.toUpperCase() !== 'N/A' && offer.dropoffLocationName) ||
      (typeof offer.dropoff_location_name === 'string' && offer.dropoff_location_name.toUpperCase() !== 'N/A' && offer.dropoff_location_name) ||
      (offer.dropoff_location && offer.dropoff_location.name) ||
      (offer.dropoff && offer.dropoff.name) ||
      (offer.dropoff && offer.dropoff.address) ||
      null;

    // Show modal for real-time popup (ALWAYS show, not just when !showOfferModal)
    const offerData = {
      id: offer.id || offer.requestId || Date.now(),
      requestId: offer.requestId || offer.request_id,
      rideId: offer.rideId || offer.ride_id,
      riderName: offer.riderName || 'Hành khách',
      riderRating: offer.riderRating || 5.0,
      pickup_location: offer.pickup_location || offer.pickupLocation,
      dropoff_location: offer.dropoff_location || offer.dropoffLocation,
      pickupLocationName: resolvedPickupName || offer.pickupAddress || offer.pickup_address || 'Điểm đón',
      dropoffLocationName: resolvedDropoffName || offer.dropoffAddress || offer.dropoff_address || 'Điểm đến',
      pickupLat: offer.pickupLat || offer.pickup_lat || offer.pickup_location?.lat || offer.pickup?.lat,
      pickupLng: offer.pickupLng || offer.pickup_lng || offer.pickup_location?.lng || offer.pickup?.lng,
      dropoffLat: offer.dropoffLat || offer.dropoff_lat || offer.dropoff_location?.lat || offer.dropoff?.lat,
      dropoffLng: offer.dropoffLng || offer.dropoff_lng || offer.dropoff_location?.lng || offer.dropoff?.lng,
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

    if (accepted) {
      loadDriverStats();
    }
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadDriverStats(),
      fetchUnreadCount(),
      isOnline && activeTab === 'requests' ? loadBroadcastRequests() : Promise.resolve(),
      isOnline && activeTab === 'shared' ? loadSharedRides() : Promise.resolve(),
    ]);
    setRefreshing(false);
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
    <AppBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
          }
        >
          <View style={styles.headerSpacing}>
            <GlassHeader
              title={user?.user?.full_name || user?.fullName || 'Tài xế'}
              subtitle={`Tài xế • ${isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}`}
              onBellPress={() => navigation.navigate('Notifications')}
              badgeCount={unreadCount}
            />
          </View>

          <View style={styles.content}>
            {/* Online Toggle */}
            <Animatable.View animation="fadeInUp" duration={400} delay={60}>
              <CleanCard style={styles.onlineToggleCard} contentStyle={styles.onlineToggleCardContent}>
                <View style={styles.onlineToggleContainer}>
                  <View style={styles.onlineStatus}>
                    <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
                    <Text style={styles.onlineStatusText}>
                      {isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
                    </Text>
                  </View>
                  <Switch
                    value={isOnline}
                    onValueChange={handleToggleOnline}
                    trackColor={{ false: '#E5E7EB', true: '#D1FAE5' }}
                    thumbColor={isOnline ? '#22C55E' : '#9CA3AF'}
                  />
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Earnings Summary */}
            <Animatable.View animation="fadeInUp" duration={400} delay={120}>
              <CleanCard style={styles.earningsCard} contentStyle={styles.earningsCardContent}>
                <View style={styles.earningsHeader}>
                  <View>
                    <Text style={styles.earningsLabel}>Thu nhập hôm nay</Text>
                    <Text style={styles.earningsAmount}>
                      {formatCurrency(driverStats.todayEarnings)}
                    </Text>
                  </View>
                  <View style={[styles.earningsIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Icon name="account-balance-wallet" size={24} color={colors.primary} />
                  </View>
                </View>
                
                <View style={styles.earningsFooter}>
                  <View style={styles.earningsStat}>
                    <View style={[styles.earningsStatIcon, { backgroundColor: '#E3F2FD' }]}>
                      <Icon name="directions-car" size={14} color="#2196F3" />
                    </View>
                    <Text style={styles.earningsStatText}>{driverStats.totalRides} chuyến</Text>
                  </View>
                  <View style={styles.earningsStat}>
                    <View style={[styles.earningsStatIcon, { backgroundColor: '#FFF4E6' }]}>
                      <Icon name="star" size={14} color="#FF9800" />
                    </View>
                    <Text style={styles.earningsStatText}>{driverStats.rating.toFixed(1)}</Text>
                  </View>
                  <View style={styles.earningsStat}>
                    <View style={[styles.earningsStatIcon, { backgroundColor: '#E8F5E9' }]}>
                      <Icon name="account-balance-wallet" size={14} color={colors.primary} />
                    </View>
                    <Text style={styles.earningsStatText}>{formatCurrency(driverStats.balance)}</Text>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Tab Switcher */}
            <Animatable.View animation="fadeInUp" duration={400} delay={180}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContainer}
              >
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
                  onPress={() => setActiveTab('requests')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
                    Yêu cầu
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
                  onPress={() => setActiveTab('shared')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, activeTab === 'shared' && styles.tabTextActive]}>
                    Chuyến chia sẻ
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </Animatable.View>

            {/* Main Content */}
            <View style={styles.mainContent}>
        {!isOnline ? (
          <Animatable.View animation="fadeInUp" duration={400} delay={240}>
            <CleanCard style={styles.offlineContainer} contentStyle={styles.offlineContainerContent}>
              <View style={styles.offlineIcon}>
                <Icon name="navigation" size={56} color={colors.textMuted} />
              </View>
              <Text style={styles.offlineTitle}>Bạn đang ngoại tuyến</Text>
              <Text style={styles.offlineDescription}>
                Bật trạng thái hoạt động để nhận yêu cầu chuyến đi
              </Text>
              <TouchableOpacity
                style={styles.goOnlineButton}
                onPress={() => handleToggleOnline(true)}
                activeOpacity={0.8}
              >
                <Icon name="power-settings-new" size={20} color="#FFFFFF" />
                <Text style={styles.goOnlineButtonText}>Bắt đầu nhận chuyến</Text>
              </TouchableOpacity>
            </CleanCard>
          </Animatable.View>
        ) : activeTab === 'requests' ? (
          <View style={styles.requestsContainer}>
            <View style={styles.requestsHeader}>
              <Text style={styles.requestsTitle}>Yêu cầu chuyến đi</Text>
              {totalRequests > 0 && (
                <View style={styles.requestsHeaderActions}>
                  <Text style={styles.requestsCount}>{totalRequests}</Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={loadBroadcastRequests}
                    disabled={loadingBroadcastRequests}
                    activeOpacity={0.7}
                  >
                    {loadingBroadcastRequests ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Icon name="refresh" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            {totalRequests === 0 ? (
              <Animatable.View animation="fadeInUp" duration={400} delay={300}>
                <CleanCard style={styles.emptyState} contentStyle={styles.emptyStateContent}>
                  <View style={styles.emptyIcon}>
                    <Icon name="inbox" size={56} color={colors.textMuted} />
                  </View>
                  <Text style={styles.emptyStateTitle}>Chưa có yêu cầu nào</Text>
                  <Text style={styles.emptyStateSubtext}>
                    Bạn sẽ nhận được thông báo hoặc có thể làm mới để xem yêu cầu mới
                  </Text>
                </CleanCard>
              </Animatable.View>
            ) : (
              <View style={styles.requestsList}>
                {combinedRequests.map((request, index) => {
                  const isBroadcastRequest = request.broadcast === true;
                  const requestKey = `request-${request.id}`;
                  const priceAmount = request.fare || request.fareAmount || request.total_fare || 0;
                  return (
                  <Animatable.View
                    key={requestKey}
                    animation="fadeInUp"
                    duration={400}
                    delay={300 + index * 40}
                  >
                  <CleanCard style={styles.requestCard} contentStyle={styles.requestCardContent}>
                    <View style={styles.requestTop}>
                      <View style={styles.riderInfo}>
                        <View style={styles.riderAvatar}>
                          <Text style={styles.riderAvatarText}>
                            {getInitials(request.rider)}
                          </Text>
                        </View>
                        <View style={styles.riderDetails}>
                          <Text style={styles.riderName}>{request.rider}</Text>
                          <View style={styles.riderMeta}>
                            <Icon name="star" size={12} color="#F59E0B" />
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
                                <Icon name="campaign" size={12} color="#3B82F6" />
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
                      </View>
                    </View>

                    <View style={styles.requestRoute}>
                      <View style={styles.routeItem}>
                        <View style={styles.routeDot} />
                        <Text style={styles.routeText} numberOfLines={1}>{request.pickup}</Text>
                      </View>
                      <View style={styles.routeLine} />
                      <View style={styles.routeItem}>
                        <Icon name="location-on" size={12} color="#EF4444" />
                        <Text style={styles.routeText} numberOfLines={1}>{request.dropoff}</Text>
                      </View>
                    </View>

                    <View style={styles.requestActions}>
                      <View style={styles.requestTime}>
                        <Icon name="access-time" size={12} color={colors.textMuted} />
                        <Text style={styles.requestTimeText}>{request.time}</Text>
                      </View>
                      <View style={styles.requestButtons}>
                        {isBroadcastRequest ? (
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAcceptRequest(request)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.acceptButtonText}>Nhận chuyến</Text>
                          </TouchableOpacity>
                        ) : (
                          <>
                            <TouchableOpacity
                              style={styles.rejectButton}
                              onPress={() => handleRejectRequest(request)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.rejectButtonText}>Từ chối</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.acceptButton}
                              onPress={() => handleAcceptRequest(request)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.acceptButtonText}>Chấp nhận</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    </View>
                  </CleanCard>
                  </Animatable.View>
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
                <View style={styles.sharedSearchContainer}>
                  <CleanCard style={styles.sharedSearchCard} contentStyle={styles.sharedSearchCardContent}>
                    <View style={styles.sharedSearchInputContainer}>
                      <Icon name="location-on" size={20} color={colors.primary} style={styles.sharedSearchIcon} />
                      <TextInput
                        style={styles.sharedSearchInput}
                        placeholder="Tìm theo điểm đi..."
                        placeholderTextColor={colors.textMuted}
                        value={sharedStartLocationSearch}
                        onChangeText={(value) => handleSharedRideSearchChange('start', value)}
                        returnKeyType="next"
                      />
                      {sharedStartLocationSearch.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setSharedStartLocationSearch('')}
                          style={styles.sharedClearButton}
                        >
                          <Icon name="close" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.sharedSearchInputContainer}>
                      <Icon name="location-on" size={20} color="#F44336" style={styles.sharedSearchIcon} />
                      <TextInput
                        style={styles.sharedSearchInput}
                        placeholder="Tìm theo điểm đến..."
                        placeholderTextColor={colors.textMuted}
                        value={sharedEndLocationSearch}
                        onChangeText={(value) => handleSharedRideSearchChange('end', value)}
                        returnKeyType="search"
                        onSubmitEditing={loadSharedRides}
                      />
                      {sharedEndLocationSearch.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setSharedEndLocationSearch('')}
                          style={styles.sharedClearButton}
                        >
                          <Icon name="close" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.sharedSearchActions}>
                      {isFilteringSharedRides && (
                        <TouchableOpacity
                          style={styles.sharedClearAllButton}
                          onPress={clearSharedRideSearch}
                          activeOpacity={0.7}
                        >
                          <Icon name="clear" size={18} color={colors.textSecondary} />
                          <Text style={styles.sharedClearAllText}>Xóa</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.sharedSearchButton}
                        onPress={loadSharedRides}
                        activeOpacity={0.8}
                      >
                        <Icon name="search" size={20} color="#fff" />
                        <Text style={styles.sharedSearchButtonText}>Tìm kiếm</Text>
                      </TouchableOpacity>
                    </View>
                  </CleanCard>
                </View>

                {filteredSharedRides.length === 0 ? (
                  <View style={styles.sharedEmptyCardContainer}>
                    <View style={styles.sharedEmptyCard}>
                      <Icon name="travel-explore" size={40} color={colors.textMuted} />
                      <Text style={styles.sharedEmptyText}>
                        {isFilteringSharedRides
                          ? 'Không tìm thấy chuyến phù hợp'
                          : 'Bạn chưa có chuyến chia sẻ nào'}
                      </Text>
                      <Text style={styles.sharedEmptySubtext}>
                        {isFilteringSharedRides
                          ? 'Thử đổi lại từ khóa điểm đi/đến'
                          : 'Tạo chuyến mới để bắt đầu chia sẻ'}
                      </Text>
                      {isFilteringSharedRides && (
                        <TouchableOpacity
                          style={styles.sharedFilterResetButton}
                          onPress={clearSharedRideSearch}
                          activeOpacity={0.8}
                        >
                          <Icon name="restart-alt" size={18} color="#fff" />
                          <Text style={styles.sharedFilterResetButtonText}>Đặt lại bộ lọc</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (
                  <>
                    {activeSharedRide && (
                      <Animatable.View animation="fadeInUp" duration={400} delay={300}>
                        <CleanCard style={styles.activeSharedRideCard} contentStyle={styles.activeSharedRideCardContent}>
                          <TouchableOpacity
                            onPress={() => {
                              navigation.navigate('DriverRideDetails', {
                                rideId: activeSharedRide.rideId,
                              });
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.activeSharedRideHeader}>
                              <View style={styles.activeSharedRideTitle}>
                                <View style={[styles.activeSharedRideIcon, { backgroundColor: '#EFF6FF' }]}>
                                  <Icon name="people" size={18} color="#3B82F6" />
                                </View>
                                <View style={styles.activeSharedRideTitleText}>
                                  <Text style={styles.activeSharedRideTitleMain}>Chuyến xe đang được chia sẻ</Text>
                                  <View style={[
                                    styles.activeSharedRideBadge,
                                    activeSharedRide.status === 'ONGOING' && styles.activeSharedRideBadgeOngoing
                                  ]}>
                                    <Text style={[
                                      styles.activeSharedRideBadgeText,
                                      activeSharedRide.status === 'ONGOING' && styles.activeSharedRideBadgeTextOngoing
                                    ]}>
                                      {activeSharedRide.status === 'ONGOING' ? 'Đang di chuyển' : 'Đang chờ'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>

                            <View style={styles.activeSharedRideRoute}>
                              <View style={styles.routeItem}>
                                <View style={styles.routeDot} />
                                <Text style={styles.routeText} numberOfLines={1}>{activeSharedRide.from}</Text>
                              </View>
                              <View style={styles.routeLine} />
                              <View style={styles.routeItem}>
                                <Icon name="location-on" size={12} color="#EF4444" />
                                <Text style={styles.routeText} numberOfLines={1}>{activeSharedRide.to}</Text>
                              </View>
                            </View>

                            <View style={styles.activeSharedRideStats}>
                              <View style={styles.activeSharedRideStat}>
                                <Icon name="access-time" size={14} color={colors.textMuted} />
                                <Text style={styles.activeSharedRideStatValue}>
                                  {activeSharedRide.scheduledTime}
                                </Text>
                              </View>
                              <View style={styles.activeSharedRideStatDivider} />
                              <View style={styles.activeSharedRideStat}>
                                <Icon name="people" size={14} color={colors.textMuted} />
                                <Text style={styles.activeSharedRideStatValue}>
                                  {activeSharedRide.currentPassengers}/{activeSharedRide.maxPassengers}
                                </Text>
                              </View>
                            </View>

                            {pendingJoinRequests[activeSharedRide.rideId] && 
                             pendingJoinRequests[activeSharedRide.rideId].length > 0 && (
                              <View style={styles.pendingRequestsContainer}>
                                <Text style={styles.pendingRequestsTitle}>
                                  Yêu cầu tham gia ({pendingJoinRequests[activeSharedRide.rideId].length})
                                </Text>
                                {pendingJoinRequests[activeSharedRide.rideId].map((req) => (
                                  <CleanCard key={req.shared_ride_request_id || req.sharedRideRequestId} style={styles.pendingRequestCard} contentStyle={styles.pendingRequestCardContent}>
                                    <View style={styles.pendingRequestHeader}>
                                      <View style={styles.pendingRequestRiderInfo}>
                                        <View style={styles.pendingRequestAvatar}>
                                          <Text style={styles.pendingRequestAvatarText}>
                                            {getInitials(req.rider_name || req.riderName || 'Hành khách')}
                                          </Text>
                                        </View>
                                        <View style={styles.pendingRequestDetails}>
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
                                                handleRejectRequest({
                                                  ...req,
                                                  requestId: req.shared_ride_request_id || req.sharedRideRequestId,
                                                  rideId: activeSharedRide.rideId,
                                                });
                                              }}
                                              activeOpacity={0.7}
                                            >
                                              <Icon name="close" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.pendingRequestAcceptButton}
                                              onPress={() => {
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
                                              <Icon name="check" size={16} color="#22C55E" />
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
                                  </CleanCard>
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
                              activeOpacity={0.8}
                            >
                              <Text style={styles.viewDetailsButtonText}>Xem chi tiết</Text>
                              <Icon name="chevron-right" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        </CleanCard>
                      </Animatable.View>
                    )}

                    {otherSharedRides.length > 0 && (
                      <View style={styles.sharedRidesList}>
                        <Text style={styles.sharedRidesListTitle}>
                          Các chuyến khác ({otherSharedRides.length})
                        </Text>
                        {otherSharedRides.map((ride, index) => (
                          <Animatable.View
                            key={ride.rideId}
                            animation="fadeInUp"
                            duration={400}
                            delay={360 + index * 40}
                          >
                            <CleanCard style={styles.sharedRideCard} contentStyle={styles.sharedRideCardContent}>
                              <TouchableOpacity
                                onPress={() => {
                                  navigation.navigate('DriverRideDetails', {
                                    rideId: ride.rideId || ride.shared_ride_id || ride.sharedRideId,
                                  });
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={styles.sharedRideCardHeader}>
                                  <View style={styles.sharedRideCardRoute}>
                                    <View style={styles.routeItem}>
                                      <View style={styles.routeDot} />
                                      <Text style={styles.routeText} numberOfLines={1}>{ride.from}</Text>
                                    </View>
                                    <View style={styles.routeLine} />
                                    <View style={styles.routeItem}>
                                      <Icon name="location-on" size={12} color="#EF4444" />
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
                                    <Icon name="access-time" size={12} color={colors.textMuted} />
                                    <Text style={styles.sharedRideCardInfoText}>{ride.scheduledTime}</Text>
                                    <Text style={styles.sharedRideCardInfoDot}>•</Text>
                                    <Icon name="people" size={12} color={colors.textMuted} />
                                    <Text style={styles.sharedRideCardInfoText}>
                                      {ride.currentPassengers}/{ride.maxPassengers}
                                    </Text>
                                  </View>
                                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                                </View>
                              </TouchableOpacity>
                            </CleanCard>
                          </Animatable.View>
                        ))}
                      </View>
                    )}
                  </>
                )}

                {/* Create Shared Ride */}
                <Animatable.View animation="fadeInUp" duration={400} delay={300}>
                  <CleanCard style={styles.createSharedRideCard} contentStyle={styles.createSharedRideCardContent}>
                    <View style={styles.createSharedRideHeader}>
                      <View style={[styles.createSharedRideIcon, { backgroundColor: '#E3F2FD' }]}>
                        <Icon name="people" size={24} color="#2196F3" />
                      </View>
                      <View style={styles.createSharedRideInfo}>
                        <Text style={styles.createSharedRideTitle}>Chia sẻ chuyến đi</Text>
                        <Text style={styles.createSharedRideSubtitle}>
                          Tạo chuyến đi và mời hành khách tham gia
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.createSharedRideButton}
                      onPress={() => navigation.navigate('CreateSharedRide')}
                      activeOpacity={0.8}
                    >
                      <Icon name="add" size={20} color="#FFFFFF" />
                      <Text style={styles.createSharedRideButtonText}>Chia sẻ chuyến đi</Text>
                    </TouchableOpacity>
                  </CleanCard>
                </Animatable.View>
              </>
            )}
          </View>
        )}
            </View>
          </View>
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
    </AppBackground>
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
  onlineToggleCard: {
    marginBottom: spacing.md,
  },
  onlineToggleCardContent: {
    padding: spacing.md,
  },
  onlineToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  onlineStatusText: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  earningsCard: {
    marginBottom: spacing.md,
  },
  earningsCardContent: {
    padding: spacing.lg,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  earningsLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  earningsIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  earningsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  earningsStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsStatText: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  tabsContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  scrollContent: {
    paddingBottom: 160,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  mainContent: {
    paddingTop: spacing.sm,
  },
  offlineContainer: {
    marginBottom: spacing.md,
  },
  offlineContainerContent: {
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  offlineIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  offlineTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  offlineDescription: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  goOnlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 16,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  goOnlineButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
  },
  requestsContainer: {
    marginTop: 16,
  },
  requestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  requestsHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestsTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  requestsCount: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
  },
  refreshButton: {
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  emptyState: {
    marginBottom: spacing.sm,
  },
  emptyStateContent: {
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyStateTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  emptyStateSubtext: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  requestsList: {
    gap: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  requestCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  riderDetails: {
    flex: 1,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  riderAvatarText: {
    color: colors.primary,
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  riderName: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  riderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  riderRating: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  riderMetaDot: {
    fontSize: typography.small,
    color: colors.textMuted,
  },
  rideTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rideTypeShared: {
    backgroundColor: '#EFF6FF',
  },
  rideTypeDirect: {
    backgroundColor: '#F5F3FF',
  },
  rideTypeText: {
    fontSize: typography.small - 1,
    fontFamily: 'Inter_600SemiBold',
  },
  rideTypeTextShared: {
    color: '#3B82F6',
  },
  rideTypeTextDirect: {
    color: '#8B5CF6',
  },
  broadcastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  broadcastBadgeText: {
    fontSize: typography.small - 1,
    fontFamily: 'Inter_600SemiBold',
    color: '#3B82F6',
  },
  requestPrice: {
    alignItems: 'flex-end',
  },
  requestPriceAmount: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  requestRoute: {
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  routeLine: {
    width: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    marginLeft: 2,
  },
  routeText: {
    flex: 1,
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  requestTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  requestTimeText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  rejectButtonText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  acceptButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  acceptButtonText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  sharedContainer: {
    marginTop: 16,
    gap: 16,
  },
  sharedSearchContainer: {
    marginBottom: spacing.sm,
  },
  sharedSearchCard: {
    borderRadius: 16,
  },
  sharedSearchCardContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sharedSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  sharedSearchIcon: {
    marginRight: spacing.xs,
  },
  sharedSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  sharedClearButton: {
    padding: 4,
  },
  sharedSearchActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  sharedClearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  sharedClearAllText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sharedSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sharedSearchButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  sharedEmptyCardContainer: {
    alignItems: 'center',
  },
  sharedEmptyCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  sharedEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  sharedEmptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sharedFilterResetButton: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sharedFilterResetButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeSharedRideCard: {
    marginBottom: spacing.sm,
  },
  activeSharedRideCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  activeSharedRideHeader: {
    marginBottom: spacing.sm,
  },
  activeSharedRideTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeSharedRideIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeSharedRideTitleText: {
    flex: 1,
  },
  activeSharedRideTitleMain: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  activeSharedRideBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  activeSharedRideBadgeOngoing: {
    backgroundColor: '#ECFDF5',
  },
  activeSharedRideBadgeText: {
    fontSize: typography.small - 1,
    fontFamily: 'Inter_600SemiBold',
    color: '#3B82F6',
  },
  activeSharedRideBadgeTextOngoing: {
    color: '#22C55E',
  },
  activeSharedRideRoute: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  activeSharedRideStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: spacing.md,
  },
  activeSharedRideStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activeSharedRideStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
  },
  activeSharedRideStatValue: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  pendingRequestsContainer: {
    marginTop: spacing.md,
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pendingRequestsTitle: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  pendingRequestCard: {
    marginBottom: 0,
  },
  pendingRequestCardContent: {
    padding: spacing.sm,
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
    gap: spacing.sm,
  },
  pendingRequestAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestAvatarText: {
    fontSize: typography.small,
    fontFamily: 'Inter_700Bold',
    color: '#3B82F6',
  },
  pendingRequestDetails: {
    flex: 1,
  },
  pendingRequestRiderName: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  pendingRequestFare: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  pendingRequestActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pendingRequestRejectButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestAcceptButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingRequestExpiredBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  pendingRequestExpiredText: {
    fontSize: typography.small - 1,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textMuted,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.md,
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    marginTop: spacing.sm,
    gap: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  viewDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
  },
  createSharedRideCard: {
    marginBottom: spacing.sm,
  },
  createSharedRideCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  createSharedRideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  createSharedRideIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createSharedRideInfo: {
    flex: 1,
  },
  createSharedRideTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  createSharedRideSubtitle: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  createSharedRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: spacing.md,
    backgroundColor: '#2196F3',
    borderRadius: 16,
    gap: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#2196F3',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  createSharedRideButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
  },
  sharedRidesList: {
    gap: spacing.sm,
  },
  sharedRidesListTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sharedRideCard: {
    marginBottom: 0,
  },
  sharedRideCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sharedRideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  sharedRideCardRoute: {
    flex: 1,
    gap: spacing.xs,
  },
  sharedRideStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  sharedRideStatusBadgeOngoing: {
    backgroundColor: '#ECFDF5',
  },
  sharedRideStatusText: {
    fontSize: typography.small - 1,
    fontFamily: 'Inter_600SemiBold',
    color: '#3B82F6',
  },
  sharedRideStatusTextOngoing: {
    color: '#22C55E',
  },
  sharedRideCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sharedRideCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sharedRideCardInfoText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  sharedRideCardInfoDot: {
    fontSize: typography.small,
    color: colors.textMuted,
  },
});

export default DriverHomeScreen;
