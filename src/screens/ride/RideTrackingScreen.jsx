import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import locationService from '../../services/LocationService';
import { locationTrackingService } from '../../services/locationTrackingService';
import rideService from '../../services/rideService';
import goongService from '../../services/goongService';
import activeRideService from '../../services/activeRideService';
import websocketService from '../../services/websocketService';
import fcmService from '../../services/fcmService';
import sosService from '../../services/sosService';
import ModernButton from '../../components/ModernButton.jsx';
import GoongMap from '../../components/GoongMap.jsx';
import SOSButton from '../../components/SOSButton.jsx';

const { width, height } = Dimensions.get('window');

const RideTrackingScreen = ({ navigation, route }) => {
  const { proposals, quote, rideId, requestId, driverInfo, status } = route.params || {};
  
  // States
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [rideStatus, setRideStatus] = useState(status || 'PENDING');
  const [loading, setLoading] = useState(false);
  const [showProposals, setShowProposals] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [requestDetails, setRequestDetails] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null); // Current polyline to display
  const [currentPolylineEncoded, setCurrentPolylineEncoded] = useState(null);
  const [resolvedRideId, setResolvedRideId] = useState(rideId || null);
  const effectiveRideId = resolvedRideId || rideId || null;

  // Map ref
  const mapRef = useRef(null);
  const [etaText, setEtaText] = useState(null);
  const trackingSubscriptionRef = useRef(null);
  const riderMatchingSubscriptionKeyRef = useRef(null);
  const rideTrackingRideIdRef = useRef(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const sheetHeightRef = useRef(new Animated.Value(120));
  const sheetHeight = sheetHeightRef.current; // Start at 120px (collapsed)
  const panResponder = useRef(null);
  const mapFittedRef = useRef(false);

  const normalizeLocation = useCallback((...candidates) => {
    for (const item of candidates) {
      if (!item) continue;
      const lat = item.latitude ?? item.lat;
      const lng = item.longitude ?? item.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return {
          name: item.name || item.address || item.label || null,
          latitude: lat,
          longitude: lng,
        };
      }
    }
    return null;
  }, []);

  const buildRiderSosSnapshot = useCallback(() => {
    const driverProfile = {
      id:
        driverInfo?.driverId ||
        selectedProposal?.driverId ||
        requestDetails?.driver_id ||
        null,
      name:
        driverInfo?.driverName ||
        selectedProposal?.driverName ||
        requestDetails?.driver_name ||
        null,
      phone:
        driverInfo?.driverPhone ||
        selectedProposal?.driverPhone ||
        requestDetails?.driver_phone ||
        null,
      vehicle: driverInfo?.vehicle || selectedProposal?.vehicle || null,
    };

    const pickup = normalizeLocation(
      quote?.pickup,
      driverInfo?.pickupLocation,
      requestDetails?.pickup_location,
      selectedProposal?.pickupLocation
    );
    const dropoff = normalizeLocation(
      quote?.dropoff,
      driverInfo?.dropoffLocation,
      requestDetails?.dropoff_location,
      selectedProposal?.dropoffLocation
    );

    return {
      role: 'rider',
      rideId: effectiveRideId,
      requestId,
      status: rideStatus,
      eta: etaText,
      driver: driverProfile,
      pickup,
      dropoff,
      driverLocation: driverLocation
        ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
        : null,
      route: currentPolylineEncoded ? { polyline: currentPolylineEncoded } : null,
      timestamp: new Date().toISOString(),
    };
  }, [
    driverInfo,
    selectedProposal,
    requestDetails,
    quote,
    normalizeLocation,
    effectiveRideId,
    requestId,
    rideStatus,
    etaText,
    driverLocation,
    currentPolylineEncoded,
  ]);

  const handleTriggerSOS = useCallback(async () => {
    const rideSnapshot = buildRiderSosSnapshot();
    try {
      await sosService.triggerAlert({
        rideId: effectiveRideId,
        rideSnapshot,
        role: 'rider',
      });
      Alert.alert(
        'Đã gửi SOS',
        'MSSUS đã nhận được tín hiệu cầu cứu của bạn và đang thông báo cho quản trị viên cùng liên hệ khẩn cấp.'
      );
    } catch (error) {
      console.error('Failed to trigger SOS:', error);
      Alert.alert('Lỗi', error?.message || 'Không thể gửi SOS. Vui lòng thử lại.');
    }
  }, [buildRiderSosSnapshot, effectiveRideId]);

  const updatePolylineFromEncoded = useCallback(
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
          setRoutePolyline(formattedPolyline);
          console.log(
            `✅ [RideTracking] Updated route polyline (${context}) with ${formattedPolyline.length} points`
          );
          return encoded;
        } catch (error) {
          console.error("❌ [RideTracking] Error decoding polyline:", error);
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
        setRideStatus(snapshot.requestStatus);
      } else if (snapshot.rideStatus) {
        setRideStatus(snapshot.rideStatus);
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
        updatePolylineFromEncoded(snapshot.polyline, "snapshot");
      }

      if (snapshot.estimatedArrival) {
        setEtaText(snapshot.estimatedArrival);
      }
    },
    [updatePolylineFromEncoded]
  );

  const fetchTrackingSnapshot = useCallback(async (targetRideId) => {
    if (!targetRideId) {
      return null;
    }
    try {
      const response = await rideService.getRideTrackingSnapshot(targetRideId);
      return response?.data ?? response;
    } catch (error) {
      console.error("❌ [RideTracking] Error fetching tracking snapshot:", error);
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

  useEffect(() => {
    if (!rideId) {
      activeRideService.getActiveRide().then((activeRide) => {
        if (activeRide?.rideId) {
          setResolvedRideId(activeRide.rideId);
        }
      });
    } else {
      setResolvedRideId(rideId);
    }
  }, [rideId]);

  useEffect(() => {
    initializeTracking();
    setupFCMListeners();
    setupBottomSheet();
    
    return () => {
      locationService.stopLocationTracking();
    };
  }, [rideId, resolvedRideId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const restoreSnapshot = async () => {
        const currentRideId = effectiveRideId;
        if (!currentRideId) {
          return;
        }
        const data = await fetchTrackingSnapshot(currentRideId);
        if (!cancelled && data) {
          applyTrackingSnapshot(data);
        }
      };

      restoreSnapshot();

      return () => {
        cancelled = true;
      };
    }, [rideId, resolvedRideId, fetchTrackingSnapshot, applyTrackingSnapshot])
  );
  
  const setupBottomSheet = () => {
    const maxHeight = Dimensions.get('window').height * 0.8;
    const minHeight = 120;
    
    panResponder.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        sheetHeight.setOffset(sheetHeight._value);
        sheetHeight.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Drag up (negative dy) increases height, drag down (positive dy) decreases height
        const currentBase = sheetHeight._value + (sheetHeight._offset || 0);
        const newBase = currentBase - gestureState.dy; // Subtract because we want drag up to increase
        const clampedBase = Math.max(0, Math.min(maxHeight - minHeight, newBase));
        sheetHeight.setValue(clampedBase);
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetHeight.flattenOffset();
        const currentHeight = sheetHeight._value + minHeight;
        const midPoint = Dimensions.get('window').height * 0.4;
        
        // If dragged up significantly or already past midpoint, expand; otherwise collapse
        if (gestureState.dy < -30 || (currentHeight > midPoint && gestureState.dy < 0)) {
          // Expand
          Animated.spring(sheetHeight, {
            toValue: maxHeight - minHeight,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          setShowDetailsSheet(true);
        } else {
          // Collapse
          Animated.spring(sheetHeight, {
            toValue: 0,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start();
          setShowDetailsSheet(false);
        }
      },
    });
  };

  // Poll request status for joined rides
  useEffect(() => {
    if (requestId && rideStatus === 'CONFIRMED') {
      // Validate requestId before polling
      if (!requestId || requestId === 'undefined' || requestId === 'null' || requestId === '{requestId}') {
        console.warn('⚠️ [RideTracking] Invalid requestId for polling, stopping');
        return;
      }
      
      const interval = setInterval(async () => {
        try {
          const requestDetails = await rideService.getRequestDetails(requestId);
          const newStatus = requestDetails.status?.toUpperCase();
          
          if (newStatus === 'ONGOING' && rideStatus !== 'ONGOING') {
            setRideStatus('ONGOING');
            Alert.alert('Chuyến đi đã bắt đầu', 'Tài xế đã bắt đầu chuyến đi.');
          } else if (newStatus === 'COMPLETED' && rideStatus !== 'COMPLETED') {
            setRideStatus('COMPLETED');
            handleRideCompleted();
          }
        } catch (error) {
          console.error('Error polling request status:', error);
          
          // If request not found (404), stop polling and clear active ride
          if (error?.message?.includes('not found') || error?.message?.includes('Không tìm thấy')) {
            console.warn('⚠️ [RideTracking] Request not found during polling, clearing active ride');
            clearInterval(interval);
            await activeRideService.clearActiveRide();
            Alert.alert(
              'Lỗi',
              'Không tìm thấy thông tin chuyến đi. Vui lòng thử lại.',
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack()
                }
              ]
            );
          }
        }
      }, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [requestId, rideStatus]);

  const cleanupRideTrackingSubscription = useCallback(() => {
    if (rideTrackingRideIdRef.current) {
      try {
        websocketService.unsubscribeFromRideTracking(rideTrackingRideIdRef.current);
      } catch (error) {
        console.warn('⚠️ [RideTracking] Error unsubscribing from ride tracking:', error);
      }
      rideTrackingRideIdRef.current = null;
      trackingSubscriptionRef.current = null;
    }
  }, []);

  const cleanupRiderMatchingSubscription = useCallback(() => {
    if (riderMatchingSubscriptionKeyRef.current) {
      try {
        websocketService.unsubscribe(riderMatchingSubscriptionKeyRef.current);
      } catch (error) {
        console.warn('⚠️ [RideTracking] Error unsubscribing rider matching listener:', error);
      }
      riderMatchingSubscriptionKeyRef.current = null;
    }
  }, []);

  const handleTrackingUpdate = useCallback(
    (data) => {
      console.log('📍 [RideTracking] Real-time tracking update received:', JSON.stringify(data, null, 2));

      if (data.currentLat && data.currentLng) {
        const newDriverLocation = {
          latitude: parseFloat(data.currentLat),
          longitude: parseFloat(data.currentLng),
        };

        if (
          !Number.isNaN(newDriverLocation.latitude) &&
          !Number.isNaN(newDriverLocation.longitude) &&
          Math.abs(newDriverLocation.latitude) <= 90 &&
          Math.abs(newDriverLocation.longitude) <= 180
        ) {
          setDriverLocation(newDriverLocation);
          console.log('✅ [RideTracking] Updated driver location marker:', newDriverLocation);
        } else {
          console.warn('⚠️ [RideTracking] Invalid driver coordinates:', newDriverLocation);
        }

        if (data.polyline) {
          updatePolylineFromEncoded(data.polyline, 'ws');
        }

        if (data.estimatedArrival) {
          setEtaText(data.estimatedArrival);
        } else if (data.currentDistanceKm !== null && data.currentDistanceKm !== undefined) {
          const distanceKm = parseFloat(data.currentDistanceKm);
          if (!Number.isNaN(distanceKm)) {
            const estimatedMinutes = Math.ceil((distanceKm / 30) * 60);
            setEtaText(`Còn ${estimatedMinutes} phút`);
          }
        }
      } else {
        console.warn('⚠️ [RideTracking] Tracking update missing coordinates:', data);
      }
    },
    [updatePolylineFromEncoded]
  );

  const setupWebSocketListeners = useCallback(async () => {
    const currentRideId = effectiveRideId;
    const rideIdForTracking =
      currentRideId ||
      requestDetails?.shared_ride_id ||
      requestDetails?.sharedRideId ||
      requestDetails?.ride_id ||
      requestDetails?.rideId ||
      null;

    if (!websocketService.isConnected) {
      try {
        await websocketService.connect();
      } catch (error) {
        console.error('❌ [RideTracking] Failed to connect WebSocket:', error);
        return;
      }
    }

    cleanupRiderMatchingSubscription();

    const handleRideUpdate = (data) => {
      console.log('📨 [RideTracking] Ride matching update received:', JSON.stringify(data, null, 2));

      const updateRideId = data.rideId || data.sharedRideId || rideIdForTracking;
      const activeRideId = currentRideId || rideIdForTracking;

      if (
        updateRideId &&
        activeRideId &&
        updateRideId.toString() !== activeRideId.toString()
      ) {
        return;
      }

      if (data.type === 'TRACKING_START' && updateRideId === activeRideId) {
        setRideStatus('ONGOING');
        Alert.alert('Chuyến đi đã bắt đầu', 'Tài xế đã bắt đầu chuyến đi.');
        syncTrackingSnapshot(updateRideId);
      }

      if (data.status === 'ONGOING' && updateRideId === activeRideId) {
        setRideStatus('ONGOING');
        syncTrackingSnapshot(updateRideId);
      }

      if (data.status === 'COMPLETED' && updateRideId === activeRideId) {
        setRideStatus('COMPLETED');
        handleRideCompleted();
      }

      if (data.driverLocation) {
        setDriverLocation({
          latitude: data.driverLocation.latitude || data.driverLocation.lat,
          longitude: data.driverLocation.longitude || data.driverLocation.lng,
        });
      }
    };

    try {
      const subscriptionKey = websocketService.subscribeToRiderMatching(handleRideUpdate);
      riderMatchingSubscriptionKeyRef.current = subscriptionKey;
    } catch (error) {
      console.error('❌ [RideTracking] Error setting up rider matching listener:', error);
    }

    cleanupRideTrackingSubscription();

    if (rideIdForTracking) {
      try {
        trackingSubscriptionRef.current = websocketService.subscribeToRideTracking(
          rideIdForTracking,
          handleTrackingUpdate
        );
        rideTrackingRideIdRef.current = rideIdForTracking;
        console.log('✅ [RideTracking] Subscribed to tracking topic for ride:', rideIdForTracking);
      } catch (error) {
        console.error('❌ [RideTracking] Error subscribing to tracking topic:', error);
      }
    } else {
      console.warn(
        '⚠️ [RideTracking] No rideId available for tracking subscription. rideId:',
        currentRideId,
        'requestDetails:',
        requestDetails ? 'available' : 'null'
      );
    }
  }, [
    effectiveRideId,
    requestDetails,
    syncTrackingSnapshot,
    handleRideCompleted,
    handleTrackingUpdate,
    cleanupRideTrackingSubscription,
    cleanupRiderMatchingSubscription,
  ]);

  const cleanupWebSocketListeners = useCallback(() => {
    cleanupRiderMatchingSubscription();
    cleanupRideTrackingSubscription();
  }, [cleanupRiderMatchingSubscription, cleanupRideTrackingSubscription]);

  const setupFCMListeners = () => {
    // FCM listeners are handled globally, but we can check for ride-specific notifications
    // The FCM service should navigate here when ride status changes
  };

  useEffect(() => {
    setupWebSocketListeners();
    return () => {
      cleanupWebSocketListeners();
    };
  }, [setupWebSocketListeners, cleanupWebSocketListeners]);

  const handleRideCompleted = useCallback(() => {
    // Clear active ride from storage
    activeRideService.clearActiveRide().catch(err => console.warn('Failed to clear active ride:', err));
    
    // Stop tracking
    locationTrackingService.stopTracking().catch(err => console.warn('Failed to stop tracking:', err));
    
    Alert.alert(
      'Chuyến đi hoàn thành',
      'Cảm ơn bạn đã sử dụng dịch vụ. Vui lòng đánh giá tài xế.',
      [
        {
          text: 'Đánh giá ngay',
          onPress: () => {
            // Prepare ride data for rating screen
            const rideData = {
              driverInfo: {
                driverName: driverInfo?.driverName || selectedProposal?.driverName || requestDetails?.driver_name || 'Tài xế',
                driverRating: driverInfo?.driverRating || selectedProposal?.driverRating || requestDetails?.driver_rating || 4.8,
                vehicleModel: driverInfo?.vehicleModel || selectedProposal?.vehicleModel || requestDetails?.vehicle_model || '',
                vehiclePlate: driverInfo?.vehiclePlate || selectedProposal?.vehiclePlate || requestDetails?.vehicle_plate || '',
                totalFare: requestDetails?.total_fare?.amount || requestDetails?.totalFare?.amount || requestDetails?.totalFare || driverInfo?.totalFare || selectedProposal?.fare || 0,
              },
              pickupLocation: {
                name: requestDetails?.pickup_location?.name || requestDetails?.pickupLocationName || driverInfo?.pickup_location_name || quote?.pickupAddress || 'Điểm đón',
              },
              dropoffLocation: {
                name: requestDetails?.dropoff_location?.name || requestDetails?.dropoffLocationName || driverInfo?.dropoff_location_name || quote?.dropoffAddress || 'Điểm đến',
              },
              totalFare: requestDetails?.total_fare?.amount || requestDetails?.totalFare?.amount || requestDetails?.totalFare || driverInfo?.totalFare || selectedProposal?.fare || 0,
            };
            
            navigation.navigate('RideRating', {
              ride: rideData,
              requestId: requestId,
            });
          },
        },
        {
          text: 'Để sau',
          style: 'cancel',
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  }, [driverInfo, selectedProposal, requestDetails, quote, navigation, requestId]);

  const initializeTracking = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);

      // Start location tracking
      locationService.startLocationTracking((newLocation) => {
        setCurrentLocation(newLocation);
      });

      // Fetch request details if requestId is available (for joined rides)
      if (requestId) {
        try {
          console.log('📥 [RideTracking] Fetching request details for requestId:', requestId);
          // Validate requestId before fetching
          if (!requestId || requestId === 'undefined' || requestId === 'null' || requestId === '{requestId}') {
            console.error('❌ [RideTracking] Invalid requestId:', requestId);
            Alert.alert(
              'Lỗi',
              'Thông tin chuyến đi không hợp lệ. Vui lòng thử lại.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    // Clear invalid active ride and go back
                    activeRideService.clearActiveRide();
                    navigation.goBack();
                  }
                }
              ]
            );
            return;
          }
          
          const details = await rideService.getRequestDetails(requestId);
          console.log('📥 [RideTracking] Request details received:', JSON.stringify(details, null, 2));
          
          setRequestDetails(details);
          
          const resolvedStatus = details.status?.toUpperCase() || status?.toUpperCase() || 'CONFIRMED';
          setRideStatus(resolvedStatus);
          
          // Update driver location from request details if available
          if (details.driver_location || details.driverLocation) {
            const driverLoc = details.driver_location || details.driverLocation;
            setDriverLocation({
              latitude: driverLoc.lat || driverLoc.latitude,
              longitude: driverLoc.lng || driverLoc.longitude,
            });
            console.log('📍 [RideTracking] Set initial driver location from request details');
          }
          
          // Subscribe to tracking if we now have a rideId from requestDetails
    const detailsRideId =
            details.shared_ride_id ||
            details.sharedRideId ||
            details.ride_id ||
            details.rideId ||
            currentRideId;
          let snapshotApplied = false;
          if (detailsRideId) {
            const snapshot = await fetchTrackingSnapshot(detailsRideId);
            if (snapshot) {
              applyTrackingSnapshot(snapshot);
              snapshotApplied = true;
            }
          }

          if (!snapshotApplied) {
            const polyline = details.polyline || details.route?.polyline;
            const polylineFromDriverToPickup = details.polyline_from_driver_to_pickup || details.polylineFromDriverToPickup;
            if (resolvedStatus === 'ONGOING' && polyline) {
              updatePolylineFromEncoded(polyline, 'fallback-pickup-dropoff');
            } else if (resolvedStatus === 'CONFIRMED' && polylineFromDriverToPickup) {
              updatePolylineFromEncoded(polylineFromDriverToPickup, 'fallback-driver-pickup');
            } else if (polyline) {
              updatePolylineFromEncoded(polyline, 'fallback-default');
            }
          }

          // Fit map to show route and locations - delay to ensure map is ready
          setTimeout(() => {
            console.log('📍 [RideTracking] Request details loaded, fitting map...');
            fitMapToRoute();
            mapFittedRef.current = true;
          }, 2500);
        } catch (error) {
          console.error('❌ [RideTracking] Error fetching request details:', error);
        }
      }

      // If we have driverInfo from notification, use it as selectedProposal
      if (driverInfo && effectiveRideId) {
        setSelectedProposal({
          driverName: driverInfo.driverName,
          driverRating: driverInfo.driverRating,
          vehicleModel: driverInfo.vehicleModel,
          vehiclePlate: driverInfo.vehiclePlate,
          estimatedArrival: '5-10',
          fare: driverInfo.totalFare,
          rideId: effectiveRideId,
          requestId: requestId
        });
        setShowProposals(false);
        setRideStatus(status || 'CONFIRMED');
        
        // Save as active ride
        console.log('Rider saving active ride with driverInfo:', driverInfo);
        console.log('Quote data:', quote);
        
        activeRideService.saveActiveRide({
          rideId: effectiveRideId,
          requestId: requestId,
          status: status || 'CONFIRMED',
          userType: 'rider',
          driverInfo: driverInfo,
          pickupLocation: {
            lat: driverInfo.pickupLat || driverInfo.pickup_lat || quote?.pickup?.latitude,
            lng: driverInfo.pickupLng || driverInfo.pickup_lng || quote?.pickup?.longitude,
            name: driverInfo.pickup_location_name || quote?.pickupAddress || 'Điểm đón'
          },
          dropoffLocation: {
            lat: driverInfo.dropoffLat || driverInfo.dropoff_lat || quote?.dropoff?.latitude,
            lng: driverInfo.dropoffLng || driverInfo.dropoff_lng || quote?.dropoff?.longitude,
            name: driverInfo.dropoff_location_name || quote?.dropoffAddress || 'Điểm đến'
          },
          totalFare: driverInfo.totalFare,
          ...driverInfo
        });
      }
      // If we have proposals, show them
      else if (proposals && proposals.length > 0) {
        setShowProposals(true);
      }

    } catch (error) {
      console.error('❌ [RideTracking] Error initializing tracking:', error);
    }
  };

  const handleSelectProposal = (proposal) => {
    setSelectedProposal(proposal);
    setShowProposals(false);
    
    // Fit map to show pickup, dropoff, and driver location
    if (mapRef.current) {
      const coordinates = [
        quote.pickup,
        quote.dropoff,
        proposal.driverLocation
      ].filter(Boolean);
      
      const region = locationService.getRegionForCoordinates(coordinates, 0.02);
      mapRef.current.animateToRegion(region, 1000);
    }
  };

  const fitMapToRoute = () => {
    try {
      if (!mapRef.current) {
        console.log('⚠️ [RideTracking] Map ref not available yet');
        return;
      }
      
      console.log('📍 [RideTracking] Fitting map to route...');
      console.log('📍 [RideTracking] routePolyline:', routePolyline?.length, 'points');
      console.log('📍 [RideTracking] requestDetails:', requestDetails ? 'available' : 'null');
      
      // Use canonical polyline if available, otherwise fall back to request data once
      let polylineToUse = routePolyline;
      if ((!polylineToUse || polylineToUse.length === 0) && requestDetails?.polyline) {
        try {
          const decodedPolyline = goongService.decodePolyline(requestDetails.polyline);
          polylineToUse = decodedPolyline.map(point => [point.longitude, point.latitude]);
        } catch (error) {
          console.error('❌ [RideTracking] Error decoding requestDetails polyline:', error);
        }
      }
      
      if ((!polylineToUse || polylineToUse.length === 0) && requestDetails?.route?.polyline) {
        try {
          const decodedPolyline = goongService.decodePolyline(requestDetails.route.polyline);
          polylineToUse = decodedPolyline.map(point => [point.longitude, point.latitude]);
        } catch (error) {
          console.error('❌ [RideTracking] Error decoding route polyline:', error);
        }
      }
      
      const coords = [];
      
      // Prioritize requestDetails locations
      if (requestDetails?.pickup_location) {
        const pickup = requestDetails.pickup_location;
        coords.push({
          latitude: pickup.lat || pickup.latitude,
          longitude: pickup.lng || pickup.longitude,
        });
        console.log('📍 [RideTracking] Added pickup from requestDetails:', pickup.lat, pickup.lng);
      } else if (quote?.pickup) {
        coords.push(quote.pickup);
      } else if (driverInfo?.pickupLat && driverInfo?.pickupLng) {
        coords.push({ latitude: driverInfo.pickupLat, longitude: driverInfo.pickupLng });
      }
      
      if (requestDetails?.dropoff_location) {
        const dropoff = requestDetails.dropoff_location;
        coords.push({
          latitude: dropoff.lat || dropoff.latitude,
          longitude: dropoff.lng || dropoff.longitude,
        });
        console.log('📍 [RideTracking] Added dropoff from requestDetails:', dropoff.lat, dropoff.lng);
      } else if (quote?.dropoff) {
        coords.push(quote.dropoff);
      } else if (driverInfo?.dropoffLat && driverInfo?.dropoffLng) {
        coords.push({ latitude: driverInfo.dropoffLat, longitude: driverInfo.dropoffLng });
      }
      
      // Add driver location if available
      if (driverLocation) {
        coords.push(driverLocation);
        console.log('📍 [RideTracking] Added driver location:', driverLocation.latitude, driverLocation.longitude);
      } else if (selectedProposal?.driverLocation) {
        coords.push(selectedProposal.driverLocation);
      }
      
      if (polylineToUse && polylineToUse.length > 0) {
        // Convert polyline to coordinates format for fitToCoordinates
        const polylineCoords = polylineToUse
          .filter(point => point && (Array.isArray(point) || (point.latitude && point.longitude)))
          .map(point => {
            if (Array.isArray(point) && point.length >= 2) {
              return {
                latitude: point[1], // polyline is [lng, lat]
                longitude: point[0],
              };
            } else if (point.latitude && point.longitude) {
              return {
                latitude: point.latitude,
                longitude: point.longitude,
              };
            }
            return null;
          })
          .filter(coord => coord && coord.latitude && coord.longitude && 
                  !isNaN(coord.latitude) && !isNaN(coord.longitude) &&
                  Math.abs(coord.latitude) <= 90 && Math.abs(coord.longitude) <= 180);
        
        console.log('📍 [RideTracking] Fitting to polyline with', polylineCoords.length, 'points');
        if (polylineCoords.length > 0) {
          console.log('📍 [RideTracking] First point:', polylineCoords[0]);
          console.log('📍 [RideTracking] Last point:', polylineCoords[polylineCoords.length - 1]);
          
          // Combine with markers for better fit
          const allCoords = [...polylineCoords, ...coords];
          mapRef.current.fitToCoordinates(allCoords, { edgePadding: 80 });
          console.log('✅ [RideTracking] Map fitted to polyline');
        } else {
          console.warn('⚠️ [RideTracking] Polyline coordinates invalid, falling back to markers');
          if (coords.length > 0) {
            const region = locationService.getRegionForCoordinates(coords, 0.02);
            mapRef.current.animateToRegion(region, 600);
            console.log('✅ [RideTracking] Map fitted to markers');
          }
        }
      } else if (coords.length > 0) {
        console.log('📍 [RideTracking] No polyline, fitting to', coords.length, 'markers');
        const region = locationService.getRegionForCoordinates(coords, 0.02);
        mapRef.current.animateToRegion(region, 600);
        console.log('✅ [RideTracking] Map fitted to markers');
      } else {
        console.warn('⚠️ [RideTracking] No coordinates available to fit map');
      }
    } catch (error) {
      console.error('❌ [RideTracking] Error fitting map to route:', error);
    }
  };

  const recenterMap = () => {
    fitMapToRoute();
  };
  
  // Fit map when polyline is loaded
  useEffect(() => {
    if (routePolyline && routePolyline.length > 0 && mapRef.current && requestDetails) {
      setTimeout(() => {
        console.log('📍 [RideTracking] useEffect: routePolyline changed, fitting map...');
        fitMapToRoute();
      }, 1000);
    }
  }, [routePolyline]);
  
  // Fit map when request details are loaded
  useEffect(() => {
    if (requestDetails && mapRef.current) {
      setTimeout(() => {
        console.log('📍 [RideTracking] useEffect: requestDetails changed, fitting map...');
        fitMapToRoute();
      }, 2500);
    }
  }, [requestDetails]);
  
  // Update map when driver location changes (for real-time tracking)
  useEffect(() => {
    if (driverLocation && mapRef.current) {
      console.log('📍 [RideTracking] Driver location updated, marker should be visible:', driverLocation);
      // Optionally recenter map to follow driver (or just update marker)
      // For now, we'll just update the marker position
      // Uncomment below if you want map to follow driver:
      // mapRef.current.animateToRegion({
      //   latitude: driverLocation.latitude,
      //   longitude: driverLocation.longitude,
      //   latitudeDelta: 0.01,
      //   longitudeDelta: 0.01,
      // }, 1000);
    } else {
      console.warn('⚠️ [RideTracking] Driver location is null, marker will not be displayed');
    }
  }, [driverLocation]);

  const handleCancelRide = () => {
    Alert.alert(
      'Hủy chuyến xe',
      'Bạn có chắc chắn muốn hủy chuyến xe này?',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy chuyến',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Cancel the ride request
              if (selectedProposal?.requestId) {
                await rideService.cancelRequest(selectedProposal.requestId);
              }
              
              Alert.alert('Thành công', 'Đã hủy chuyến xe', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Cancel ride error:', error);
              Alert.alert('Lỗi', 'Không thể hủy chuyến xe. Vui lòng thử lại.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCallDriver = () => {
    if (selectedProposal?.driverPhone) {
      // In a real app, you would use Linking.openURL(`tel:${selectedProposal.driverPhone}`)
      Alert.alert('Gọi tài xế', `Số điện thoại: ${selectedProposal.driverPhone}`);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Không xác định';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('vi-VN', {
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

  const renderDetailedInfo = () => {
    if (!requestDetails && !selectedProposal) return null;
    
    const details = requestDetails || {};
    const pickup = details.pickup_location || {};
    const dropoff = details.dropoff_location || {};
    const route = details.route || {};
    
    return (
      <ScrollView style={styles.detailedContent} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={styles.detailedHeader}>
          <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.statusBadgeText, { color: '#4CAF50' }]}>
              {details.status === 'CONFIRMED' ? 'Đã xác nhận' : 
               details.status === 'ONGOING' ? 'Đang di chuyển' :
               details.status === 'COMPLETED' ? 'Hoàn thành' : 'Đang chờ'}
            </Text>
          </View>
        </View>

        {/* Request Info */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Thông tin yêu cầu</Text>
          
          <View style={styles.detailItem}>
            <Icon name="confirmation-number" size={20} color="#666" />
            <View style={styles.detailItemContent}>
              <Text style={styles.detailLabel}>Mã yêu cầu</Text>
              <Text style={styles.detailValue}>#{details.shared_ride_request_id || details.sharedRideRequestId || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={styles.detailItem}>
            <Icon name="category" size={20} color="#666" />
            <View style={styles.detailItemContent}>
              <Text style={styles.detailLabel}>Loại yêu cầu</Text>
              <Text style={styles.detailValue}>
                {details.request_kind === 'JOIN_RIDE' ? 'Tham gia chuyến xe' : 'Đặt xe'}
              </Text>
            </View>
          </View>
          
          <View style={styles.detailItem}>
            <Icon name="person" size={20} color="#666" />
            <View style={styles.detailItemContent}>
              <Text style={styles.detailLabel}>Người khởi tạo</Text>
              <Text style={styles.detailValue}>
                {details.initiated_by === 'rider' ? 'Hành khách' : 'Tài xế'}
              </Text>
            </View>
          </View>
          
          {details.created_at && (
            <View style={styles.detailItem}>
              <Icon name="schedule" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Thời gian tạo</Text>
                <Text style={styles.detailValue}>{formatDateTime(details.created_at)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Route Info */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Tuyến đường</Text>
          
          <View style={styles.routeDetailRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="radio-button-checked" size={20} color="#4CAF50" />
            </View>
            <View style={styles.routeDetailContent}>
              <Text style={styles.routeDetailLabel}>Điểm đón</Text>
              <Text style={styles.routeDetailText}>
                {pickup.name || requestDetails?.pickup_location?.name || quote?.pickupAddress || 'Không xác định'}
              </Text>
              {pickup.address && pickup.address !== 'N/A' && (
                <Text style={styles.routeDetailAddress}>{pickup.address}</Text>
              )}
              {pickup.lat && pickup.lng && (
                <Text style={styles.routeDetailCoords}>
                  {typeof pickup.lat === 'number' ? pickup.lat.toFixed(6) : String(pickup.lat || '')}, {typeof pickup.lng === 'number' ? pickup.lng.toFixed(6) : String(pickup.lng || '')}
                </Text>
              )}
            </View>
          </View>
          
          <View style={styles.routeDivider} />
          
          <View style={styles.routeDetailRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="location-on" size={20} color="#F44336" />
            </View>
            <View style={styles.routeDetailContent}>
              <Text style={styles.routeDetailLabel}>Điểm đến</Text>
              <Text style={styles.routeDetailText}>
                {dropoff.name || requestDetails?.dropoff_location?.name || quote?.dropoffAddress || 'Không xác định'}
              </Text>
              {dropoff.address && dropoff.address !== 'N/A' && (
                <Text style={styles.routeDetailAddress}>{dropoff.address}</Text>
              )}
              {dropoff.lat && dropoff.lng && (
                <Text style={styles.routeDetailCoords}>
                  {typeof dropoff.lat === 'number' ? dropoff.lat.toFixed(6) : String(dropoff.lat || '')}, {typeof dropoff.lng === 'number' ? dropoff.lng.toFixed(6) : String(dropoff.lng || '')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Timing Info */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionTitle}>Thời gian</Text>
          
          {details.pickup_time && (
            <View style={styles.detailItem}>
              <Icon name="schedule" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Thời gian đón dự kiến</Text>
                <Text style={styles.detailValue}>{formatDateTime(details.pickup_time)}</Text>
              </View>
            </View>
          )}
          
          {details.estimated_pickup_time && (
            <View style={styles.detailItem}>
              <Icon name="access-time" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Thời gian đón ước tính</Text>
                <Text style={styles.detailValue}>{formatDateTime(details.estimated_pickup_time)}</Text>
              </View>
            </View>
          )}
          
          {details.estimated_dropoff_time && (
            <View style={styles.detailItem}>
              <Icon name="flag" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Thời gian đến ước tính</Text>
                <Text style={styles.detailValue}>{formatDateTime(details.estimated_dropoff_time)}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Route Details */}
        {route.name && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Thông tin tuyến</Text>
            
            <View style={styles.detailItem}>
              <Icon name="route" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Tên tuyến</Text>
                <Text style={styles.detailValue}>{route.name}</Text>
              </View>
            </View>
            
            <View style={styles.detailItem}>
              <Icon name="category" size={20} color="#666" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Loại tuyến</Text>
                <Text style={styles.detailValue}>
                  {route.route_type === 'TEMPLATE' ? 'Tuyến mẫu' : 
                   route.route_type === 'CUSTOM' ? 'Tuyến tùy chỉnh' : (route.route_type || 'Không xác định')}
                </Text>
              </View>
            </View>
            
            {route.valid_from && (
              <View style={styles.detailItem}>
                <Icon name="calendar-today" size={20} color="#666" />
                <View style={styles.detailItemContent}>
                  <Text style={styles.detailLabel}>Có hiệu lực từ</Text>
                  <Text style={styles.detailValue}>{formatDateTime(route.valid_from)}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Special Requests */}
        {details.special_requests && details.special_requests !== 'N/A' && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Yêu cầu đặc biệt</Text>
            <View style={styles.specialRequestBox}>
              <Icon name="note" size={20} color="#666" style={styles.specialRequestIcon} />
              <Text style={styles.specialRequestText}>{details.special_requests}</Text>
            </View>
          </View>
        )}

        {/* Discount */}
        {details.discount_amount && details.discount_amount > 0 && (
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>Giảm giá</Text>
            <View style={styles.detailItem}>
              <Icon name="local-offer" size={20} color="#4CAF50" />
              <View style={styles.detailItemContent}>
                <Text style={styles.detailLabel}>Số tiền giảm</Text>
                <Text style={[styles.detailValue, { color: '#4CAF50', fontWeight: '600' }]}>
                  {formatCurrency(details.discount_amount)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.detailedActions}>
          <ModernButton
            title="Hủy chuyến"
            onPress={handleCancelRide}
            disabled={loading || rideStatus === 'ONGOING'}
            variant="outline"
            size="medium"
            icon="cancel"
          />
        </View>
      </ScrollView>
    );
  };

  const renderProposalCard = (proposal, index) => (
    <Animatable.View
      key={proposal.rideId || index}
      animation="fadeInUp"
      delay={index * 100}
      style={styles.proposalCard}
    >
      <View style={styles.proposalHeader}>
        <View style={styles.driverInfo}>
          <View style={styles.driverAvatar}>
            <Icon name="person" size={24} color="#4CAF50" />
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{proposal.driverName}</Text>
            <View style={styles.ratingContainer}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.rating}>{proposal.driverRating || '5.0'}</Text>
              <Text style={styles.ratingCount}>({proposal.ratingCount || '100'})</Text>
            </View>
          </View>
        </View>
        <View style={styles.proposalPrice}>
          <Text style={styles.priceAmount}>
            {rideService.formatCurrency(proposal.fare || quote?.totalFare || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.proposalDetails}>
        <View style={styles.detailRow}>
          <Icon name="access-time" size={16} color="#666" />
          <Text style={styles.detailText}>
            Đón bạn trong {proposal.estimatedArrival || '5-10'} phút
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Icon name="directions-car" size={16} color="#666" />
          <Text style={styles.detailText}>
            {proposal.vehicleInfo || 'Honda Wave - 29A1-12345'}
          </Text>
        </View>
      </View>

      <ModernButton
        title="Chọn tài xế này"
        onPress={() => handleSelectProposal(proposal)}
        size="medium"
        icon="check"
      />
    </Animatable.View>
  );

  const renderRideStatus = () => {
    if (!selectedProposal && !requestDetails) return null;

    const statusConfig = {
      'PENDING': {
        title: 'Đang chờ tài xế xác nhận',
        subtitle: 'Tài xế sẽ phản hồi trong vài phút',
        icon: 'hourglass-empty',
        color: '#FF9800'
      },
      'CONFIRMED': {
        title: 'Tài xế đang đến đón bạn',
        subtitle: `Dự kiến ${selectedProposal.estimatedArrival || '5-10'} phút`,
        icon: 'directions-car',
        color: '#4CAF50'
      },
      'ONGOING': {
        title: 'Đang trong chuyến đi',
        subtitle: 'Chúc bạn có chuyến đi an toàn',
        icon: 'navigation',
        color: '#2196F3'
      },
      'COMPLETED': {
        title: 'Chuyến đi hoàn thành',
        subtitle: 'Cảm ơn bạn đã sử dụng dịch vụ',
        icon: 'check-circle',
        color: '#4CAF50'
      }
    };

    const config = statusConfig[rideStatus] || statusConfig['PENDING'];

    return (
      <Animatable.View animation="slideInUp" style={styles.statusContainer}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIcon, { backgroundColor: config.color + '20' }]}>
            <Icon name={config.icon} size={24} color={config.color} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>{config.title}</Text>
            <Text style={styles.statusSubtitle}>{config.subtitle}</Text>
          </View>
        </View>

        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Icon name="person" size={24} color="#4CAF50" />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{selectedProposal.driverName}</Text>
              <Text style={styles.vehicleInfo}>{selectedProposal.vehicleInfo}</Text>
            </View>
          </View>
          
          <View style={styles.driverActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleCallDriver}
            >
              <Icon name="phone" size={20} color="#4CAF50" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Tin nhắn', 'Tính năng nhắn tin đang phát triển')}
            >
              <Icon name="message" size={20} color="#4CAF50" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tripDetails}>
          <View style={styles.tripRow}>
            <Icon name="radio-button-checked" size={16} color="#4CAF50" />
            <Text style={styles.tripText} numberOfLines={1}>
              {requestDetails?.pickup_location?.name || 
               quote?.pickupAddress || 
               driverInfo?.pickup_location_name || 
               'Điểm đón'}
            </Text>
          </View>
          
          <View style={styles.tripDivider} />
          
          <View style={styles.tripRow}>
            <Icon name="location-on" size={16} color="#F44336" />
            <Text style={styles.tripText} numberOfLines={1}>
              {requestDetails?.dropoff_location?.name || 
               quote?.dropoffAddress || 
               driverInfo?.dropoff_location_name || 
               'Điểm đến'}
            </Text>
          </View>
        </View>
        
        {/* Hint to drag up for details */}
        <TouchableOpacity 
          style={styles.dragHint}
          onPress={() => {
            const maxHeight = Dimensions.get('window').height * 0.8;
            const minHeight = 120;
            Animated.spring(sheetHeight, {
              toValue: maxHeight - minHeight,
              useNativeDriver: false,
              tension: 50,
              friction: 7,
            }).start();
            setShowDetailsSheet(true);
          }}
        >
          <Icon name="keyboard-arrow-up" size={24} color="#666" />
          <Text style={styles.dragHintText}>Kéo lên để xem chi tiết</Text>
        </TouchableOpacity>

        <View style={styles.actionButtons}>
          <ModernButton
            title="Hủy chuyến"
            onPress={handleCancelRide}
            disabled={loading || rideStatus === 'ONGOING'}
            variant="outline"
            size="medium"
            icon="cancel"
          />
          
          {/* Rider-side simulation controls (for demo/testing) */}
          <ModernButton
            title="Giả lập tài xế đến"
            onPress={() => {
              try {
                const start = selectedProposal?.driverLocation || quote?.pickup;
                const end = quote?.dropoff;
                if (!start || !end) return;
                locationTrackingService.startSimulation({
                  start: { lat: start.latitude, lng: start.longitude },
                  end: { lat: end.latitude, lng: end.longitude },
                  speedMps: 8.33,
                  localOnly: true,
                });
                Alert.alert('Giả lập', 'Đang giả lập di chuyển…');
              } catch {}
            }}
            size="medium"
            icon="play-circle-outline"
          />
          <ModernButton
            title="Dừng giả lập"
            onPress={() => locationTrackingService.stopSimulation()}
            size="medium"
            icon="pause-circle-outline"
            variant="outline"
          />

          {rideStatus === 'COMPLETED' && (
            <ModernButton
              title="Đánh giá"
              onPress={() => navigation.navigate('RideRating', { ride: selectedProposal })}
              size="medium"
              icon="star"
            />
          )}
        </View>
      </Animatable.View>
    );
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
        <Text style={styles.headerTitle}>
          {showProposals ? 'Chọn tài xế' : 'Theo dõi chuyến xe'}
        </Text>
      </View>

      {/* Map */}
      <GoongMap
        onRef={(api) => { 
          mapRef.current = api;
          // Fit map to route once map is ready
          if (api) {
            setTimeout(() => {
              console.log('📍 [RideTracking] Map ref ready, fitting map...');
              fitMapToRoute();
              mapFittedRef.current = true;
            }, 2500);
          }
        }}
        style={styles.map}
        initialRegion={
          (() => {
            // Try to use pickup location first, then driver location, then current location
            const pickup = quote?.pickup || 
              (driverInfo?.pickupLat && driverInfo?.pickupLng ? {
                latitude: driverInfo.pickupLat,
                longitude: driverInfo.pickupLng
              } : null) ||
              (requestDetails?.pickup_location ? {
                latitude: requestDetails.pickup_location.lat || requestDetails.pickup_location.latitude,
                longitude: requestDetails.pickup_location.lng || requestDetails.pickup_location.longitude
              } : null);
            
            if (pickup) {
              return locationService.getMapRegion(pickup.latitude || pickup.lat, pickup.longitude || pickup.lng);
            }
            
            if (driverLocation) {
              return locationService.getMapRegion(driverLocation.latitude, driverLocation.longitude);
            }
            
            if (currentLocation) {
              return locationService.getMapRegion(currentLocation.latitude, currentLocation.longitude);
            }
            
            return {
              latitude: 10.8231,
              longitude: 106.6297,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            };
          })()
        }
        showsUserLocation={true}
        polyline={routePolyline}
        markers={React.useMemo(() => [
          // Pickup location
          ...(quote?.pickup ? [{
            coordinate: quote.pickup,
            title: "Điểm đón",
            pinColor: "#4CAF50"
          }] : driverInfo?.pickupLat && driverInfo?.pickupLng ? [{
            coordinate: {
              latitude: driverInfo.pickupLat,
              longitude: driverInfo.pickupLng
            },
            title: "Điểm đón",
            pinColor: "#4CAF50"
          }] : requestDetails?.pickup_location ? [{
            coordinate: {
              latitude: requestDetails.pickup_location.lat || requestDetails.pickup_location.latitude,
              longitude: requestDetails.pickup_location.lng || requestDetails.pickup_location.longitude
            },
            title: requestDetails.pickup_location.name || "Điểm đón",
            pinColor: "#4CAF50"
          }] : []),
          // Dropoff location  
          ...(quote?.dropoff ? [{
            coordinate: quote.dropoff,
            title: "Điểm đến",
            pinColor: "#F44336"
          }] : driverInfo?.dropoffLat && driverInfo?.dropoffLng ? [{
            coordinate: {
              latitude: driverInfo.dropoffLat,
              longitude: driverInfo.dropoffLng
            },
            title: "Điểm đến",
            pinColor: "#F44336"
          }] : requestDetails?.dropoff_location ? [{
            coordinate: {
              latitude: requestDetails.dropoff_location.lat || requestDetails.dropoff_location.latitude,
              longitude: requestDetails.dropoff_location.lng || requestDetails.dropoff_location.longitude
            },
            title: requestDetails.dropoff_location.name || "Điểm đến",
            pinColor: "#F44336"
          }] : []),
          // Driver location (if available) - prioritize real-time location
          ...(driverLocation ? [{
            id: 'driver',
            coordinate: {
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            },
            title: `Tài xế ${selectedProposal?.driverName || driverInfo?.driverName || requestDetails?.driver_name || 'Tài xế'}`,
            pinColor: "#2196F3",
            description: "Đang di chuyển"
          }] : selectedProposal?.driverLocation ? [{
            id: 'driver-proposal',
            coordinate: {
              latitude: selectedProposal.driverLocation.latitude || selectedProposal.driverLocation.lat,
              longitude: selectedProposal.driverLocation.longitude || selectedProposal.driverLocation.lng,
            },
            title: `Tài xế ${selectedProposal.driverName}`,
            pinColor: "#2196F3",
            description: "Đang di chuyển"
          }] : []),
          // Current user location
          ...(currentLocation ? [{
            coordinate: {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude
            },
            title: "Vị trí của bạn",
            pinColor: "#FF9800"
          }] : [])
        ], [
          quote,
          driverInfo,
          requestDetails,
          driverLocation,
          selectedProposal,
          currentLocation
        ])}
      />

      {/* ETA chip */}
      {etaText && (
        <View style={styles.etaChip}>
          <Icon name="schedule" size={16} color="#fff" />
          <Text style={styles.etaText}>{etaText}</Text>
        </View>
      )}

      {/* Recenter FAB */}
      <TouchableOpacity style={styles.fab} onPress={recenterMap}>
        <Icon name="my-location" size={22} color="#333" />
      </TouchableOpacity>

      <SOSButton
        onTrigger={handleTriggerSOS}
        disabled={loading}
        size={60}
        showCaption={false}
        style={styles.sosButton}
      />

      {/* Bottom Content */}
      {showProposals ? (
        <View style={styles.proposalsContainer}>
          <Text style={styles.proposalsTitle}>
            Tìm thấy {proposals?.length || 0} tài xế phù hợp
          </Text>
          
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.proposalsList}
          >
            {proposals?.map((proposal, index) => renderProposalCard(proposal, index))}
          </ScrollView>
        </View>
      ) : (
        <Animated.View 
          style={[
            styles.bottomSheet,
            {
              height: sheetHeight.interpolate({
                inputRange: [0, Dimensions.get('window').height * 0.8 - 120],
                outputRange: [120, Dimensions.get('window').height * 0.8],
                extrapolate: 'clamp',
              }),
            }
          ]}
        >
          {/* Handle Bar - Make it draggable */}
          <View 
            style={styles.handleBar}
            {...(panResponder.current?.panHandlers || {})}
          >
            <View style={styles.handle} />
          </View>
          
          {/* Collapsed Content */}
          {!showDetailsSheet && renderRideStatus()}
          
          {/* Expanded Content */}
          {showDetailsSheet && renderDetailedInfo()}
        </Animated.View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  map: {
    flex: 1,
  },
  etaChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  etaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  sosButton: {
    position: 'absolute',
    right: 16,
    top: 100,
    zIndex: 1100,
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  proposalsContainer: {
    backgroundColor: '#fff',
    paddingTop: 20,
    maxHeight: height * 0.4,
  },
  proposalsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  proposalsList: {
    paddingHorizontal: 20,
    gap: 15,
  },
  proposalCard: {
    width: width * 0.8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  proposalPrice: {
    alignItems: 'flex-end',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  proposalDetails: {
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  driverActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  tripDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  tripDivider: {
    height: 20,
    width: 1,
    backgroundColor: '#ddd',
    marginLeft: 8,
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    overflow: 'hidden',
  },
  handleBar: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  dragHintText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  detailedContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  detailedHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
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
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailItemContent: {
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
  routeDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  routeDetailContent: {
    flex: 1,
  },
  routeDetailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  routeDetailText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 4,
  },
  routeDetailAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  routeDetailCoords: {
    fontSize: 11,
    color: '#999',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  specialRequestBox: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  specialRequestIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  specialRequestText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  detailedActions: {
    marginTop: 20,
    marginBottom: 20,
  },
});

export default RideTrackingScreen;
