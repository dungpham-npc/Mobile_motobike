import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import locationService from '../../services/LocationService';
import rideService from '../../services/rideService';
import activeRideService from '../../services/activeRideService';
import websocketService from '../../services/websocketService';
import goongService from '../../services/goongService';
import GoongMap from '../../components/GoongMap.jsx';

const { width, height } = Dimensions.get('window');

const RideTrackingScreen = ({ navigation, route }) => {
  const { rideId, requestId, driverInfo, status, quote } = route.params || {};
  
  // LOG ALL ROUTE PARAMS FOR DEBUG (ONLY ONCE)
  const hasLoggedParams = React.useRef(false);
  if (!hasLoggedParams.current) {
    console.log('🚗 [RideTracking] Received route params:', {
      rideId,
      requestId,
      driverInfo,
      status,
      quote,
      allParams: route.params
    });
    hasLoggedParams.current = true;
  }
  
  // States
  const [riderLocation, setRiderLocation] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [rideStatus, setRideStatus] = useState(status || 'CONFIRMED');
  const [loading, setLoading] = useState(false);
  const [rideData, setRideData] = useState(null);
  const [mapPolyline, setMapPolyline] = useState([]);
  const [fullPolyline, setFullPolyline] = useState([]);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [showBottomSheet, setShowBottomSheet] = useState(true);

  // Map ref
  const mapRef = useRef(null);
  const [markerUpdateKey, setMarkerUpdateKey] = useState(0);
  const lastRecenterTime = useRef(0);
  const RECENTER_THROTTLE = 3000; // Recenter every 3 seconds
  const trackingSubscriptionRef = useRef(null);
  const [currentPolylineEncoded, setCurrentPolylineEncoded] = useState(null);

  // Polyline decoder (Google Encoded Polyline)
  const decodePolyline = (encoded) => {
    if (!encoded || typeof encoded !== 'string') {
      return [];
    }
    
    try {
      // Handle escaped backslashes
      const cleanedPolyline = encoded.replace(/\\\\/g, '\\');
      let index = 0, lat = 0, lng = 0, coordinates = [];
      
      while (index < cleanedPolyline.length) {
        let b, shift = 0, result = 0;
        do {
          if (index >= cleanedPolyline.length) break;
          b = cleanedPolyline.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;
        
        shift = 0; result = 0;
        do {
          if (index >= cleanedPolyline.length) break;
          b = cleanedPolyline.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;
        
        coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
      }
      
      return coordinates;
    } catch (error) {
      console.error('❌ Error decoding polyline:', error);
      return [];
    }
  };

  // Helper function to trim polyline - keep only the REMAINING route (from driver to destination)
  // Remove the part that driver has already traveled
  const trimPolylineFromDriverLocation = (fullPolyline, driverLocation) => {
    if (!fullPolyline || fullPolyline.length === 0 || !driverLocation) return fullPolyline;
    
    let closestIndex = 0;
    let minDistance = Infinity;
    
    // Find closest point on polyline to driver's current location
    fullPolyline.forEach((point, index) => {
      const distance = locationService.calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        point.latitude || point.lat,
        point.longitude || point.lng
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Return remaining route: from driver's position to destination
    // This removes the already-traveled part (0 to closestIndex)
    return fullPolyline.slice(closestIndex);
  };

  // Update polyline from encoded string
  const updatePolylineFromEncoded = React.useCallback(
    (encoded, context = 'tracking') => {
      if (!encoded || typeof encoded !== 'string') {
        return;
      }
      setCurrentPolylineEncoded((prevEncoded) => {
        if (prevEncoded === encoded) {
          return prevEncoded;
        }
        try {
          const decodedPolyline = goongService.decodePolyline(encoded);
          const formattedPolyline = decodedPolyline.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          }));
          setFullPolyline(formattedPolyline);
          setMapPolyline(formattedPolyline);
          return encoded;
        } catch (error) {
          console.error('❌ [RideTracking] Error decoding polyline:', error);
          return prevEncoded;
        }
      });
    },
    []
  );

  // Apply tracking snapshot data
  const applyTrackingSnapshot = React.useCallback(
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
        updatePolylineFromEncoded(snapshot.polyline, 'snapshot');
      }

      if (snapshot.estimatedArrival) {
        // Parse estimated arrival if it's a string
        const eta = parseInt(snapshot.estimatedArrival);
        if (!isNaN(eta)) {
          setEtaMinutes(eta);
        }
      }
    },
    [updatePolylineFromEncoded]
  );

  // Fetch tracking snapshot
  const fetchTrackingSnapshot = React.useCallback(async (targetRideId) => {
    if (!targetRideId) {
      return null;
    }
    try {
      const response = await rideService.getRideTrackingSnapshot(targetRideId);
      return response?.data ?? response;
    } catch (error) {
      console.error('❌ [RideTracking] Error fetching tracking snapshot:', error);
      return null;
    }
  }, []);

  // Sync tracking snapshot
  const syncTrackingSnapshot = React.useCallback(
    async (targetRideId) => {
      const data = await fetchTrackingSnapshot(targetRideId);
      if (data) {
        applyTrackingSnapshot(data);
      }
    },
    [fetchTrackingSnapshot, applyTrackingSnapshot]
  );

  useEffect(() => {
    initializeTracking();
    return () => {
      locationService.stopLocationTracking();
      if (trackingSubscriptionRef.current && rideId) {
        websocketService.unsubscribeFromRideTracking(rideId);
      }
    };
  }, [rideId]);

  const initializeTracking = async () => {
    try {
      // Get rider location
      const location = await locationService.getCurrentLocation();
      setRiderLocation(location);

      // Center map to rider location immediately
      if (location && mapRef.current) {
        setTimeout(() => {
          try {
            mapRef.current.animateToRegion({
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 1000);
          } catch (e) {
          }
        }, 500);
      }

      // Start location tracking for rider
      locationService.startLocationTracking((newLocation) => {
        setRiderLocation(newLocation);
      });

      // Load ride data
      if (rideId) {
        await loadRideData();
      }

      // Connect WebSocket to receive driver location updates
      await connectToRideTracking();

      // Save active ride
      if (driverInfo && rideId) {
        activeRideService.saveActiveRide({
          rideId: rideId,
          requestId: requestId,
          status: rideStatus,
          userType: 'rider',
          driverInfo: driverInfo,
          ...driverInfo
        });
      }
    } catch (error) {
      console.error('Error initializing tracking:', error);
    }
  };

  const loadRideData = async () => {
    try {
      setLoading(true);
      const rideResponse = await rideService.getRideById(rideId);
      const ride = rideResponse?.data || rideResponse;
      
      console.log('🗺️ [RideTracking] Full ride data:', ride);
      console.log('🗺️ [RideTracking] Ride structure:', {
        driver_id: ride?.driver_id,
        driver_name: ride?.driver_name,
        pickup_location: ride?.pickup_location,
        dropoff_location: ride?.dropoff_location,
        fare: ride?.fare,
        total_fare: ride?.total_fare,
        polyline: ride?.polyline ? 'exists' : 'null'
      });
      
      setRideData(ride);
      
      // Update polyline - check multiple possible fields
      let polylineString = ride?.polyline || 
                          ride?.route?.polyline || 
                          ride?.data?.polyline ||
                          null;
      
      
      // Also check if there's a request-specific polyline
      if (!polylineString && requestId) {
        
        // Check ride_requests array (if already included)
        if (ride?.ride_requests && Array.isArray(ride.ride_requests)) {
          const request = ride.ride_requests.find(req => 
            req.shared_ride_request_id === requestId || 
            req.shared_ride_request_id === parseInt(requestId)
          );
          if (request) {
            polylineString = request?.polyline || null;
          }
        } else {
          // ride_requests not included, fetch separately
          try {
            const requestsResponse = await rideService.getRideRequests(rideId);
            const requestList = Array.isArray(requestsResponse) 
              ? requestsResponse 
              : (requestsResponse?.data || requestsResponse?.content || requestsResponse?.items || []);
            
            const request = requestList.find(req => 
              req.shared_ride_request_id === requestId || 
              req.shared_ride_request_id === parseInt(requestId)
            );
            
            if (request) {
              polylineString = request?.polyline || null;
            } else {
            }
          } catch (fetchError) {
            console.error('  - Failed to fetch ride requests:', fetchError);
          }
        }
      }
      
      if (polylineString) {
        const decoded = decodePolyline(polylineString);
        if (decoded && decoded.length > 0) {
          console.log('🗺️ [RideTracking] Setting initial polyline:', decoded.length, 'points');
          setFullPolyline(decoded);
          setMapPolyline(decoded);
        }
      }
      
      // Update status
      if (ride?.status) {
        setRideStatus(ride.status);
      }
      
      // Calculate initial ETA
      if (ride?.estimated_duration_minutes) {
        setEtaMinutes(ride.estimated_duration_minutes);
      }
      if (ride?.distance_km) {
        setDistanceKm(ride.distance_km);
      }
    } catch (error) {
      console.error('Failed to load ride data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRideStatusUpdate = (data) => {
    
    try {
      const status = data?.status;
      const phase = data?.phase;
      const message = data?.message;
      
      if (status === 'PICKUP_COMPLETED' && phase === 'TO_DROPOFF') {
        setRideStatus('ONGOING');
        
        // Show notification to rider
        Alert.alert(
          'Đã được đón',
          message || 'Tài xế đã nhận bạn. Đang di chuyển đến điểm đến.',
          [{ text: 'OK' }]
        );
        
        // Reload ride data to get updated polyline for dropoff route
        loadRideData();
      } else if (status === 'RIDE_COMPLETED' && phase === 'COMPLETED') {
        setRideStatus('COMPLETED');
        
        // Show completion message with rating prompt
        Alert.alert(
          'Chuyến đi hoàn thành',
          message || 'Chuyến đi của bạn đã hoàn thành. Vui lòng đánh giá tài xế.',
          [
            {
              text: 'Đánh giá ngay',
              onPress: () => {
                // Navigate to rating screen
                navigation.replace('RatingScreen', {
                  rideId: data.rideId,
                  requestId: data.requestId,
                  driverId: data.driverId,
                  driverName: data.driverName,
                  totalFare: data.totalFare,
                  actualDistance: data.actualDistance,
                  actualDuration: data.actualDuration,
                });
              },
            },
            {
              text: 'Để sau',
              onPress: () => {
                // Navigate back to home
                navigation.navigate('Home');
              },
            },
          ]
        );
        
        // Clear active ride
        activeRideService.clearActiveRide();
      }
    } catch (error) {
      console.error('Error handling ride status update:', error);
    }
  };

  const handleNotification = (notification) => {
    try {
      console.log('🔔 [RideTracking] Received notification:', notification);
      
      // Handle specific notification types
      switch (notification.type) {
        case 'RIDE_ACCEPTED':
        case 'REQUEST_ACCEPTED':
          console.log('✅ [RideTracking] Driver accepted ride');
          Alert.alert(
            '✅ Tài xế đã nhận chuyến',
            notification.message || 'Tài xế đã chấp nhận yêu cầu của bạn. Vui lòng chờ tài xế đến đón.'
          );
          break;
          
        case 'REQUEST_STARTED':
          console.log('📍 Driver started pickup');
          setRideStatus('ONGOING');
          if (notification.priority === 'HIGH' && notification.title && notification.message) {
            Alert.alert(notification.title, notification.message);
          }
          break;
          
        case 'WALLET_HOLD':
          console.log('🔒 [RideTracking] Wallet hold notification received:', notification);
          break;
          
        case 'BOOKING_REQUEST_CREATED':
          console.log('📝 [RideTracking] Booking request created');
          Alert.alert(
            '✅ Đã tạo yêu cầu',
            'Đang tìm tài xế phù hợp cho bạn...'
          );
          break;
          
        case 'WALLET_CAPTURE':
          console.log('💰 Payment captured');
          // Parse payment info
          let paymentInfo = {};
          try {
            if (notification.payload) {
              paymentInfo = typeof notification.payload === 'string' 
                ? JSON.parse(notification.payload) 
                : notification.payload;
            }
          } catch (parseError) {
            console.error('Error parsing payment payload:', parseError);
          }
          
          // Show payment success
          const capturedAmount = paymentInfo.capturedAmount || 0;
          Alert.alert(
            '💰 Thanh toán thành công',
            `Đã thanh toán: ${capturedAmount.toLocaleString('vi-VN')} VND\n\n${notification.message || ''}`
          );
          break;
          
        case 'REQUEST_COMPLETED':
          console.log('✅ Ride completed');
          setRideStatus('COMPLETED');
          
          // Fetch ride details to get actual distance and duration
          (async () => {
            try {
              let actualDistance, actualDuration;
              
              // Try to fetch ride details from backend
              try {
                const rideDetails = await rideService.getRideDetails(rideId);
                console.log('📊 [RideTracking] Fetched ride details after completion:', rideDetails);
                actualDistance = rideDetails?.actual_distance || rideDetails?.actualDistance;
                actualDuration = rideDetails?.actual_duration || rideDetails?.actualDuration;
              } catch (error) {
                console.warn('⚠️ Could not fetch ride details:', error);
              }
              
              // Show completion with rating prompt
              Alert.alert(
                '🎉 Chuyến đi hoàn thành',
                'Cảm ơn bạn đã sử dụng dịch vụ!\n\nVui lòng đánh giá tài xế để giúp chúng tôi cải thiện dịch vụ.',
                [
                  {
                    text: 'Bỏ qua',
                    style: 'cancel',
                    onPress: () => {
                      // Clear active ride and go home
                      activeRideService.clearActiveRide().catch(console.error);
                      navigation.navigate('Home');
                    }
                  },
                  {
                    text: 'Đánh giá ngay',
                    onPress: () => {
                      // Navigate to rating screen
                      // Get values from route params and current state
                      const currentRideData = rideData;
                      
                      // Debug log before navigation
                      console.log('⭐ [RideTracking] Navigating to RatingScreen with:', {
                        rideId,
                        requestId,
                        driverInfo,
                        currentRideData,
                        quote,
                        actualDistance,
                        actualDuration
                      });
                      
                      const ratingParams = {
                        rideId: rideId,
                        requestId: requestId,
                        driverId: driverInfo?.driverId || driverInfo?.driver_id || driverInfo?.id || currentRideData?.driver_id,
                        driverName: driverInfo?.driverName || driverInfo?.driver_name || driverInfo?.name || currentRideData?.driver_name || 'Tài xế',
                        totalFare: driverInfo?.totalFare || quote?.totalFare || quote?.fare || currentRideData?.fare || currentRideData?.total_fare || 0,
                        actualDistance: actualDistance,
                        actualDuration: actualDuration
                      };
                      
                      console.log('⭐ [RideTracking] Final rating params:', ratingParams);
                      
                      navigation.replace('RatingScreen', ratingParams);
                    }
                  }
                ],
                { cancelable: false }
              );
            } catch (error) {
              console.error('❌ Error handling ride completion:', error);
            }
          })();
          break;
          
        case 'RIDE_CANCELLED':
          console.log('❌ Ride cancelled');
          Alert.alert(
            'Chuyến đi đã bị hủy', 
            notification.message,
            [
              {
                text: 'OK',
                onPress: () => {
                  activeRideService.clearActiveRide().catch(console.error);
                  navigation.navigate('Home');
                }
              }
            ]
          );
          break;
          
        default:
          // Show other HIGH priority notifications
          if (notification.priority === 'HIGH' && notification.title && notification.message) {
            Alert.alert(notification.title, notification.message);
          }
          break;
      }
    } catch (error) {
      console.error('❌ [RideTracking] Error handling notification:', error);
    }
  };

  const connectToRideTracking = async () => {
    try {
      if (!rideId) return;
      
      // Connect WebSocket if not connected
      if (!websocketService.isConnected) {
        await websocketService.connectAsRider(
          (data) => {
            handleRideStatusUpdate(data);
          },
          handleNotification
        );
      } else {
        // WebSocket already connected, just update the callbacks
        websocketService.subscribeToRiderMatching((data) => {
          handleRideStatusUpdate(data);
        });
        // IMPORTANT: Also re-subscribe to notifications with new callback
        websocketService.subscribeToNotifications(handleNotification);
      }

      // Note: Snapshot API not available on backend - all data comes via WebSocket
      // Real-time tracking data will be received via /topic/ride.tracking.{rideId}

      // Subscribe to ride tracking updates
      if (trackingSubscriptionRef.current) {
        websocketService.unsubscribeFromRideTracking(rideId);
      }

      const subscriptionKey = websocketService.subscribeToRideTracking(
        rideId,
        (locationUpdate) => {
          try {
            // locationUpdate is already parsed by websocketService
            // It contains: rideId, currentLat, currentLng, polyline, distanceKm, etc.
            
            let latestPoint = {
              lat: locationUpdate.currentLat || locationUpdate.driverLat || locationUpdate.lat,
              lng: locationUpdate.currentLng || locationUpdate.driverLng || locationUpdate.lng,
              polyline: locationUpdate.polyline
            };
            
            if (latestPoint && latestPoint.lat && latestPoint.lng) {
              const newDriverLocation = {
                latitude: latestPoint.lat,
                longitude: latestPoint.lng
              };
              setDriverLocation(newDriverLocation);
              
              // Update polyline from WebSocket tracking update
              // Use polyline from backend (this is the remaining route from driver to destination)
              if (latestPoint.polyline && typeof latestPoint.polyline === 'string' && latestPoint.polyline.trim().length > 0) {
                const decodedPolyline = decodePolyline(latestPoint.polyline);
                if (decodedPolyline.length > 0) {
                  console.log('🗺️ [RideTracking] WebSocket polyline update:', decodedPolyline.length, 'points');
                  // Trim polyline from driver's current location
                  const trimmed = trimPolylineFromDriverLocation(decodedPolyline, newDriverLocation);
                  if (trimmed.length >= 2) {
                    setMapPolyline(trimmed);
                  } else {
                    setMapPolyline(decodedPolyline);
                  }
                }
              }
              
              // Auto-recenter map to driver location (throttled)
              const now = Date.now();
              if (now - lastRecenterTime.current > RECENTER_THROTTLE) {
                lastRecenterTime.current = now;
                if (mapRef.current && mapRef.current.animateToRegion) {
                  try {
                    mapRef.current.animateToRegion({
                      latitude: newDriverLocation.latitude,
                      longitude: newDriverLocation.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }, 1000);
                  } catch (e) {
                  }
                } else {
                }
              }
              
              // Update distance from backend or calculate ETA
              if (latestPoint.distanceKm !== undefined) {
                setDistanceKm(latestPoint.distanceKm);
                // Assume average speed 30 km/h
                const eta = Math.ceil((latestPoint.distanceKm / 30) * 60);
                setEtaMinutes(eta);
              } else if (riderLocation) {
                // Fallback: calculate from rider location
                const distance = locationService.calculateDistance(
                  latestPoint.lat,
                  latestPoint.lng,
                  riderLocation.latitude,
                  riderLocation.longitude
                );
                const eta = Math.ceil((distance / 30) * 60);
                setEtaMinutes(eta);
                setDistanceKm(distance);
              }
            }
          } catch (error) {
            console.error('❌ [RideTracking] Error processing tracking update:', error);
          }
        }
      );

      trackingSubscriptionRef.current = subscriptionKey;
    } catch (error) {
      console.error('❌ Error connecting to ride tracking:', error);
    }
  };

  const recenterMap = () => {
    try {
      if (!mapRef.current) return;
      const points = [];
      
      // Add rider location
      if (riderLocation) {
        points.push({ latitude: riderLocation.latitude, longitude: riderLocation.longitude });
      }
      
      // Add driver location
      if (driverLocation) {
        points.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude });
      }
      
      // Add pickup/dropoff from ride data or driver info
      const pickupLat = rideData?.pickup_lat || driverInfo?.pickupLat || quote?.pickup?.latitude;
      const pickupLng = rideData?.pickup_lng || driverInfo?.pickupLng || quote?.pickup?.longitude;
      if (pickupLat && pickupLng) {
        points.push({ latitude: pickupLat, longitude: pickupLng });
      }
      
      const dropoffLat = rideData?.dropoff_lat || driverInfo?.dropoffLat || quote?.dropoff?.latitude;
      const dropoffLng = rideData?.dropoff_lng || driverInfo?.dropoffLng || quote?.dropoff?.longitude;
      if (dropoffLat && dropoffLng) {
        points.push({ latitude: dropoffLat, longitude: dropoffLng });
      }
      
      if (points.length > 0) {
        mapRef.current.fitToCoordinates(points, { edgePadding: 100 });
      }
    } catch (e) {
      console.error('Recenter map error:', e);
    }
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
              setLoading(true);
              if (requestId) {
                await rideService.cancelRideRequestOfRide(rideId, requestId);
              }
              await activeRideService.clearActiveRide();
              Alert.alert('Thành công', 'Đã hủy chuyến đi', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Cancel ride error:', error);
              Alert.alert('Lỗi', 'Không thể hủy chuyến đi. Vui lòng thử lại.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCallDriver = () => {
    // Try to get phone from multiple possible sources
    const phoneNumber = 
      driverInfo?.phone ||                    // Direct phone field
      driverInfo?.driverPhone || 
      driverInfo?.driver_phone ||
      rideData?.driver?.phone ||              // From rideData (API response)
      rideData?.driver?.user?.phone ||        // Nested in user object
      rideData?.driver_phone ||               // Flat field in ride
      rideData?.driver_user?.phone;           // Another possible structure
    
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    } else {
      // Debug: log available data structure
      console.error('❌ Cannot find driver phone number');
      console.error('driverInfo:', JSON.stringify(driverInfo, null, 2));
      console.error('rideData.driver:', JSON.stringify(rideData?.driver, null, 2));
      Alert.alert(
        'Thông báo', 
        'Không có số điện thoại tài xế. Vui lòng liên hệ qua tin nhắn hoặc thông báo cho admin.'
      );
    }
  };

  const handleSOSAlert = () => {
    Alert.alert(
      'SOS - Khẩn cấp',
      'Bạn có muốn gửi cảnh báo khẩn cấp không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi SOS',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement SOS functionality
            Alert.alert('SOS', 'Đã gửi cảnh báo khẩn cấp đến hệ thống và liên hệ khẩn cấp của bạn');
          }
        }
      ]
    );
  };

  // Get status config
  const getStatusConfig = () => {
    switch (rideStatus) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return {
          title: 'Tài xế đang đến đón bạn',
          subtitle: etaMinutes ? `Còn khoảng ${etaMinutes} phút` : 'Đang tính toán...',
          icon: 'directions-car',
          color: '#4CAF50'
        };
      case 'ONGOING':
        return {
          title: 'Đang trong chuyến đi',
          subtitle: etaMinutes ? `Còn khoảng ${etaMinutes} phút` : 'Chúc bạn có chuyến đi an toàn',
          icon: 'navigation',
          color: '#2196F3'
        };
      case 'COMPLETED':
        return {
          title: 'Chuyến đi hoàn thành',
          subtitle: 'Cảm ơn bạn đã sử dụng dịch vụ',
          icon: 'check-circle',
          color: '#4CAF50'
        };
      default:
        return {
          title: 'Đang chờ xác nhận',
          subtitle: 'Vui lòng đợi...',
          icon: 'hourglass-empty',
          color: '#FF9800'
        };
    }
  };

  const statusConfig = getStatusConfig();

  // Build markers array
  const markers = [];
  
  // Rider location marker
  if (riderLocation) {
    markers.push({
      id: 'rider',
      coordinate: riderLocation,
      title: 'Vị trí của bạn',
      description: 'Hành khách',
      pinColor: '#FF9800',
      updateKey: markerUpdateKey
    });
  }
  
  // Driver location marker
  if (driverLocation) {
    markers.push({
      id: 'driver',
      coordinate: driverLocation,
      title: `Tài xế ${driverInfo?.driverName || ''}`,
      description: driverInfo?.vehicleModel || 'Đang di chuyển',
      pinColor: '#2196F3',
      icon: 'motorcycle',
      updateKey: markerUpdateKey
    });
  }
  
  // Pickup marker (if not ONGOING)
  if (rideStatus !== 'ONGOING' && rideStatus !== 'COMPLETED') {
    const pickupLat = rideData?.pickup_lat || driverInfo?.pickupLat || quote?.pickup?.latitude;
    const pickupLng = rideData?.pickup_lng || driverInfo?.pickupLng || quote?.pickup?.longitude;
    if (pickupLat && pickupLng) {
      markers.push({
        id: 'pickup',
        coordinate: { latitude: pickupLat, longitude: pickupLng },
        title: 'Điểm đón',
        description: rideData?.pickup_location_name || driverInfo?.pickup_location_name || 'Điểm đón',
        pinColor: '#4CAF50'
      });
    }
  }
  
  // Dropoff marker
  const dropoffLat = rideData?.dropoff_lat || driverInfo?.dropoffLat || quote?.dropoff?.latitude;
  const dropoffLng = rideData?.dropoff_lng || driverInfo?.dropoffLng || quote?.dropoff?.longitude;
  if (dropoffLat && dropoffLng) {
    markers.push({
      id: 'dropoff',
      coordinate: { latitude: dropoffLat, longitude: dropoffLng },
      title: 'Điểm đến',
      description: rideData?.dropoff_location_name || driverInfo?.dropoff_location_name || 'Điểm đến',
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
        <View style={styles.topBarInfo}>
          <Text style={styles.topBarTitle}>Chuyến đi #{rideId}</Text>
          <Text style={styles.topBarSubtitle}>{statusConfig.title}</Text>
        </View>
        <TouchableOpacity onPress={handleSOSAlert} style={styles.sosBtn}>
          <Icon name="warning" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>

      {/* Full-Screen Map */}
      <View style={styles.mapContainer}>
        <GoongMap
          onRef={(api) => { mapRef.current = api; }}
          style={styles.map}
          initialRegion={{
            latitude: riderLocation?.latitude || 10.7769,
            longitude: riderLocation?.longitude || 106.7009,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={false}
          markers={markers}
          polyline={mapPolyline}
        />

        {/* ETA Chip */}
        {etaMinutes && (
          <View style={styles.etaChip}>
            <Icon name="schedule" size={16} color="#fff" />
            <Text style={styles.etaText}>{etaMinutes} phút</Text>
            {distanceKm && (
              <>
                <View style={styles.etaDivider} />
                <Text style={styles.etaText}>{distanceKm.toFixed(1)} km</Text>
              </>
            )}
          </View>
        )}

        {/* GPS Recenter Button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}>
          <Icon name="my-location" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet */}
      <Animatable.View 
        animation="slideInUp" 
        style={[styles.bottomSheet, !showBottomSheet && styles.bottomSheetCollapsed]}
      >
        {/* Handle Bar */}
        <TouchableOpacity 
          style={styles.handleBar}
          onPress={() => setShowBottomSheet(!showBottomSheet)}
        >
          <View style={styles.handle} />
        </TouchableOpacity>

        {showBottomSheet && (
          <>
            {/* Status Header */}
            <View style={styles.statusHeader}>
              <View style={[styles.statusIcon, { backgroundColor: statusConfig.color + '20' }]}>
                <Icon name={statusConfig.icon} size={28} color={statusConfig.color} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>{statusConfig.title}</Text>
                <Text style={styles.statusSubtitle}>{statusConfig.subtitle}</Text>
              </View>
            </View>

            {/* Driver Info Card */}
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Icon name="person" size={28} color="#4CAF50" />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{driverInfo?.driverName || 'Tài xế'}</Text>
                <View style={styles.driverRating}>
                  <Icon name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>{driverInfo?.driverRating || '5.0'}</Text>
                </View>
                {(driverInfo?.vehicleModel || driverInfo?.vehiclePlate) && (
                  <Text style={styles.vehicleInfo}>
                    {driverInfo?.vehicleModel || 'Xe máy'} {driverInfo?.vehiclePlate ? `• ${driverInfo.vehiclePlate}` : ''}
                  </Text>
                )}
              </View>
              <View style={styles.driverActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleCallDriver}>
                  <Icon name="phone" size={20} color="#4CAF50" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => Alert.alert('Tin nhắn', 'Tính năng chat đang phát triển')}
                >
                  <Icon name="message" size={20} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trip Details */}
            <View style={styles.tripDetails}>
              <View style={styles.tripRow}>
                <Icon name="radio-button-checked" size={18} color="#4CAF50" />
                <Text style={styles.tripText} numberOfLines={1}>
                  {rideData?.pickup_location?.name || 
                   rideData?.pickup_location?.address || 
                   driverInfo?.pickupAddress || 
                   quote?.pickupAddress || 
                   'Điểm đón'}
                </Text>
              </View>
              
              <View style={styles.tripDivider} />
              
              <View style={styles.tripRow}>
                <Icon name="location-on" size={18} color="#F44336" />
                <Text style={styles.tripText} numberOfLines={1}>
                  {rideData?.dropoff_location?.name || 
                   rideData?.dropoff_location?.address || 
                   driverInfo?.dropoffAddress || 
                   quote?.dropoffAddress || 
                   'Điểm đến'}
                </Text>
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Tổng cước</Text>
              <Text style={styles.priceAmount}>
                {rideService.formatCurrency(driverInfo?.totalFare || rideData?.total_fare || 0)}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {rideStatus !== 'COMPLETED' && rideStatus !== 'ONGOING' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton]}
                  onPress={handleCancelRide}
                  disabled={loading}
                >
                  <Icon name="cancel" size={20} color="#F44336" />
                  <Text style={[styles.actionButtonText, styles.cancelButtonText]}>Hủy chuyến</Text>
                </TouchableOpacity>
              )}
              
              {rideStatus === 'COMPLETED' && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.primaryButton]}
                  onPress={() => {
                    navigation.navigate('RideRating', { rideId, requestId });
                  }}
                >
                  <Icon name="star" size={20} color="#fff" />
                  <Text style={[styles.actionButtonText, styles.primaryButtonText]}>Đánh giá</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </Animatable.View>

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
  topBarInfo: {
    flex: 1,
    marginLeft: 8,
  },
  topBarTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sosBtn: {
    padding: 8,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  etaChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  etaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fff',
    marginHorizontal: 10,
    opacity: 0.5,
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
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    paddingBottom: 20,
  },
  bottomSheetCollapsed: {
    maxHeight: 60,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 4,
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#666',
  },
  driverActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
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
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
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
    width: 2,
    backgroundColor: '#ddd',
    marginLeft: 8,
    marginVertical: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#F44336',
  },
  primaryButtonText: {
    color: '#fff',
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
    fontWeight: '500',
  },
});

export default RideTrackingScreen;
