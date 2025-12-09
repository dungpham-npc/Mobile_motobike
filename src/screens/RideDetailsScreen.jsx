import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ModernButton from '../components/ModernButton';
import CleanCard from '../components/ui/CleanCard';
import rideService from '../services/rideService';
import websocketService from '../services/websocketService';
import ratingService from '../services/ratingService';
import { colors } from '../theme/designTokens';
import { parseBackendDate } from '../utils/time';

const RideDetailsScreen = ({ navigation, route }) => {
  const { rideId, requestId: routeRequestId, ride: routeRide } = route?.params || {};
  const [ride, setRide] = useState(routeRide || null);
  const [loading, setLoading] = useState(true);
  const [isRated, setIsRated] = useState(false);
  const [checkingRating, setCheckingRating] = useState(true);
  
  console.log('RideDetailsScreen mounted with rideId:', rideId, 'requestId:', routeRequestId);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joining, setJoining] = useState(false);
  const [quote, setQuote] = useState(null);
  const [notes, setNotes] = useState('');


  useEffect(() => {
    const init = async () => {
      if (rideId) {
        await loadRideDetails();
      }
    };
    
    init();
    
    // Setup WebSocket listener for join request status updates
    setupWebSocketListener();
    
    return () => {
      // Cleanup WebSocket subscription if needed
    };
  }, [rideId]);

  useEffect(() => {
    const checkRating = async () => {
      if (!ride || ride.status !== 'COMPLETED') {
        setCheckingRating(false);
        return;
      }

      try {
        // Get requestId from ride or route params
        const requestId = routeRequestId || 
          ride.shared_ride_request_id || 
          ride.sharedRideRequestId || 
          ride.requestId;
        
        if (!requestId) {
          setCheckingRating(false);
          return;
        }

        // Check if already rated
        const ratingsResponse = await ratingService.getRiderRatingsHistory(0, 100);
        const ratings = ratingsResponse?.data || [];
        const rated = ratings.some(
          (rating) => 
            rating.shared_ride_request_id === requestId || 
            rating.requestId === requestId
        );
        setIsRated(rated);
      } catch (error) {
        console.warn('Could not check rating status:', error);
        setIsRated(false);
      } finally {
        setCheckingRating(false);
      }
    };

    if (ride) {
      checkRating();
    }
  }, [ride, routeRequestId]);
  
  const setupWebSocketListener = () => {
    // Only subscribe if WebSocket is not already connected (to avoid duplicate subscriptions)
    // The HomeScreen already has a global subscription, but we can add a local one for this screen
    try {
      const handleJoinRequestUpdate = (data) => {
        console.log('📨 [RideDetailsScreen] Join request status update:', JSON.stringify(data, null, 2));
        console.log('📨 [RideDetailsScreen] Status:', data.status, 'RequestId:', data.requestId, 'RideId:', data.rideId);
        
        const currentRideId = ride?.shared_ride_id || ride?.sharedRideId || rideId;
        
        // Only handle updates for this ride
        if (data.rideId && data.rideId.toString() !== currentRideId?.toString()) {
          console.log('📨 [RideDetailsScreen] Update not for this ride, ignoring');
          return;
        }
        
        const requestId = data.requestId || data.sharedRideRequestId;
        const driverName = data.driverName || 'N/A';
        
        switch (data.status) {
          case 'JOIN_REQUEST_ACCEPTED':
          case 'ACCEPTED':
            console.log('✅ [RideDetailsScreen] Join request accepted!');
            Alert.alert(
              'Yêu cầu được chấp nhận!',
              data.message || `Tài xế ${driverName} đã chấp nhận yêu cầu tham gia chuyến đi của bạn.`,
              [
                {
                  text: 'Theo dõi chuyến đi',
                  onPress: () => {
                    navigation.navigate('RideTracking', {
                      rideId: data.rideId || currentRideId,
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
                  },
                },
                {
                  text: 'OK',
                  style: 'cancel',
                },
              ],
              { cancelable: false }
            );
            break;
          case 'JOIN_REQUEST_FAILED':
          case 'REJECTED':
            console.log('❌ [RideDetailsScreen] Join request rejected');
            Alert.alert(
              'Yêu cầu bị từ chối',
              data.message || data.reason || 'Tài xế đã từ chối yêu cầu tham gia chuyến đi của bạn.',
              [{ text: 'OK' }],
            );
            // Close the join modal if it's open
            setShowJoinModal(false);
            break;
          case 'CANCELLED':
            console.log('❌ [RideDetailsScreen] Join request cancelled');
            Alert.alert(
              'Yêu cầu đã bị hủy',
              data.message || 'Yêu cầu tham gia chuyến đi của bạn đã bị hủy.',
              [{ text: 'OK' }],
            );
            setShowJoinModal(false);
            break;
          default:
            console.log('📨 [RideDetailsScreen] Unknown status:', data.status);
        }
      };
      
      // Subscribe to rider matching updates if WebSocket is connected
      if (websocketService.isConnected) {
        websocketService.subscribeToRiderMatching(handleJoinRequestUpdate);
        console.log('✅ [RideDetailsScreen] WebSocket listener set up for join request updates');
      } else {
        console.warn('⚠️ [RideDetailsScreen] WebSocket not connected, cannot set up listener');
      }
    } catch (error) {
      console.error('❌ [RideDetailsScreen] Error setting up WebSocket listener:', error);
    }
  };


  const loadRideDetails = async () => {
    try {
      setLoading(true);
      console.log('Loading ride details for rideId:', rideId);
      const response = await rideService.getRideDetails(rideId);
      console.log('Ride details loaded:', response);
      setRide(response);

      // If no requestId in route params, try to get it from ride requests
      if (!routeRequestId && response) {
        try {
          const requestsResponse = await rideService.getRideRequests(rideId);
          const requests = Array.isArray(requestsResponse)
            ? requestsResponse
            : requestsResponse?.data || requestsResponse?.content || [];
          
          // Get the first request (or find by current user)
          if (requests.length > 0) {
            const firstRequest = requests[0];
            // Store requestId in ride object for later use
            if (firstRequest.shared_ride_request_id || firstRequest.sharedRideRequestId) {
              response.requestId = firstRequest.shared_ride_request_id || firstRequest.sharedRideRequestId;
            }
          }
        } catch (reqError) {
          console.warn('Could not load ride requests:', reqError);
        }
      }
    } catch (error) {
      console.error('Error loading ride details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến xe. Vui lòng thử lại.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };


  const handleJoinRide = async () => {
    if (!ride) {
      Alert.alert('Lỗi', 'Không tìm thấy thông tin chuyến xe');
      return;
    }

    // Extract routeId from ride
    const routeId = ride.route?.route_id || ride.route?.routeId || ride.routeId;
    
    if (!routeId) {
      Alert.alert(
        'Lỗi',
        'Chuyến xe này không có tuyến đường được định nghĩa. Không thể tham gia chuyến xe.'
      );
      return;
    }

    try {
      setJoining(true);

      console.log('Getting quote with routeId:', routeId);
      
      // Get quote using routeId (pickup/dropoff are not needed when routeId is provided)
      const normalizedQuote = await rideService.getQuote(
        null, // pickup not needed when routeId is provided
        null, // dropoff not needed when routeId is provided
        null, // desiredPickupTime
        notes || null, // notes
        routeId // routeId
      );

      console.log('Normalized quote:', JSON.stringify(normalizedQuote, null, 2));
      console.log('Quote ID:', normalizedQuote?.quoteId);
      
      if (!normalizedQuote || !normalizedQuote.quoteId) {
        Alert.alert('Lỗi', 'Không thể lấy mã báo giá. Vui lòng thử lại.');
        return;
      }
      
      setQuote(normalizedQuote);
      setShowJoinModal(true);
    } catch (error) {
      console.error('Error getting quote:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Không thể lấy báo giá. Vui lòng thử lại.'
      );
    } finally {
      setJoining(false);
    }
  };

  const confirmJoinRide = async () => {
    if (!quote || !ride) {
      Alert.alert('Lỗi', 'Thiếu thông tin báo giá hoặc chuyến xe');
      return;
    }

    if (!quote.quoteId) {
      Alert.alert('Lỗi', 'Mã báo giá không hợp lệ. Vui lòng thử lại.');
      console.error('Quote missing quoteId:', quote);
      return;
    }

    try {
      setJoining(true);
      const rideIdValue = ride.shared_ride_id || ride.sharedRideId || rideId;

      console.log('Joining ride with:', { rideId: rideIdValue, quoteId: quote.quoteId, notes });

      const response = await rideService.joinRide(
        rideIdValue,
        quote.quoteId,
        null,
        notes || null
      );

      const requestId = response.shared_ride_request_id || response.sharedRideRequestId;

      Alert.alert(
        'Thành công',
        'Yêu cầu tham gia chuyến xe đã được gửi. Vui lòng chờ tài xế xác nhận.',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowJoinModal(false);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error joining ride:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Không thể tham gia chuyến xe. Vui lòng thử lại.'
      );
    } finally {
      setJoining(false);
    }
  };

  const handleRateRide = async () => {
    try {
      const requestId = routeRequestId || 
        ride?.shared_ride_request_id || 
        ride?.sharedRideRequestId || 
        ride?.requestId;

      if (!requestId) {
        Alert.alert('Lỗi', 'Không tìm thấy mã yêu cầu chuyến đi.');
        return;
      }

      // Load request details for rating
      let requestData = null;
      try {
        const requestResponse = await rideService.getRequestDetails(requestId);
        requestData = requestResponse?.data || requestResponse;
      } catch (error) {
        console.warn('Could not load request details, using ride data:', error);
      }

      const driverId = ride?.driver_id || ride?.driverId || requestData?.driver_id || null;
      const driverName = ride?.driver_name || ride?.driverName || requestData?.driver_name || 'Tài xế';
      const totalFare = ride?.total_fare || ride?.totalFare || requestData?.fare_amount || requestData?.total_fare || null;
      const actualDistance = ride?.actual_distance || ride?.actualDistance || requestData?.actual_distance || null;
      const actualDuration = ride?.actual_duration || ride?.actualDuration || requestData?.actual_duration || null;

      navigation.navigate('RideRating', {
        rideId: rideIdValue,
        requestId: requestId,
        driverId,
        driverName,
        totalFare,
        actualDistance,
        actualDuration,
      });
    } catch (error) {
      console.error('Error loading ride data for rating:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến đi. Vui lòng thử lại.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Ngay lập tức';
    const date = parseBackendDate(dateString);
    if (!date) return 'Ngay lập tức';

    return (
      date.toLocaleDateString('vi-VN') +
      ' lúc ' +
      date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return '#4CAF50';
      case 'CANCELLED':
        return '#F44336';
      case 'ONGOING':
        return '#FF9800';
      case 'SCHEDULED':
        return '#2196F3';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'ONGOING':
        return 'Đang diễn ra';
      case 'SCHEDULED':
        return 'Đã lên lịch';
      default:
        return 'Không xác định';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    console.log('No ride data, showing error screen');
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color={colors.textMuted} />
          <Text style={styles.errorText}>Không tìm thấy chuyến xe</Text>
          <ModernButton title="Quay lại" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }
  
  console.log('Rendering ride details for:', ride);

  const rideStatus = ride?.status ? ride.status.toUpperCase() : 'UNKNOWN';
  const rideIdValue = ride?.shared_ride_id || ride?.sharedRideId || rideId || 'N/A';
  const driverName = ride?.driver_name || ride?.driverName || 'Tài xế';
  const driverRating = ride?.driver_rating || ride?.driverRating || 4.8;
  const vehicleModel = ride?.vehicle_model || ride?.vehicleModel || '';
  const vehiclePlate = ride?.vehicle_plate || ride?.vehiclePlate || '';
  const startLocation = ride?.start_location || ride?.startLocation || {};
  const endLocation = ride?.end_location || ride?.endLocation || {};
  const startLocationName = startLocation?.name || 'Điểm đi';
  const endLocationName = endLocation?.name || 'Điểm đến';
  const startLocationAddress = startLocation?.address || 'N/A';
  const endLocationAddress = endLocation?.address || 'N/A';
  const scheduledTime = ride?.scheduled_time || ride?.scheduledTime;
  const estimatedDistance = ride?.estimated_distance || ride?.estimatedDistance || 0;
  const estimatedDuration = ride?.estimated_duration || ride?.estimatedDuration || 0;

  // Allow joining SCHEDULED and ONGOING rides
  const canJoin = rideStatus === 'SCHEDULED' || rideStatus === 'ONGOING';
  // Show rating button for completed rides that haven't been rated
  const canRate = rideStatus === 'COMPLETED' && !isRated && !checkingRating;
  
  console.log('Ride status:', rideStatus, 'canJoin:', canJoin, 'canRate:', canRate);
  console.log('Start location:', startLocation);
  console.log('End location:', endLocation);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusInfo}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(rideStatus) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(rideStatus) }]}>
                {getStatusText(rideStatus)}
              </Text>
            </View>
            <Text style={styles.rideId}>#{rideIdValue}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(scheduledTime)}</Text>
        </View>

        {/* Driver Info Card */}
        <View style={styles.driverInfoCard}>
          <Text style={styles.cardTitle}>Thông tin tài xế</Text>
          <View style={styles.driverDetails}>
            <View style={styles.driverAvatar}>
              <Icon name="person" size={30} color={colors.primary} />
            </View>
            <View style={styles.driverTextInfo}>
              <Text style={styles.driverName}>{driverName}</Text>
              <View style={styles.driverRatingContainer}>
                <Icon name="star" size={16} color="#FFD700" />
                <Text style={styles.driverRatingText}>{driverRating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
          {(vehicleModel || vehiclePlate) && (
            <View style={styles.vehicleInfo}>
              <View style={styles.vehicleInfoRow}>
                <Icon name="two-wheeler" size={18} color="#666" />
                <Text style={styles.vehicleText}>
                  {vehicleModel || 'N/A'}
                </Text>
              </View>
              {vehiclePlate && (
                <View style={styles.vehicleInfoRow}>
                  <Icon name="confirmation-number" size={18} color="#666" />
                  <Text style={styles.vehicleText}>{vehiclePlate}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Route Card */}
        <View style={styles.routeCard}>
          <Text style={styles.cardTitle}>Lộ trình</Text>

          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.pickupDot} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{startLocationName}</Text>
                {startLocationAddress && startLocationAddress !== 'N/A' ? (
                  <Text style={styles.locationAddress}>{startLocationAddress}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={styles.dropoffDot} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationName}>{endLocationName}</Text>
                {endLocationAddress && endLocationAddress !== 'N/A' ? (
                  <Text style={styles.locationAddress}>{endLocationAddress}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.routeStats}>
            {estimatedDistance > 0 && (
              <View style={styles.statItem}>
                <Icon name="straighten" size={16} color="#666" />
                <Text style={styles.statText}>{estimatedDistance.toFixed(1)} km</Text>
              </View>
            )}
            {estimatedDuration > 0 && (
              <View style={styles.statItem}>
                <Icon name="access-time" size={16} color="#666" />
                <Text style={styles.statText}>{estimatedDuration} phút</Text>
              </View>
            )}
          </View>
        </View>

        {/* Route Information for Joining */}
        {canJoin && ride.route && (
          <CleanCard style={styles.card} contentStyle={styles.routeInfoCard}>
            <Text style={styles.cardTitle}>Thông tin tuyến đường</Text>
            <View style={styles.routeInfoContainer}>
              <View style={styles.routeInfoRow}>
                <Icon name="route" size={20} color={colors.primary} />
                <View style={styles.routeInfoText}>
                  <Text style={styles.routeInfoLabel}>Tuyến đường:</Text>
                  <Text style={styles.routeInfoValue}>
                    {ride.route.name || ride.route.code || 'Tuyến đường được định nghĩa'}
                  </Text>
                </View>
              </View>
              {ride.route.default_price && (
                <View style={styles.routeInfoRow}>
                  <Icon name="attach-money" size={20} color={colors.primary} />
                  <View style={styles.routeInfoText}>
                    <Text style={styles.routeInfoLabel}>Giá mặc định:</Text>
                    <Text style={styles.routeInfoValue}>
                      {rideService.formatCurrency(ride.route.default_price)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </CleanCard>
        )}

        {/* Join Ride Button */}
        {canJoin && (
          <View style={styles.joinButtonContainer}>
            <ModernButton
              title="Tham gia chuyến xe"
              icon="directions-car"
              onPress={handleJoinRide}
              loading={joining}
              disabled={joining || !(ride?.route?.route_id || ride?.route?.routeId || ride?.routeId)}
            />
          </View>
        )}

        {/* Rating Button for Completed Rides */}
        {canRate && (
          <View style={styles.ratingButtonContainer}>
            <ModernButton
              title="Đánh giá chuyến đi"
              icon="star"
              onPress={handleRateRide}
              variant="primary"
            />
          </View>
        )}

        {rideStatus === 'COMPLETED' && isRated && (
          <View style={styles.ratedContainer}>
            <Icon name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.ratedText}>Bạn đã đánh giá chuyến đi này</Text>
          </View>
        )}
      </ScrollView>

      {/* Join Confirmation Modal */}
      <Modal
        visible={showJoinModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Xác nhận tham gia</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {quote && (
              <>
                <View style={styles.quoteInfo}>
                  <Text style={styles.quoteLabel}>Cước phí:</Text>
                  <Text style={styles.quoteAmount}>
                    {rideService.formatCurrency(quote.fare?.total || 0)}
                  </Text>
                </View>

                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Ghi chú (tùy chọn):</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Nhập ghi chú cho tài xế..."
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalActions}>
                  <ModernButton
                    title="Hủy"
                    variant="outline"
                    onPress={() => setShowJoinModal(false)}
                    style={styles.modalButton}
                  />
                  <ModernButton
                    title="Xác nhận"
                    icon="check"
                    onPress={confirmJoinRide}
                    loading={joining}
                    disabled={joining}
                    style={styles.modalButton}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 20,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 34,
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  rideId: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  driverInfoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
  },
  driverDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  driverTextInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  driverRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  driverRatingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  vehicleInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  vehicleInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  routeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  routeContainer: {
    marginBottom: 15,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    marginRight: 12,
    marginTop: 4,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F44336',
    marginRight: 12,
    marginTop: 4,
  },
  routeLine: {
    width: 2,
    height: 30,
    backgroundColor: '#ddd',
    marginLeft: 5,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  routeStats: {
    flexDirection: 'row',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  routeInfoCard: {
    padding: 16,
    gap: 12,
  },
  routeInfoContainer: {
    gap: 12,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeInfoText: {
    flex: 1,
  },
  routeInfoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  routeInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1976D2',
    lineHeight: 18,
  },
  joinButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ratingButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ratedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    gap: 8,
  },
  ratedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  quoteInfo: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  quoteLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  quoteAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
    fontWeight: '500',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default RideDetailsScreen;
