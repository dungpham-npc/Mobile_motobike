import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GoongMap from '../../components/GoongMap.jsx';
import { locationTrackingService } from '../../services/locationTrackingService';
import activeRideService from '../../services/activeRideService';
import rideService from '../../services/rideService';
import locationService from '../../services/LocationService';
import websocketService from '../../services/websocketService';
import goongService from '../../services/goongService';
import apiService from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import { useFocusEffect } from '@react-navigation/native';
import * as Animatable from 'react-native-animatable';

const { width, height } = Dimensions.get('window');

const DriverRideTrackingScreen = ({ route, navigation }) => {
  const { rideId, startTracking = false, rideData: initialRideData, status } = route.params || {};
  
  const [isTracking, setIsTracking] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rideData, setRideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [etaText, setEtaText] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationPhase, setSimulationPhase] = useState(null); // 'toPickup' | 'toDropoff' | null
  const [phase, setPhase] = useState('toPickup'); // 'toPickup' | 'toDropoff'
const [mapPolyline, setMapPolyline] = useState([]);
const [currentPolylineEncoded, setCurrentPolylineEncoded] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [isNearPickup, setIsNearPickup] = useState(false);
const [isNearDropoff, setIsNearDropoff] = useState(false);
const mapRef = useRef(null);
const driverMarkerRef = useRef(null);
const [markerUpdateKey, setMarkerUpdateKey] = useState(0);
const trackingSubscriptionRef = useRef(null);

  const updateMapPolylineFromEncoded = useCallback(
    (encoded, context = "tracking") => {
      if (!encoded || typeof encoded !== "string") {
        return;
      }
      setCurrentPolylineEncoded((prevEncoded) => {
        if (prevEncoded === encoded) {
          return prevEncoded;
        }
        try {
          const decodedPolyline = goongService.decodePolyline(encoded);
          const formattedPolyline = decodedPolyline.map((point) => [
            point.longitude,
            point.latitude,
          ]);
          setMapPolyline(formattedPolyline);
          console.log(
            `✅ [DriverTracking] Updated map polyline (${context}) with ${formattedPolyline.length} points`
          );
          return encoded;
        } catch (error) {
          console.error("❌ [DriverTracking] Error decoding polyline:", error);
          return prevEncoded;
        }
      });
    },
    []
  );

  const applyTrackingSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) {
        return;
      }
      if (snapshot.requestStatus) {
        const normalizedStatus = snapshot.requestStatus.toUpperCase();
        setPhase(normalizedStatus === "ONGOING" ? "toDropoff" : "toPickup");
      }
      if (
        snapshot.driverLat !== undefined &&
        snapshot.driverLat !== null &&
        snapshot.driverLng !== undefined &&
        snapshot.driverLng !== null
      ) {
        const lat = parseFloat(snapshot.driverLat);
        const lng = parseFloat(snapshot.driverLng);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          setDriverLocation({ latitude: lat, longitude: lng });
        }
      }
      if (snapshot.polyline) {
        updateMapPolylineFromEncoded(snapshot.polyline, "snapshot");
      }
      if (snapshot.estimatedArrival) {
        setEtaText(snapshot.estimatedArrival);
      }
    },
    [updateMapPolylineFromEncoded]
  );

  const fetchTrackingSnapshot = useCallback(async (targetRideId) => {
    if (!targetRideId) {
      return null;
    }
    try {
      const response = await rideService.getRideTrackingSnapshot(targetRideId);
      return response?.data ?? response;
    } catch (error) {
      console.error("❌ [DriverTracking] Error fetching tracking snapshot:", error);
      return null;
    }
  }, []);

  const syncTrackingSnapshot = useCallback(
    async (targetRideId) => {
      const data = await fetchTrackingSnapshot(targetRideId);
      if (data) {
        applyTrackingSnapshot(data);
      }
    },
    [fetchTrackingSnapshot, applyTrackingSnapshot]
  );

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Polyline decoder (Google Encoded Polyline) - precision 5
  const decodePolyline = (encoded, precision = 5) => {
    if (!encoded || typeof encoded !== 'string') return [];
    let index = 0, lat = 0, lng = 0, coordinates = [];
    const factor = Math.pow(10, precision);
    
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;
      
      // Decode longitude
      shift = 0; result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;
      
      coordinates.push({ latitude: lat / factor, longitude: lng / factor });
    }
    return coordinates;
  };

  // Track previous distance states to detect when constraint is met
  const prevIsNearPickupRef = useRef(false);
  const prevIsNearDropoffRef = useRef(false);

  // Check distance to pickup/dropoff and update button states
  useEffect(() => {
    if (!driverLocation || !rideData) return;

    const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
    const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
    const dropoffLat = rideData?.end_location?.lat || rideData?.dropoff_location?.lat || rideData?.dropoff_lat;
    const dropoffLng = rideData?.end_location?.lng || rideData?.dropoff_location?.lng || rideData?.dropoff_lng;

    if (phase === 'toPickup' && pickupLat && pickupLng) {
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupLat,
        pickupLng
      );
      const isNear = distance <= 100; // Within 100 meters
      
      // Show popup notification when constraint is met
      if (isNear && !prevIsNearPickupRef.current) {
        Alert.alert(
          'Đã đến gần điểm đón',
          `Bạn đã đến trong vòng 100m từ điểm đón. Bạn có thể nhận khách ngay bây giờ.`,
          [{ text: 'OK' }]
        );
      }
      
      setIsNearPickup(isNear);
      prevIsNearPickupRef.current = isNear;
    } else {
      setIsNearPickup(false);
      prevIsNearPickupRef.current = false;
    }

    if (phase === 'toDropoff' && dropoffLat && dropoffLng) {
      const distance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        dropoffLat,
        dropoffLng
      );
      const isNear = distance <= 100; // Within 100 meters
      
      // Show popup notification when constraint is met
      if (isNear && !prevIsNearDropoffRef.current) {
        Alert.alert(
          'Đã đến gần điểm đến',
          `Bạn đã đến trong vòng 100m từ điểm đến. Bạn có thể hoàn thành chuyến đi ngay bây giờ.`,
          [{ text: 'OK' }]
        );
      }
      
      setIsNearDropoff(isNear);
      prevIsNearDropoffRef.current = isNear;
    } else {
      setIsNearDropoff(false);
      prevIsNearDropoffRef.current = false;
    }
  }, [driverLocation, rideData, phase]);

  // Update polyline when phase changes
  useEffect(() => {
    if (!rideData) return;
    
    if (phase === 'toPickup') {
      const toPickupPolyline = rideData.polyline_from_driver_to_pickup;
      if (toPickupPolyline) {
        updateMapPolylineFromEncoded(toPickupPolyline, 'phase-toPickup');
      }
    } else if (phase === 'toDropoff') {
      const ridePolyline = rideData.polyline || rideData.route?.polyline;
      if (ridePolyline) {
        updateMapPolylineFromEncoded(ridePolyline, 'phase-toDropoff');
      }
    }
  }, [phase, rideData, updateMapPolylineFromEncoded]);

  // Listen to simulation location updates
  useEffect(() => {
    const handleSimulationUpdate = (location) => {
      if (location) {
        console.log('📍 Simulation update:', location, 'Phase:', simulationPhase);
        setDriverLocation({ 
          latitude: location.latitude, 
          longitude: location.longitude 
        });
        
        // Update map to follow driver location (recenter to current position)
        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
        }
      }
    };

    const handleSimulationComplete = () => {
      console.log('✅ [Simulation] Simulation completed, phase:', simulationPhase);
      
      // If simulation was to pickup, hardcode location to be near pickup (within 100m)
      if (simulationPhase === 'toPickup' && rideData) {
        const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
        const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
        
        if (pickupLat && pickupLng) {
          // Hardcode location to be ~50m away from pickup (within 100m threshold)
          // Add a small offset (approximately 50 meters in degrees)
          const offsetLat = 0.00045; // ~50 meters
          const offsetLng = 0.00045; // ~50 meters
          
          const finalLocation = {
            latitude: pickupLat + offsetLat,
            longitude: pickupLng + offsetLng,
          };
          
          console.log('📍 [Simulation] Hardcoding location near pickup:', finalLocation);
          setDriverLocation(finalLocation);
          
          // Ensure phase stays as 'toPickup'
          setPhase('toPickup');
          
          Alert.alert(
            'Đã đến điểm đón',
            'Giả lập đã hoàn thành. Bạn đã ở gần điểm đón và có thể nhận khách.',
            [{ text: 'OK' }]
          );
        }
      }
      
      setIsSimulating(false);
      setSimulationPhase(null);
    };

    locationTrackingService.setSimulationListener(handleSimulationUpdate);
    locationTrackingService.setSimulationCompleteListener(handleSimulationComplete);

    return () => {
      locationTrackingService.setSimulationListener(null);
      locationTrackingService.setSimulationCompleteListener(null);
    };
  }, [simulationPhase, rideData]);

  // Log phase changes for debugging
  useEffect(() => {
    console.log('📍 [DriverTracking] Phase changed to:', phase);
  }, [phase]);

  // Update markers when driver location changes (with throttling)
  useEffect(() => {
    if (driverLocation) {
      // Throttle marker updates to every 500ms
      const timer = setTimeout(() => {
        // Trigger marker update by incrementing key
        setMarkerUpdateKey(prev => prev + 1);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [driverLocation]);

  useEffect(() => {
    if (rideId) {
      if (initialRideData) {
        console.log('📦 RAW initialRideData from backend:', JSON.stringify(initialRideData, null, 2));
        console.log('📍 Polyline in ride data:', initialRideData.polyline || initialRideData.route?.polyline);
        
        setRideData(initialRideData);
        setLoading(false);
        if (rideId) {
          syncTrackingSnapshot(rideId);
        }
        
        // Load CONFIRMED ride requests if not in initialRideData
        if (!initialRideData.shared_ride_request_id && !initialRideData.ride_requests) {
          rideService.getRideRequests(rideId, 'CONFIRMED')
            .then(response => {
              const requests = response?.data || response?.content || response || [];
              if (requests.length > 0) {
                // Update rideData with ride requests
                const updatedRideData = { ...initialRideData, ride_requests: requests };
                setRideData(updatedRideData);
                console.log('✅ [DriverTracking] Loaded CONFIRMED ride requests:', requests.length);
              }
            })
            .catch(error => {
              console.warn('⚠️ [DriverTracking] Failed to load ride requests:', error);
            });
        }
        
        // SIMPLE LOGIC: Phase is based ONLY on request status
        // Get request status from various possible locations
        let requestStatus = null;
        
        // Try to get from ride_requests array (first request)
        if (initialRideData.ride_requests && initialRideData.ride_requests.length > 0) {
          requestStatus = initialRideData.ride_requests[0].status || initialRideData.ride_requests[0].request_status;
        }
        
        // Fallback to direct fields
        if (!requestStatus) {
          requestStatus = initialRideData.shared_ride_request_status || 
                         initialRideData.request_status ||
                         initialRideData.ride_request_status;
        }
        
        // SIMPLE: CONFIRMED = toPickup, ONGOING = toDropoff
        const phaseToSet = requestStatus === 'CONFIRMED' ? 'toPickup' : 
                          requestStatus === 'ONGOING' ? 'toDropoff' : 
                          'toPickup'; // Default to toPickup if status unknown
        
        setPhase(phaseToSet);
        console.log('📍 [DriverTracking] Initial phase set (SIMPLE LOGIC):', {
          requestStatus,
          phase: phaseToSet,
          rawData: {
            ride_requests: initialRideData.ride_requests,
            shared_ride_request_status: initialRideData.shared_ride_request_status,
            request_status: initialRideData.request_status
          }
        });
        
        // Handle both flat and nested location formats from backend
        const getPickupLat = () => {
          if (initialRideData.pickup_location?.lat) return initialRideData.pickup_location.lat;
          if (initialRideData.pickup_lat) return initialRideData.pickup_lat;
          return null;
        };
        const getPickupLng = () => {
          if (initialRideData.pickup_location?.lng) return initialRideData.pickup_location.lng;
          if (initialRideData.pickup_lng) return initialRideData.pickup_lng;
          return null;
        };
        const getPickupName = () => {
          if (initialRideData.pickup_location?.name) return initialRideData.pickup_location.name;
          if (initialRideData.pickup_location?.address) return initialRideData.pickup_location.address;
          if (initialRideData.pickup_location_name) return initialRideData.pickup_location_name;
          return 'Điểm đón';
        };
        const getDropoffLat = () => {
          if (initialRideData.dropoff_location?.lat) return initialRideData.dropoff_location.lat;
          if (initialRideData.dropoff_lat) return initialRideData.dropoff_lat;
          return null;
        };
        const getDropoffLng = () => {
          if (initialRideData.dropoff_location?.lng) return initialRideData.dropoff_location.lng;
          if (initialRideData.dropoff_lng) return initialRideData.dropoff_lng;
          return null;
        };
        const getDropoffName = () => {
          if (initialRideData.dropoff_location?.name) return initialRideData.dropoff_location.name;
          if (initialRideData.dropoff_location?.address) return initialRideData.dropoff_location.address;
          if (initialRideData.dropoff_location_name) return initialRideData.dropoff_location_name;
          return 'Điểm đến';
        };
        
        activeRideService.saveActiveRide({
          rideId: rideId,
          requestId: initialRideData.shared_ride_request_id,
          status: initialRideData.status,
          userType: 'driver',
          pickupLocation: {
            lat: getPickupLat(),
            lng: getPickupLng(),
            name: getPickupName()
          },
          dropoffLocation: {
            lat: getDropoffLat(),
            lng: getDropoffLng(),
            name: getDropoffName()
          },
          totalFare: initialRideData.total_fare || initialRideData.totalFare,
          riderName: initialRideData.rider_name,
          ...initialRideData
        });
        // Prepare polyline for current phase
        const toPickupPolyline = initialRideData.polyline_from_driver_to_pickup;
        const ridePolyline = initialRideData.polyline || initialRideData.route?.polyline;
        if (toPickupPolyline && (initialRideData.status === 'CONFIRMED' || status === 'CONFIRMED' || status === 'SCHEDULED')) {
          updateMapPolylineFromEncoded(toPickupPolyline, 'initial-toPickup');
        } else if (ridePolyline) {
          updateMapPolylineFromEncoded(ridePolyline, 'initial-ride');
        }
        
        // Get current driver location
        locationService.getCurrentLocation().then(loc => {
          if (loc) {
            setDriverLocation({
              latitude: loc.latitude,
              longitude: loc.longitude
            });
          }
        }).catch(e => console.error('Failed to get location:', e));
        
        // Subscribe to real-time tracking updates
        setupTrackingSubscription();
      } else {
        loadRideData();
      }
    }
    
    if (startTracking) {
      startTrackingService();
    }
    
    return () => {
      // Cleanup tracking subscription
      if (rideId && trackingSubscriptionRef.current) {
        websocketService.unsubscribeFromRideTracking(rideId);
        trackingSubscriptionRef.current = null;
      }
    };
  }, [rideId, startTracking, initialRideData]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const restoreSnapshot = async () => {
        if (!rideId) {
          return;
        }
        const data = await fetchTrackingSnapshot(rideId);
        if (!cancelled && data) {
          applyTrackingSnapshot(data);
        }
      };

      restoreSnapshot();

      return () => {
        cancelled = true;
      };
    }, [rideId, fetchTrackingSnapshot, applyTrackingSnapshot])
  );
  
  const setupTrackingSubscription = () => {
    if (!rideId || !websocketService.isConnected) {
      console.warn('⚠️ [DriverTracking] Cannot subscribe - WebSocket not connected or rideId missing');
      return;
    }
    
    try {
      const handleTrackingUpdate = (data) => {
        console.log('📍 [DriverTracking] Real-time tracking update:', JSON.stringify(data, null, 2));
        
        if (data.polyline) {
          updateMapPolylineFromEncoded(data.polyline, 'ws');
        }

        if (data.currentLat && data.currentLng) {
          const latitude = parseFloat(data.currentLat);
          const longitude = parseFloat(data.currentLng);
          if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
            setDriverLocation({ latitude, longitude });
          }
        }
      };
      
      trackingSubscriptionRef.current = websocketService.subscribeToRideTracking(rideId, handleTrackingUpdate);
      console.log('✅ [DriverTracking] Subscribed to tracking topic for ride:', rideId);
    } catch (error) {
      console.error('❌ [DriverTracking] Error subscribing to tracking topic:', error);
    }
  };

  // Update phase when rideData changes (especially request status)
  useEffect(() => {
    if (!rideData) return;
    
    // Get request status from various possible locations
    let requestStatus = null;
    
    // Try to get from ride_requests array (first request)
    if (rideData.ride_requests && rideData.ride_requests.length > 0) {
      requestStatus = rideData.ride_requests[0].status || rideData.ride_requests[0].request_status;
    }
    
    // Fallback to direct fields
    if (!requestStatus) {
      requestStatus = rideData.shared_ride_request_status || 
                     rideData.request_status ||
                     rideData.ride_request_status;
    }
    
    // SIMPLE: CONFIRMED = toPickup, ONGOING = toDropoff
    if (requestStatus === 'CONFIRMED') {
      setPhase('toPickup');
      console.log('📍 [DriverTracking] Phase updated to toPickup (request is CONFIRMED)');
    } else if (requestStatus === 'ONGOING') {
      setPhase('toDropoff');
      console.log('📍 [DriverTracking] Phase updated to toDropoff (request is ONGOING)');
    } else {
      console.warn('⚠️ [DriverTracking] Unknown request status:', requestStatus, 'Defaulting to toPickup');
      setPhase('toPickup');
    }
  }, [rideData]);

  // Auto start tracking when ride is CONFIRMED
  useEffect(() => {
    if (rideData?.status === 'CONFIRMED' && !isTracking) {
      console.log('Ride confirmed, auto-starting GPS tracking...');
      setTimeout(() => {
        startTrackingService();
      }, 2000);
    }
  }, [rideData?.status, isTracking]);

  const loadRideData = async () => {
    try {
      setLoading(true);
      const ride = await rideService.getRideById(rideId);
      setRideData(ride);
      syncTrackingSnapshot(rideId);
    } catch (error) {
      console.error('Failed to load ride data:', error);
      setError('Không thể tải thông tin chuyến đi');
    } finally {
      setLoading(false);
    }
  };

  const startTrackingService = async () => {
    try {
      if (rideData?.status !== 'ONGOING' && rideData?.status !== 'CONFIRMED') {
        console.warn('⚠️ [DriverTracking] Ride status is not CONFIRMED or ONGOING:', rideData?.status);
        Alert.alert('Chưa thể theo dõi', 'Vui lòng bắt đầu chuyến đi trước khi theo dõi GPS.');
        return;
      }

      console.log('🚀 [DriverTracking] Starting GPS tracking for ride:', rideId);
      console.log('🚀 [DriverTracking] Ride status:', rideData?.status);
      console.log('🚀 [DriverTracking] WebSocket connected:', websocketService.isConnected);
      
      const success = await locationTrackingService.startTracking(rideId);
      if (success) {
        setIsTracking(true);
        console.log('✅ [DriverTracking] GPS tracking started successfully');
      } else {
        console.error('❌ [DriverTracking] Failed to start GPS tracking');
        Alert.alert('Lỗi', 'Không thể bắt đầu GPS tracking.');
      }
    } catch (error) {
      console.error('❌ [DriverTracking] Failed to start tracking:', error);
      Alert.alert('Lỗi', 'Không thể bắt đầu GPS tracking: ' + (error.message || error.toString()));
    }
  };

  const onStartRide = async () => {
    if (!isNearPickup) {
      Alert.alert('Chưa đến điểm đón', 'Vui lòng đến gần điểm đón (trong vòng 100m) để nhận khách.');
      return;
    }

    try {
      // Get rideRequestId from rideData or fetch from API
      let rideRequestId = rideData?.shared_ride_request_id || 
                         rideData?.ride_requests?.[0]?.shared_ride_request_id ||
                         rideData?.ride_requests?.[0]?.id ||
                         initialRideData?.shared_ride_request_id;
      
      // If not found, fetch ride requests filtered by CONFIRMED status
      if (!rideRequestId) {
        console.log('📥 [DriverTracking] Fetching CONFIRMED ride requests...');
        try {
          // Call /ride-requests/rides/{rideId}?status=CONFIRMED to get only CONFIRMED requests
          const requestsResponse = await rideService.getRideRequests(rideId, 'CONFIRMED');
          const requests = requestsResponse?.data || requestsResponse?.content || requestsResponse || [];
          
          console.log(`📥 [DriverTracking] Found ${requests.length} CONFIRMED requests`);
          
          if (requests.length > 0) {
            // Get the first CONFIRMED request
            const confirmedRequest = requests[0];
            rideRequestId = confirmedRequest.shared_ride_request_id || 
                           confirmedRequest.sharedRideRequestId ||
                           confirmedRequest.id ||
                           confirmedRequest.request_id;
            console.log(`✅ [DriverTracking] Found CONFIRMED request: ${rideRequestId}`);
          } else {
            console.warn('⚠️ [DriverTracking] No CONFIRMED request found');
            Alert.alert('Lỗi', 'Không tìm thấy yêu cầu chuyến đi ở trạng thái CONFIRMED.');
            return;
          }
        } catch (fetchError) {
          console.error('❌ [DriverTracking] Failed to fetch ride requests:', fetchError);
          Alert.alert('Lỗi', 'Không thể tải thông tin yêu cầu chuyến đi: ' + (fetchError.message || fetchError.toString()));
          return;
        }
      }
      
      if (!rideRequestId) {
        Alert.alert('Lỗi', 'Không tìm thấy thông tin yêu cầu chuyến đi. Vui lòng thử lại.');
        console.warn('⚠️ No rideRequestId found after fetching');
        return;
      }

      console.log(`🚀 [DriverTracking] Starting ride request ${rideRequestId} for ride ${rideId}`);
      const response = await rideService.startRideRequestOfRide(rideId, rideRequestId);
      console.log(`✅ Started ride request ${rideRequestId} for ride ${rideId}`, response);
      
      // Update rideData with response if available
      if (response) {
        // Update the request status in rideData
        const updatedRideData = { ...rideData };
        if (updatedRideData.ride_requests && updatedRideData.ride_requests.length > 0) {
          updatedRideData.ride_requests[0].status = 'ONGOING';
        }
        updatedRideData.shared_ride_request_status = 'ONGOING';
        setRideData(updatedRideData);
      }
      
      // Switch to dropoff phase and update polyline
      setPhase('toDropoff');
      
      const ridePolyline = rideData?.polyline || rideData?.route?.polyline;
      if (ridePolyline) {
        updateMapPolylineFromEncoded(ridePolyline, 'start-request');
      }
      
      // Update active ride service
      await activeRideService.updateActiveRideStatus('ONGOING');
      
      // Ensure tracking stays on
      if (!isTracking) await startTrackingService();
      
      // Stop simulation if running
      if (isSimulating) {
        locationTrackingService.stopSimulation();
        setIsSimulating(false);
        setSimulationPhase(null);
      }
      
      Alert.alert('Đã nhận khách', 'Bắt đầu di chuyển đến điểm đến.');
    } catch (e) {
      console.error('Start ride request error:', e);
      Alert.alert('Lỗi', 'Không thể nhận khách: ' + (e.message || e.toString()));
    }
  };

  const recenterMap = () => {
    try {
      if (!mapRef.current) return;
      const points = [];
      
      // Add driver location if available (prioritize current driver position)
      if (driverLocation) {
        points.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude });
      }
      
      // Add pickup location (handle both formats)
      const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
      const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
      if (pickupLat && pickupLng) {
        points.push({ latitude: pickupLat, longitude: pickupLng });
      }
      
      // Add dropoff location (handle both formats)
      const dropoffLat = rideData?.end_location?.lat || rideData?.dropoff_location?.lat || rideData?.dropoff_lat;
      const dropoffLng = rideData?.end_location?.lng || rideData?.dropoff_location?.lng || rideData?.dropoff_lng;
      if (dropoffLat && dropoffLng) {
        points.push({ latitude: dropoffLat, longitude: dropoffLng });
      }
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, { edgePadding: 100 });
      } else if (driverLocation) {
        // Fallback: just center on driver
        mapRef.current.animateToRegion({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } catch (e) {
      console.error('Recenter map error:', e);
    }
  };

  const completeRide = async () => {
    if (!isNearDropoff) {
      Alert.alert('Chưa đến điểm đến', 'Vui lòng đến gần điểm đến (trong vòng 100m) để hoàn thành chuyến đi.');
      return;
    }

    try {
      Alert.alert('Hoàn thành chuyến đi', 'Bạn có chắc chắn muốn hoàn thành?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              // Get rideRequestId from rideData (should be ONGOING request)
              let rideRequestId = rideData?.shared_ride_request_id || 
                                 rideData?.ride_requests?.[0]?.shared_ride_request_id ||
                                 rideData?.ride_requests?.[0]?.id ||
                                 initialRideData?.shared_ride_request_id;
              
              // If not found, fetch ONGOING ride requests
              if (!rideRequestId) {
                console.log('📥 [DriverTracking] Fetching ONGOING ride requests...');
                try {
                  const requestsResponse = await rideService.getRideRequests(rideId, 'ONGOING');
                  const requests = requestsResponse?.data || requestsResponse?.content || requestsResponse || [];
                  
                  console.log(`📥 [DriverTracking] Found ${requests.length} ONGOING requests`);
                  
                  if (requests.length > 0) {
                    // Get the first ONGOING request
                    const ongoingRequest = requests[0];
                    rideRequestId = ongoingRequest.shared_ride_request_id || 
                                   ongoingRequest.sharedRideRequestId ||
                                   ongoingRequest.id ||
                                   ongoingRequest.request_id;
                    console.log(`✅ [DriverTracking] Found ONGOING request: ${rideRequestId}`);
                  } else {
                    console.warn('⚠️ [DriverTracking] No ONGOING request found');
                    Alert.alert('Lỗi', 'Không tìm thấy yêu cầu chuyến đi ở trạng thái ONGOING.');
                    return;
                  }
                } catch (fetchError) {
                  console.error('❌ [DriverTracking] Failed to fetch ride requests:', fetchError);
                  Alert.alert('Lỗi', 'Không thể tải thông tin yêu cầu chuyến đi: ' + (fetchError.message || fetchError.toString()));
                  return;
                }
              }
              
              if (!rideRequestId) {
                Alert.alert('Lỗi', 'Không tìm thấy thông tin yêu cầu chuyến đi. Vui lòng thử lại.');
                console.warn('⚠️ No rideRequestId found after fetching');
                return;
              }

              // Complete the ride request (ONGOING -> COMPLETED)
              console.log(`🚀 [DriverTracking] Completing ride request ${rideRequestId} for ride ${rideId}`);
              const response = await rideService.completeRideRequestOfRide(rideId, rideRequestId);
              console.log(`✅ Completed ride request ${rideRequestId} for ride ${rideId}`, response);
              
              // Update rideData with response if available
              if (response) {
                const updatedRideData = { ...rideData };
                if (updatedRideData.ride_requests && updatedRideData.ride_requests.length > 0) {
                  updatedRideData.ride_requests[0].status = 'COMPLETED';
                }
                updatedRideData.shared_ride_request_status = 'COMPLETED';
                setRideData(updatedRideData);
              }
              
              // Stop tracking
              await locationTrackingService.stopTracking();
              setIsTracking(false);
              
              // Stop simulation if running
              if (isSimulating) {
                locationTrackingService.stopSimulation();
                setIsSimulating(false);
                setSimulationPhase(null);
              }
              
              // Clear active ride
              await activeRideService.clearActiveRide();
              
              // Navigate to completion screen with response data
              navigation.navigate('DriverCompletion', {
                completionData: response,
              });
            } catch (completeError) {
              console.error('Error completing ride request:', completeError);
              const errorMsg = completeError?.message || completeError?.toString() || 'Không thể hoàn thành yêu cầu chuyến đi';
              Alert.alert('Lỗi', errorMsg);
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Error completing ride:', error);
      Alert.alert('Lỗi', 'Không thể hoàn thành chuyến đi.');
    }
  };

  // Simulate to pickup - sends 2 coordinates (current location and pickup) to tracking endpoint
  const simulateToPickup = async () => {
    try {
      if (!driverLocation) {
        Alert.alert('Lỗi', 'Không có vị trí hiện tại của tài xế.');
        return;
      }

      const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
      const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
      
      if (!pickupLat || !pickupLng) {
        Alert.alert('Lỗi', 'Không có thông tin điểm đón.');
        return;
      }

      console.log('🚀 [Simulation] Sending 2 coordinates to pickup');
      console.log('🚀 [Simulation] Current location:', driverLocation);
      console.log('🚀 [Simulation] Pickup location:', { lat: pickupLat, lng: pickupLng });

      // Hardcode final location to be ~50m away from pickup (within 100m threshold)
      const offsetLat = 0.00045; // ~50 meters
      const offsetLng = 0.00045; // ~50 meters
      const finalPickupLocation = {
        latitude: pickupLat + offsetLat,
        longitude: pickupLng + offsetLng,
      };

      // Prepare 2 coordinates: current location and pickup location
      const coordinates = [
        {
          lat: driverLocation.latitude,
          lng: driverLocation.longitude,
          timestamp: new Date().toISOString()
        },
        {
          lat: finalPickupLocation.latitude,
          lng: finalPickupLocation.longitude,
          timestamp: new Date().toISOString()
        }
      ];

      // Send coordinates to tracking endpoint
      const wsDestination = `/app/ride.track.${rideId}`;
      if (websocketService.isConnected && websocketService.client) {
        try {
          websocketService.client.publish({
            destination: wsDestination,
            body: JSON.stringify(coordinates),
          });
          console.log('✅ [Simulation] Sent 2 coordinates via WebSocket');
        } catch (wsError) {
          console.error('❌ [Simulation] WebSocket publish error:', wsError);
          // Fallback to REST API
          try {
            const endpoint = ENDPOINTS.RIDES.TRACK.replace('{rideId}', rideId);
            await apiService.post(endpoint, coordinates);
            console.log('✅ [Simulation] Sent 2 coordinates via REST API');
          } catch (apiError) {
            console.error('❌ [Simulation] REST API error:', apiError);
            throw apiError;
          }
        }
      } else {
        // Use REST API if WebSocket not available
        try {
          const endpoint = ENDPOINTS.RIDES.TRACK.replace('{rideId}', rideId);
          await apiService.post(endpoint, coordinates);
          console.log('✅ [Simulation] Sent 2 coordinates via REST API');
        } catch (apiError) {
          console.error('❌ [Simulation] REST API error:', apiError);
          throw apiError;
        }
      }

      // Update driver location to final pickup location
      setDriverLocation(finalPickupLocation);
      
      // Ensure phase stays as 'toPickup'
      setPhase('toPickup');
      
      setIsSimulating(false);
      setSimulationPhase(null);
      setIsTracking(true);

      Alert.alert(
        'Đã đến điểm đón',
        'Giả lập đã hoàn thành. Bạn đã ở gần điểm đón và có thể nhận khách.',
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('Simulation to pickup error:', e);
      Alert.alert('Lỗi', 'Không thể bắt đầu giả lập: ' + (e.message || e.toString()));
    }
  };

  // Simulate pickup to dropoff - decodes polyline with precision=5 and sends GPS data every 1 second
  const simulateToDropoff = async () => {
    try {
      if (!driverLocation) {
        Alert.alert('Lỗi', 'Không có vị trí hiện tại của tài xế.');
        return;
      }

      const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
      const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
      const dropoffLat = rideData?.end_location?.lat || rideData?.dropoff_location?.lat || rideData?.dropoff_lat;
      const dropoffLng = rideData?.end_location?.lng || rideData?.dropoff_location?.lng || rideData?.dropoff_lng;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        Alert.alert('Lỗi', 'Không có thông tin địa điểm.');
        return;
      }

      // Check initial distance to dropoff
      const initialDistance = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        dropoffLat,
        dropoffLng
      );
      
      if (initialDistance < 100) {
        Alert.alert('Đã gần điểm đến', 'Bạn đã ở trong vòng 100m từ điểm đến. Không cần giả lập.');
        return;
      }

      // Get polyline from ride request
      const rideRequestId = rideData?.shared_ride_request_id || 
                           rideData?.ride_requests?.[0]?.shared_ride_request_id ||
                           initialRideData?.shared_ride_request_id;
      
      let polyline = rideData?.polyline || rideData?.route?.polyline;
      
      // If no polyline in rideData, try to get from request details
      if (!polyline && rideRequestId) {
        try {
          const requestDetails = await rideService.getRequestDetails(rideRequestId);
          polyline = requestDetails.polyline || requestDetails.route?.polyline;
        } catch (e) {
          console.warn('Failed to fetch request details for polyline:', e);
        }
      }

      console.log('🚀 [Simulation] Starting simulation pickup to dropoff');
      console.log('🚀 [Simulation] Pickup:', { lat: pickupLat, lng: pickupLng });
      console.log('🚀 [Simulation] Dropoff:', { lat: dropoffLat, lng: dropoffLng });
      console.log('🚀 [Simulation] Polyline:', polyline ? `Yes (${polyline.length} chars)` : 'No');

      if (polyline) {
        // Decode polyline with precision=5
        const decodedPoints = decodePolyline(polyline, 5);
        console.log(`✅ [Simulation] Decoded ${decodedPoints.length} points from polyline`);

        // Start simulation that sends GPS data every 1 second
        locationTrackingService.startSimulationWithPolyline({
          points: decodedPoints,
          rideId: rideId,
          intervalMs: 1000, // 1 second interval
          localOnly: false, // Send GPS data to backend
        });
      } else {
        // Fallback to straight line simulation
        const simulationConfig = {
          start: { lat: pickupLat, lng: pickupLng },
          end: { lat: dropoffLat, lng: dropoffLng },
          speedMps: 20, // Faster speed for demo
          localOnly: false,
        };
        locationTrackingService.startSimulation(simulationConfig);
      }

      setIsSimulating(true);
      setSimulationPhase('toDropoff');
      setIsTracking(true);

      Alert.alert('Bắt đầu giả lập', 'Đang mô phỏng di chuyển đến điểm đến...');
    } catch (e) {
      console.error('Simulation to dropoff error:', e);
      Alert.alert('Lỗi', 'Không thể bắt đầu giả lập');
    }
  };

  const handleStopSimulation = () => {
    locationTrackingService.stopSimulation();
    setIsSimulating(false);
    setSimulationPhase(null);
    setIsTracking(false);
    Alert.alert('Đã dừng', 'Đã dừng giả lập.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Handle both start_location/end_location (from getRideById) and pickup_location/dropoff_location (from accept response)
  const getPickupLat = () => 
    rideData?.start_location?.lat || 
    rideData?.pickup_location?.lat || 
    rideData?.pickup_lat;
  const getPickupLng = () => 
    rideData?.start_location?.lng || 
    rideData?.pickup_location?.lng || 
    rideData?.pickup_lng;
  const getDropoffLat = () => 
    rideData?.end_location?.lat || 
    rideData?.dropoff_location?.lat || 
    rideData?.dropoff_lat;
  const getDropoffLng = () => 
    rideData?.end_location?.lng || 
    rideData?.dropoff_location?.lng || 
    rideData?.dropoff_lng;

  // Build markers array
  const markers = [];
  
  // Driver location marker (if available)
  if (driverLocation) {
    markers.push({
      id: 'driver',
      coordinate: driverLocation,
      title: 'Vị trí của bạn',
      description: 'Đang di chuyển',
      pinColor: '#2196F3',
      icon: 'motorcycle',
      updateKey: markerUpdateKey // Use updateKey for re-rendering
    });
  }
  
  // Pickup marker
  if (getPickupLat() && getPickupLng()) {
    const pickupName = 
      rideData?.start_location?.name || 
      rideData?.start_location?.address ||
      rideData?.pickup_location?.name || 
      rideData?.pickup_location?.address || 
      'Điểm đón';
    markers.push({
      id: 'pickup',
      coordinate: { latitude: getPickupLat(), longitude: getPickupLng() },
      title: 'Điểm đón',
      description: pickupName,
      pinColor: '#4CAF50'
    });
  }
  
  // Dropoff marker
  if (getDropoffLat() && getDropoffLng()) {
    const dropoffName = 
      rideData?.end_location?.name || 
      rideData?.end_location?.address ||
      rideData?.dropoff_location?.name || 
      rideData?.dropoff_location?.address || 
      'Điểm đến';
    markers.push({
      id: 'dropoff',
      coordinate: { latitude: getDropoffLat(), longitude: getDropoffLng() },
      title: 'Điểm đến',
      description: dropoffName,
      pinColor: '#f44336'
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Compact Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Chuyến đi #{rideId}</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.statusText}>Đang theo dõi</Text>
        </View>
      </View>

      {/* Full-Screen Map */}
      <View style={styles.mapContainer}>
        <GoongMap
          onRef={(api) => { mapRef.current = api; }}
          style={styles.map}
          initialRegion={{
            latitude: getPickupLat() || 10.7769,
            longitude: getPickupLng() || 106.7009,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          markers={markers}
          polyline={mapPolyline}
        />

        {/* GPS Recenter Button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
          <Icon name="my-location" size={22} color="#333" />
        </TouchableOpacity>

        {/* Simulation + Action Controls - Above bottom sheet */}
        <View style={styles.simulationControls}>
          {!isSimulating && phase === 'toPickup' && (
            <>
              <TouchableOpacity style={styles.simBtn} onPress={simulateToPickup}>
                <Icon name="play-circle-outline" size={20} color="#4CAF50" />
                <Text style={styles.simBtnText}>Giả lập tới điểm đón</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.simBtn, 
                  { marginTop: 8 },
                  !isNearPickup && styles.simBtnDisabled
                ]} 
                onPress={onStartRide}
                disabled={!isNearPickup}
              >
                <Icon name="hail" size={20} color={isNearPickup ? "#4CAF50" : "#999"} />
                <Text style={[styles.simBtnText, !isNearPickup && { color: '#999' }]}>Đón khách</Text>
              </TouchableOpacity>
            </>
          )}
          {!isSimulating && phase === 'toDropoff' && (
            <TouchableOpacity style={styles.simBtn} onPress={simulateToDropoff}>
              <Icon name="play-circle-outline" size={20} color="#4CAF50" />
              <Text style={styles.simBtnText}>Giả lập tới điểm đến</Text>
            </TouchableOpacity>
          )}
          {isSimulating && (
            <TouchableOpacity style={[styles.simBtn, styles.simBtnStop]} onPress={handleStopSimulation}>
              <Icon name="pause-circle-outline" size={20} color="#fff" />
              <Text style={[styles.simBtnText, { color: '#fff' }]}>Tắt giả lập</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom Sheet */}
      <Animated.View style={styles.bottomSheet}>
        {/* Handle Bar */}
        <TouchableOpacity 
          style={styles.handleBar}
          onPress={() => setShowBottomSheet(!showBottomSheet)}
        >
          <View style={styles.handle} />
        </TouchableOpacity>

        {showBottomSheet && (
          <>
            {/* Ride Info Card */}
            <View style={styles.rideInfoCard}>
              <Text style={styles.cardTitle}>Thông tin chuyến đi</Text>
              
              <View style={styles.infoRow}>
                <Icon name="person" size={20} color="#666" />
                <Text style={styles.infoText}>{rideData?.rider_name || 'N/A'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Icon name="location-on" size={20} color="#4CAF50" />
                <Text style={styles.infoText} numberOfLines={2}>
                  {rideData?.start_location?.name || 
                   rideData?.start_location?.address ||
                   rideData?.pickup_location?.name || 
                   rideData?.pickup_location?.address || 
                   'N/A'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Icon name="place" size={20} color="#f44336" />
                <Text style={styles.infoText} numberOfLines={2}>
                  {rideData?.end_location?.name || 
                   rideData?.end_location?.address ||
                   rideData?.dropoff_location?.name || 
                   rideData?.dropoff_location?.address || 
                   'N/A'}
                </Text>
              </View>
            </View>

            {/* Action Button */}
            {(() => {
              console.log('🔘 [DriverTracking] Rendering button, phase:', phase, 'isNearPickup:', isNearPickup, 'isNearDropoff:', isNearDropoff);
              if (phase === 'toPickup') {
                return (
                  <TouchableOpacity 
                    style={[
                      styles.completeBtn, 
                      !isNearPickup && styles.completeBtnDisabled
                    ]} 
                    onPress={onStartRide}
                    disabled={!isNearPickup}
                  >
                    <Icon name="hail" size={24} color={isNearPickup ? "white" : "#999"} />
                    <Text style={[
                      styles.completeBtnText,
                      !isNearPickup && { color: '#999' }
                    ]}>Đón khách</Text>
                  </TouchableOpacity>
                );
              } else {
                return (
                  <TouchableOpacity 
                    style={[
                      styles.completeBtn, 
                      !isNearDropoff && styles.completeBtnDisabled
                    ]} 
                    onPress={completeRide}
                    disabled={!isNearDropoff}
                  >
                    <Icon name="check-circle" size={24} color={isNearDropoff ? "white" : "#999"} />
                    <Text style={[
                      styles.completeBtnText,
                      !isNearDropoff && { color: '#999' }
                    ]}>Hoàn thành chuyến đi</Text>
                  </TouchableOpacity>
                );
              }
            })()}
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    padding: 8,
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    bottom: 280,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  simulationControls: {
    position: 'absolute',
    left: 16,
    bottom: 280,
    zIndex: 1000,
    elevation: 10,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  simBtnStop: {
    backgroundColor: '#4CAF50',
  },
  simBtnText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  simBtnDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.6,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  rideInfoCard: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  completeBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  completeBtnDisabled: {
    backgroundColor: '#e0e0e0',
    opacity: 0.6,
  },
});

export default DriverRideTrackingScreen;
