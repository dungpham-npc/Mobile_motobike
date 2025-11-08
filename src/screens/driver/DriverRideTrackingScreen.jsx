import React, { useState, useEffect, useRef } from 'react';
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
  const [phase, setPhase] = useState('toPickup'); // 'toPickup' | 'toDropoff'
  const [mapPolyline, setMapPolyline] = useState([]);
  const [fullPolyline, setFullPolyline] = useState([]); // Store full polyline for trimming
  const [pickupPolylineString, setPickupPolylineString] = useState(null);
  const [ridePolylineString, setRidePolylineString] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const mapRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const [markerUpdateKey, setMarkerUpdateKey] = useState(0);

  // Polyline decoder (Google Encoded Polyline)
  const decodePolyline = (encoded) => {
    if (!encoded || typeof encoded !== 'string') {
      console.warn('⚠️ decodePolyline: Invalid input', encoded);
      return [];
    }
    
    try {
      // Handle escaped backslashes in polyline string (e.g., "\\Z" -> "\Z")
      const cleanedPolyline = encoded.replace(/\\\\/g, '\\');
      let index = 0, lat = 0, lng = 0, coordinates = [];
      
      while (index < cleanedPolyline.length) {
        let b, shift = 0, result = 0;
        do {
          if (index >= cleanedPolyline.length) {
            console.warn('⚠️ decodePolyline: Unexpected end of string while decoding latitude');
            break;
          }
          b = cleanedPolyline.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;
        
        shift = 0; result = 0;
        do {
          if (index >= cleanedPolyline.length) {
            console.warn('⚠️ decodePolyline: Unexpected end of string while decoding longitude');
            break;
          }
          b = cleanedPolyline.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;
        
        coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
      }
      
      console.log(`📍 Decoded ${coordinates.length} points from polyline (length: ${cleanedPolyline.length})`);
      if (coordinates.length > 0) {
        console.log(`📍 First: lat=${coordinates[0].latitude.toFixed(6)}, lng=${coordinates[0].longitude.toFixed(6)}`);
        console.log(`📍 Last: lat=${coordinates[coordinates.length - 1].latitude.toFixed(6)}, lng=${coordinates[coordinates.length - 1].longitude.toFixed(6)}`);
      }
      
      return coordinates;
    } catch (error) {
      console.error('❌ Error decoding polyline:', error);
      console.error('❌ Polyline string:', encoded.substring(0, 100));
      return [];
    }
  };

  // Helper function to trim polyline from current location
  const trimPolylineFromCurrentLocation = (fullPolyline, currentLocation, targetLocation) => {
    if (!fullPolyline || fullPolyline.length === 0 || !currentLocation) return fullPolyline;
    
    // Find the closest point in polyline to current location
    let closestIndex = 0;
    let minDistance = Infinity;
    
    fullPolyline.forEach((point, index) => {
      const distance = locationService.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        point.latitude || point.lat,
        point.longitude || point.lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Return polyline from closest point to end
    return fullPolyline.slice(closestIndex);
  };

  // Listen to simulation location updates
  useEffect(() => {
    let lastPolylineUpdate = 0;
    let lastLogTime = 0;
    let lastRecenterTime = 0;
    const polylineUpdateThrottle = 500; // Update polyline every 500ms max
    const logThrottle = 1000; // Log every 1 second
    const recenterThrottle = 2000; // Recenter every 2 seconds
    
    const handleSimulationUpdate = (location) => {
      if (location) {
        const now = Date.now();
        
        // Throttle console logs
        if (now - lastLogTime > logThrottle) {
          lastLogTime = now;
        }
        
        setDriverLocation({ 
          latitude: location.latitude, 
          longitude: location.longitude 
        });
        
        // Get pickup location (handle both formats)
        const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
        const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
        
        // When heading to pickup, detect arrival (~30m)
        if (phase === 'toPickup' && pickupLat && pickupLng) {
          try {
            const d = locationService.calculateDistance(
              location.latitude,
              location.longitude,
              pickupLat,
              pickupLng
            );
            if (d <= 0.03) { // 30 meters
              setIsSimulating(false);
              Alert.alert(
                'Đã tới điểm đón',
                'Bạn có muốn nhận khách và bắt đầu chuyến đi?',
                [
                  { text: 'Hủy', style: 'cancel' },
                  { text: 'Nhận khách', onPress: () => onStartRide() }
                ]
              );
            }
          } catch (e) {}
        }
        
        // Update polyline to show only remaining route (trim from current location)
        // Use fullPolyline as source if available, otherwise use mapPolyline
        const sourcePolyline = fullPolyline.length > 0 ? fullPolyline : mapPolyline;
        if (sourcePolyline && sourcePolyline.length > 0 && now - lastPolylineUpdate > polylineUpdateThrottle) {
          const trimmedPolyline = trimPolylineFromCurrentLocation(
            sourcePolyline,
            location,
            null // targetLocation not needed for trimming
          );
          
          // Only update if polyline actually changed (to avoid unnecessary re-renders)
          if (trimmedPolyline.length !== mapPolyline.length || 
              (trimmedPolyline.length > 0 && mapPolyline.length > 0 && 
               (trimmedPolyline[0].latitude !== mapPolyline[0].latitude || 
                trimmedPolyline[0].longitude !== mapPolyline[0].longitude))) {
            setMapPolyline(trimmedPolyline);
            lastPolylineUpdate = now;
          }
        }
        
        // Update map to follow driver location (recenter to current position) - throttle this
        if (mapRef.current && now - lastRecenterTime > recenterThrottle) {
          mapRef.current.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
          lastRecenterTime = now;
        }
      }
    };

    locationTrackingService.setSimulationListener(handleSimulationUpdate);

    return () => {
      locationTrackingService.setSimulationListener(null);
    };
  }, [phase, rideData]);

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
        // Set initial phase based on status
        setPhase((initialRideData.status === 'CONFIRMED' || status === 'CONFIRMED' || status === 'SCHEDULED') ? 'toPickup' : 'toDropoff');
        
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
        
        // Decode and set polyline based on current phase
        if (toPickupPolyline && (initialRideData.status === 'CONFIRMED' || status === 'CONFIRMED' || status === 'SCHEDULED')) {
          setPickupPolylineString(toPickupPolyline);
          const decodedPolyline = decodePolyline(toPickupPolyline);
          console.log(`📍 Setting polyline to pickup: ${decodedPolyline.length} points`);
          setFullPolyline(decodedPolyline); // Store full polyline
          setMapPolyline(decodedPolyline);
        } else if (ridePolyline) {
          setRidePolylineString(ridePolyline);
          const decodedPolyline = decodePolyline(ridePolyline);
          console.log(`📍 Setting ride polyline: ${decodedPolyline.length} points`);
          setFullPolyline(decodedPolyline); // Store full polyline
          setMapPolyline(decodedPolyline);
        } else {
          console.warn('⚠️ No polyline found in initialRideData');
          setFullPolyline([]);
          setMapPolyline([]); // Clear polyline if none available
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
      } else {
        loadRideData();
      }
    }
    
    if (startTracking) {
      startTrackingService();
    }
  }, [rideId, startTracking, initialRideData]);

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
      
      // Update polyline when ride data is loaded
      const toPickupPolyline = ride?.polyline_from_driver_to_pickup;
      const ridePolyline = ride?.polyline || ride?.route?.polyline;
      
      if (phase === 'toPickup' && toPickupPolyline) {
        setPickupPolylineString(toPickupPolyline);
        const decoded = decodePolyline(toPickupPolyline);
        console.log(`📍 Loaded polyline to pickup: ${decoded.length} points`);
        setFullPolyline(decoded); // Store full polyline
        setMapPolyline(decoded);
      } else if (ridePolyline) {
        setRidePolylineString(ridePolyline);
        const decoded = decodePolyline(ridePolyline);
        console.log(`📍 Loaded ride polyline: ${decoded.length} points`);
        setFullPolyline(decoded); // Store full polyline
        setMapPolyline(decoded);
      }
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
        console.log('⚠️ Ride status is not ONGOING or CONFIRMED, skipping tracking');
        return;
      }

      const success = await locationTrackingService.startTracking(rideId);
      if (success) {
        setIsTracking(true);
        console.log('✅ GPS tracking started successfully');
      } else {
        console.warn('⚠️ GPS tracking returned false, but no error thrown');
        // Don't show alert if tracking service returns false silently (e.g., app in background)
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
      // Only show alert if it's a real error, not just a warning
      const errorMsg = error?.message || error?.toString() || '';
      if (!errorMsg.includes('background') && !errorMsg.includes('pending')) {
        Alert.alert('Lỗi', 'Không thể bắt đầu GPS tracking. Vui lòng kiểm tra quyền truy cập vị trí.');
      }
    }
  };

  const onStartRide = async () => {
    try {
      // Check current ride status
      const currentStatus = rideData?.status || initialRideData?.status;
      console.log(`📋 Current ride status: ${currentStatus}`);
      
      // Step 1: Start the ride ONLY if it's SCHEDULED
      // When accept without scheduledDepartureTime, ride is already ONGOING
      if (currentStatus === 'SCHEDULED') {
        console.log('🔄 Ride is SCHEDULED, starting ride...');
        await rideService.startRide(rideId);
        console.log('✅ Ride started (SCHEDULED -> ONGOING)');
      } else if (currentStatus === 'ONGOING') {
        console.log('✅ Ride is already ONGOING, skipping startRide');
      } else {
        console.warn(`⚠️ Unexpected ride status: ${currentStatus}, attempting to start anyway...`);
        try {
          await rideService.startRide(rideId);
        } catch (startError) {
          // If startRide fails, check if it's because ride is already ONGOING
          const errorMsg = startError?.message || startError?.toString() || '';
          if (errorMsg.includes('ONGOING') || errorMsg.includes('invalid-state')) {
            console.log('✅ Ride is already ONGOING (from error message), continuing...');
          } else {
            throw startError; // Re-throw if it's a different error
          }
        }
      }
      
      // Bật gửi WS cho simulation và flush 1 điểm gần nhất, rồi đợi backend ingest
      try {
        locationTrackingService.setSimulationLocalOnly(false);
        await locationTrackingService.sendLatestPointNow();
      } catch {}
      if (driverLocation) {
        console.log(`📍 Current driver location: lat=${driverLocation.latitude}, lng=${driverLocation.longitude}`);
      }
      console.log('⏳ Waiting 2 seconds for backend to ingest latest position...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get rideRequestId from rideData or initialRideData
      const rideRequestId = rideData?.shared_ride_request_id || 
                           rideData?.ride_requests?.[0]?.shared_ride_request_id ||
                           initialRideData?.shared_ride_request_id;
      
      if (rideRequestId) {
        console.log(`🔄 Starting ride request ${rideRequestId} (CONFIRMED -> ONGOING)...`);
        try {
          await rideService.startRideRequestOfRide(rideId, rideRequestId);
          console.log(`✅ Started ride request ${rideRequestId} for ride ${rideId}`);
        } catch (startReqError) {
          const errorMsg = startReqError?.message || startReqError?.toString() || '';
          if (errorMsg.includes('too far') || errorMsg.includes('distance')) {
            console.error('❌ Driver too far from pickup. Current location:', driverLocation);
            Alert.alert(
              'Quá xa điểm đón',
              'Vị trí hiện tại của bạn quá xa điểm đón. Vui lòng đợi thêm vài giây để GPS cập nhật vị trí, hoặc thử lại sau.',
              [{ text: 'OK' }]
            );
            throw startReqError;
          }
          throw startReqError;
        }
      } else {
        console.warn('⚠️ No rideRequestId found, skipping startRideRequestOfRide');
      }
      
      // Switch to dropoff phase and update polyline
      setPhase('toDropoff');
      const ridePolyline = rideData?.polyline || rideData?.route?.polyline;
      if (ridePolyline) {
        setRidePolylineString(ridePolyline);
        const decodedPolyline = decodePolyline(ridePolyline);
        console.log(`📍 Setting polyline to dropoff: ${decodedPolyline.length} points`);
        setFullPolyline(decodedPolyline); // Store full polyline
        setMapPolyline(decodedPolyline);
      } else {
        console.warn('⚠️ No ride polyline found when switching to dropoff phase');
        setFullPolyline([]);
        setMapPolyline([]); // Clear polyline if none available
      }
      
      // Reload ride data to get latest polyline
      try {
        const updatedRide = await rideService.getRideById(rideId);
        setRideData(updatedRide);
        const updatedPolyline = updatedRide?.polyline || updatedRide?.route?.polyline;
        if (updatedPolyline) {
          setRidePolylineString(updatedPolyline);
          const decoded = decodePolyline(updatedPolyline);
          console.log(`📍 Updated polyline from API: ${decoded.length} points`);
          setFullPolyline(decoded); // Store full polyline
          setMapPolyline(decoded);
        }
      } catch (e) {
        console.warn('⚠️ Failed to reload ride data for polyline:', e);
      }
      
      // Ensure tracking stays on
      if (!isTracking) await startTrackingService();
      
      Alert.alert('Đã nhận khách', 'Bắt đầu di chuyển đến điểm đến.');
    } catch (e) {
      console.error('Start ride error:', e);
      const errorMsg = e?.message || e?.toString() || 'Không xác định';
      Alert.alert('Lỗi', 'Không thể bắt đầu chuyến đi: ' + errorMsg);
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
    try {
      Alert.alert('Hoàn thành chuyến đi', 'Bạn có chắc chắn muốn hoàn thành?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              // Đảm bảo backend có vị trí mới nhất trước khi complete
              try {
                locationTrackingService.setSimulationLocalOnly(false);
                await locationTrackingService.sendLatestPointNow();
                await new Promise(resolve => setTimeout(resolve, 2000));
              } catch (flushError) {
                console.warn('Không thể flush vị trí trước khi complete ride:', flushError);
              }
              // completeRide will automatically:
              // 1. Get all ride requests via getRideRequests(rideId)
              // 2. Complete any ONGOING requests first
              // 3. Then complete the ride
              console.log(`🔄 Starting complete ride process for ride ${rideId}...`);
              await rideService.completeRide(rideId);
              // Stop simulation/tracking once ride is done
              try {
                locationTrackingService.stopSimulation();
                setIsSimulating(false);
              } catch (simErr) {
                console.warn('Không thể dừng simulate sau khi hoàn thành:', simErr);
              }
              try {
                await locationTrackingService.stopTracking();
                setIsTracking(false);
              } catch (stopErr) {
                console.warn('Không thể tắt GPS tracking sau khi hoàn thành:', stopErr);
              }
              
              await activeRideService.clearActiveRide();
              
              Alert.alert('Thành công', 'Chuyến đi đã hoàn thành.', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (completeError) {
              console.error('❌ Error completing ride:', completeError);
              const backendId = completeError?.data?.error?.id || '';
              const backendMsg = completeError?.data?.error?.message;
              const errorMsg = backendMsg || completeError?.message || completeError?.toString() || 'Không thể hoàn thành chuyến đi';
              
              // Check if error is about active requests
              if (backendId === 'ride.validation.active-requests' ||
                  errorMsg.includes('awaiting pickup/dropoff') || 
                  errorMsg.includes('active-requests') ||
                  errorMsg.includes('still awaiting')) {
                Alert.alert(
                  'Chưa thể hoàn thành', 
                  'Vui lòng hoàn thành tất cả các yêu cầu chuyến đi trước khi hoàn thành chuyến đi.',
                  [{ text: 'OK' }]
                );
              } else if (backendId === 'ride.validation.driver-too-far' || errorMsg.includes('too far')) {
                Alert.alert(
                  'Chưa thể hoàn thành',
                  'Vị trí hiện tại của bạn chưa ở gần điểm thả khách. Vui lòng di chuyển gần điểm trả và thử lại.',
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Lỗi', errorMsg);
              }
            }
          }
        }
      ]);
    } catch (error) {
      console.error('Error completing ride:', error);
      Alert.alert('Lỗi', 'Không thể hoàn thành chuyến đi.');
    }
  };

  const handleStartSimulation = () => {
    try {
      // Extract coordinates - handle start_location/end_location (from getRideById) or pickup_location/dropoff_location (from accept)
      const pickupLat = rideData?.start_location?.lat || rideData?.pickup_location?.lat || rideData?.pickup_lat;
      const pickupLng = rideData?.start_location?.lng || rideData?.pickup_location?.lng || rideData?.pickup_lng;
      const dropoffLat = rideData?.end_location?.lat || rideData?.dropoff_location?.lat || rideData?.dropoff_lat;
      const dropoffLng = rideData?.end_location?.lng || rideData?.dropoff_location?.lng || rideData?.dropoff_lng;
      
      if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
        Alert.alert('Lỗi', 'Không có thông tin địa điểm. Vui lòng thử lại sau.');
        console.error('❌ Missing location data:', { pickupLat, pickupLng, dropoffLat, dropoffLng, rideData });
        return;
      }
      
      const polylineToPickup = pickupPolylineString || rideData?.polyline_from_driver_to_pickup;
      const ridePolyline = ridePolylineString || rideData?.polyline || rideData?.route?.polyline;
      const usePolyline = (phase === 'toPickup') ? polylineToPickup : ridePolyline;
      
      console.log('📍 Starting simulation with phase:', phase);
      console.log('📍 Polyline to pickup:', polylineToPickup ? 'Yes (' + polylineToPickup.length + ' chars)' : 'No');
      console.log('📍 Ride polyline:', ridePolyline ? 'Yes (' + ridePolyline.length + ' chars)' : 'No');
      console.log('📍 Using polyline:', usePolyline ? 'Yes (' + usePolyline.length + ' chars)' : 'No');
      
      // Với phase toPickup: không gửi WS (localOnly=true) để tránh backend báo "Ride not ongoing"
      // Chỉ bật gửi (localOnly=false) khi ride đã ONGOING hoặc sang phase toDropoff
      const simulationConfig = {
        start: (phase === 'toPickup')
          ? (driverLocation ? { lat: driverLocation.latitude, lng: driverLocation.longitude } : { lat: pickupLat, lng: pickupLng })
          : { lat: pickupLat, lng: pickupLng },
        end: (phase === 'toPickup')
          ? { lat: pickupLat, lng: pickupLng }
          : { lat: dropoffLat, lng: dropoffLng },
        speedMps: 50, // ~180km/h for very fast simulation
        localOnly: (phase === 'toPickup'),
        polyline: usePolyline || undefined, // Pass polyline if available, undefined if not
      };
      
      console.log('📍 Simulation config:', {
        phase,
        start: simulationConfig.start,
        end: simulationConfig.end,
        hasPolyline: !!simulationConfig.polyline
      });
      
      locationTrackingService.startSimulation(simulationConfig);
      setIsSimulating(true);
      setIsTracking(true);
      
      // Recenter map to driver location after starting simulation
      setTimeout(() => {
        if (driverLocation && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 1000);
        }
      }, 500);
      
      Alert.alert('Bắt đầu giả lập', usePolyline ? 'Đang mô phỏng theo lộ trình...' : 'Đang mô phỏng di chuyển...');
    } catch (e) {
      console.error('Simulation error:', e);
      Alert.alert('Lỗi', 'Không thể bắt đầu giả lập');
    }
  };

  const handleStopSimulation = () => {
    locationTrackingService.stopSimulation();
    setIsSimulating(false);
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

        {/* Simulation + Start Ride Controls - Above bottom sheet */}
        <View style={styles.simulationControls}>
          {!isSimulating && (
            <TouchableOpacity style={styles.simBtn} onPress={handleStartSimulation}>
              <Icon name="play-circle-outline" size={20} color="#4CAF50" />
              <Text style={styles.simBtnText}>{phase === 'toPickup' ? 'Giả lập tới điểm đón' : 'Giả lập tới điểm đến'}</Text>
            </TouchableOpacity>
          )}
          {isSimulating && (
            <TouchableOpacity style={[styles.simBtn, styles.simBtnStop]} onPress={handleStopSimulation}>
              <Icon name="pause-circle-outline" size={20} color="#fff" />
              <Text style={[styles.simBtnText, { color: '#fff' }]}>Tắt giả lập</Text>
            </TouchableOpacity>
          )}
          {phase === 'toPickup' && !isSimulating && (
            <TouchableOpacity style={[styles.simBtn, { marginTop: 8 }]} onPress={onStartRide}>
              <Icon name="hail" size={20} color="#4CAF50" />
              <Text style={styles.simBtnText}>Nhận khách</Text>
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
            <TouchableOpacity style={styles.completeBtn} onPress={completeRide}>
              <Icon name="check-circle" size={24} color="white" />
              <Text style={styles.completeBtnText}>Hoàn thành chuyến đi</Text>
            </TouchableOpacity>
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
});

export default DriverRideTrackingScreen;
