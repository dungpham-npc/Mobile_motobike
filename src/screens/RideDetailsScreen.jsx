import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import rideService from '../services/rideService';
import ratingService from '../services/ratingService';
import { SoftBackHeader } from '../components/ui/GlassHeader.jsx';
import CleanCard from '../components/ui/CleanCard.jsx';
import AppBackground from '../components/layout/AppBackground.jsx';
import { colors } from '../theme/designTokens';

const RideDetailsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { ride: initialRide, rideId, requestId } = route.params || {};
  const [ride, setRide] = useState(initialRide || null);
  const [rideData, setRideData] = useState(null);
  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(null);

  useEffect(() => {
    loadRideDetails();
  }, [rideId, requestId]);

  const loadRideDetails = async () => {
    try {
      setLoading(true);

      // Load full ride data
      if (rideId) {
        try {
          const rideResponse = await rideService.getRideById(rideId);
          const rideDataObj = rideResponse?.data || rideResponse;
          setRideData(rideDataObj);

          // Load request data if available
          if (requestId) {
            let request = null;
            
            // First, check if ride data has ride_requests
            if (rideDataObj?.ride_requests && Array.isArray(rideDataObj.ride_requests)) {
              request = rideDataObj.ride_requests.find(
                req => req.shared_ride_request_id === requestId || 
                       req.shared_ride_request_id === parseInt(requestId)
              );
            }
            
            // If not found, try to load request data separately
            if (!request) {
              try {
                const requestsResponse = await rideService.getRideRequests(rideId);
                const requestList = Array.isArray(requestsResponse) 
                  ? requestsResponse 
                  : (requestsResponse?.data || requestsResponse?.content || requestsResponse?.items || []);
                request = requestList.find(
                  req => req.shared_ride_request_id === requestId || 
                         req.shared_ride_request_id === parseInt(requestId)
                );
              } catch (reqError) {
              }
            }
            
            if (request) {
              setRequestData(request);
            } else {
            }
          }
        } catch (error) {
          console.error('❌ Error loading ride data:', error);
        }
      }

      // Load rating if ride is completed (check rideData status if ride status is not available)
      const rideStatus = ride?.status || rideData?.status;
      if (requestId && rideStatus === 'COMPLETED') {
        try {
          const ratingsResponse = await ratingService.getRiderRatingsHistory(0, 100);
          const ratings = ratingsResponse?.data || [];
          const rideRating = ratings.find(r => 
            r.shared_ride_request_id === requestId || 
            r.request_id === requestId ||
            r.shared_ride_request_id === parseInt(requestId)
          );
          if (rideRating) {
            setRating(rideRating);
          }
        } catch (ratingError) {
        }
      }
    } catch (error) {
      console.error('❌ Error loading ride details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến đi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Merge data from multiple sources
  const getMergedData = useCallback(() => {
    const request = requestData || ride?.raw || {};
    const rideInfo = rideData || {};
    
    // Get pickup location - check multiple sources with priority
    let pickupLocation = null;
    let pickupAddress = 'N/A';
    
      // Priority 1: request.pickup_location (from requestData)
      if (request?.pickup_location && 
          typeof request.pickup_location.lat === 'number' && 
          typeof request.pickup_location.lng === 'number') {
        pickupLocation = {
          lat: request.pickup_location.lat,
          lng: request.pickup_location.lng,
        };
        // Prioritize name if address is "N/A"
        if (request.pickup_location.address && request.pickup_location.address !== 'N/A') {
          pickupAddress = request.pickup_location.address;
        } else if (request.pickup_location.name) {
          pickupAddress = request.pickup_location.name;
        } else {
          pickupAddress = 'N/A';
        }
      }
      // Priority 2: rideInfo.start_location (from rideData)
      else if (rideInfo?.start_location && 
               typeof rideInfo.start_location.lat === 'number' && 
               typeof rideInfo.start_location.lng === 'number') {
        pickupLocation = {
          lat: rideInfo.start_location.lat,
          lng: rideInfo.start_location.lng,
        };
        // Prioritize name if address is "N/A"
        if (rideInfo.start_location.address && rideInfo.start_location.address !== 'N/A') {
          pickupAddress = rideInfo.start_location.address;
        } else if (rideInfo.start_location.name) {
          pickupAddress = rideInfo.start_location.name;
        } else if (ride?.pickupAddress) {
          pickupAddress = ride.pickupAddress;
        } else {
          pickupAddress = 'N/A';
        }
      }
      // Priority 3: ride.raw.pickup_location (from initial ride data)
      else if (ride?.raw?.pickup_location && 
               typeof ride.raw.pickup_location.lat === 'number' && 
               typeof ride.raw.pickup_location.lng === 'number') {
        pickupLocation = {
          lat: ride.raw.pickup_location.lat,
          lng: ride.raw.pickup_location.lng,
        };
        // Prioritize name if address is "N/A"
        if (ride.raw.pickup_location.address && ride.raw.pickup_location.address !== 'N/A') {
          pickupAddress = ride.raw.pickup_location.address;
        } else if (ride.raw.pickup_location.name) {
          pickupAddress = ride.raw.pickup_location.name;
        } else if (ride?.pickupAddress) {
          pickupAddress = ride.pickupAddress;
        } else {
          pickupAddress = 'N/A';
        }
      }
    // Fallback: just address
    else if (ride?.pickupAddress) {
      pickupAddress = ride.pickupAddress;
    }
    
    // Get dropoff location - check multiple sources with priority
    let dropoffLocation = null;
    let dropoffAddress = 'N/A';
    
    // Priority 1: request.dropoff_location (from requestData)
    if (request?.dropoff_location && 
        typeof request.dropoff_location.lat === 'number' && 
        typeof request.dropoff_location.lng === 'number') {
      dropoffLocation = {
        lat: request.dropoff_location.lat,
        lng: request.dropoff_location.lng,
      };
      dropoffAddress = request.dropoff_location.name || 
                      request.dropoff_location.address || 
                      'N/A';
    } 
    // Priority 2: rideInfo.end_location (from rideData)
    else if (rideInfo?.end_location && 
             typeof rideInfo.end_location.lat === 'number' && 
             typeof rideInfo.end_location.lng === 'number') {
      dropoffLocation = {
        lat: rideInfo.end_location.lat,
        lng: rideInfo.end_location.lng,
      };
      dropoffAddress = rideInfo.end_location.name || 
                      rideInfo.end_location.address || 
                      ride?.dropoffAddress || 
                      'N/A';
    } 
    // Priority 3: ride.raw.dropoff_location (from initial ride data)
    else if (ride?.raw?.dropoff_location && 
             typeof ride.raw.dropoff_location.lat === 'number' && 
             typeof ride.raw.dropoff_location.lng === 'number') {
      dropoffLocation = {
        lat: ride.raw.dropoff_location.lat,
        lng: ride.raw.dropoff_location.lng,
      };
      dropoffAddress = ride.raw.dropoff_location.name || 
                      ride.raw.dropoff_location.address || 
                      ride?.dropoffAddress || 
                      'N/A';
    }
    // Fallback: just address
    else if (ride?.dropoffAddress) {
      dropoffAddress = ride.dropoffAddress;
    }
    
    return {
      rideId: rideId || ride?.rideId || request.shared_ride_id || rideInfo.shared_ride_id,
      requestId: requestId || ride?.requestId || request.shared_ride_request_id,
      status: ride?.status || request.status || rideInfo.status,
      driverName: rideInfo.driver_name || request.driver_name || ride?.driverInfo?.driverName,
      driverId: rideInfo.driver_id || request.driver_id || ride?.driverInfo?.driverId,
      vehicleModel: rideInfo.vehicle_model || null,
      vehiclePlate: rideInfo.vehicle_plate || null,
      pickupAddress: pickupAddress,
      pickupLocation: pickupLocation,
      dropoffAddress: dropoffAddress,
      dropoffLocation: dropoffLocation,
      totalFare: request.fare_amount || 
                request.total_fare || 
                ride?.totalFare || 
                null,
      distance: rideInfo.actual_distance || 
               request.actual_distance || 
               request.distance_km || 
               ride?.distance || 
               null,
      duration: rideInfo.actual_duration || 
               request.actual_duration || 
               request.duration_minutes || 
               null,
      polyline: request.polyline || null,
      createdAt: request.created_at || ride?.createdAt || rideInfo.created_at,
      actualPickupTime: request.actual_pickup_time || ride?.actualPickupTime,
      actualDropoffTime: request.actual_dropoff_time || ride?.actualDropoffTime,
      estimatedPickupTime: request.estimated_pickup_time,
      estimatedDropoffTime: request.estimated_dropoff_time,
      rating: rating,
    };
  }, [rideData, requestData, ride, rating, rideId, requestId]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const period = date.getUTCHours() >= 12 ? 'PM' : 'AM';
      const displayHours = date.getUTCHours() % 12 || 12;
      return `${displayHours}:${minutes} ${period}`;
    } catch (e) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'Chưa có';
    if (amount === 0) return 'Miễn phí';
    return `${Number(amount).toLocaleString('vi-VN')} ₫`;
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ONGOING':
        return '#F97316';
      case 'CONFIRMED':
        return '#3B82F6';
      case 'COMPLETED':
        return '#22C55E';
      case 'CANCELLED':
        return '#EF4444';
      case 'SCHEDULED':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'ONGOING':
        return 'Đang diễn ra';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'SCHEDULED':
        return 'Đã lên lịch';
      default:
        return status || 'Không xác định';
    }
  };

  const handleRateRide = () => {
    const data = getMergedData();
    navigation.navigate('RatingScreen', {
      rideId: data.rideId,
      requestId: data.requestId,
      driverId: data.driverId,
      driverName: data.driverName,
      totalFare: data.totalFare,
      actualDistance: data.distance,
      actualDuration: data.duration,
    });
  };

  const handleResumeRide = () => {
    const data = getMergedData();
    if (data.status === 'ONGOING' || data.status === 'CONFIRMED') {
      navigation.navigate('RideTracking', {
        rideId: data.rideId,
        requestId: data.requestId,
      });
    }
  };


  // Get merged data - but only if we have some data
  const data = useMemo(() => {
    if (loading) {
      return null;
    }
    
    // At least one data source should be available
    if (!rideData && !requestData && !ride) {
      return null;
    }
    
    try {
      return getMergedData();
    } catch (error) {
      console.error('❌ Error getting merged data:', error);
      return null;
    }
  }, [loading, rideData, requestData, ride, rating, getMergedData]);


  // Early return AFTER all hooks are called
  if (loading || !data) {
    return (
      <AppBackground>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader
            floating
            topOffset={insets.top + 12}
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const isOngoing = data.status === 'ONGOING' || data.status === 'CONFIRMED';
  const isCompleted = data.status === 'COMPLETED';

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={insets.top + 12}
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header text section */}
          <View style={styles.headerTextSection}>
            <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
            <Text style={styles.headerSubtitle}>Thông tin chi tiết về chuyến đi của bạn</Text>
          </View>

          {/* Status Card */}
          <Animatable.View animation="fadeInUp" duration={480} delay={60}>
            <CleanCard style={styles.card} contentStyle={styles.cardContent}>
              <View style={styles.statusHeader}>
                <View style={styles.statusInfo}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(data.status) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(data.status) }]}>
                    {getStatusText(data.status)}
                  </Text>
                </View>
                {data.rideId && (
                  <Text style={styles.rideId}>ID: #{data.rideId}</Text>
                )}
              </View>
              {data.createdAt && (
                <Text style={styles.dateText}>{formatDate(data.createdAt)}</Text>
              )}
            </CleanCard>
          </Animatable.View>

          {/* Route Info */}
          <Animatable.View animation="fadeInUp" duration={480} delay={120}>
            <CleanCard style={styles.card} contentStyle={styles.cardContent}>
              <Text style={styles.cardTitle}>Lộ trình</Text>
              
              <View style={styles.routeContainer}>
                <View style={styles.routePoint}>
                  <View style={styles.pickupDot} />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>Điểm đón</Text>
                    <Text style={styles.locationAddress}>{data.pickupAddress}</Text>
                    {data.actualPickupTime && (
                      <View style={styles.timeRow}>
                        <Icon name="access-time" size={14} color={colors.textSecondary} />
                        <Text style={styles.timeText}> {formatTime(data.actualPickupTime)}</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.routeLine} />
                
                <View style={styles.routePoint}>
                  <View style={styles.dropoffDot} />
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName}>Điểm đến</Text>
                    <Text style={styles.locationAddress}>{data.dropoffAddress}</Text>
                    {data.actualDropoffTime && (
                      <View style={styles.timeRow}>
                        <Icon name="access-time" size={14} color={colors.textSecondary} />
                        <Text style={styles.timeText}> {formatTime(data.actualDropoffTime)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {(data.distance || data.duration) && (
                <View style={styles.routeStats}>
                  {data.distance && (
                    <View style={styles.statItem}>
                      <Icon name="straighten" size={16} color={colors.textSecondary} />
                      <Text style={styles.statText}>
                        {typeof data.distance === 'number' 
                          ? `${data.distance.toFixed(2)} km` 
                          : `${data.distance} km`}
                      </Text>
                    </View>
                  )}
                  {data.duration && (
                    <View style={styles.statItem}>
                      <Icon name="schedule" size={16} color={colors.textSecondary} />
                      <Text style={styles.statText}>
                        {typeof data.duration === 'number' 
                          ? `${data.duration} phút` 
                          : `${data.duration} phút`}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </CleanCard>
          </Animatable.View>

          {/* Driver Info */}
          {data.driverName && (
            <Animatable.View animation="fadeInUp" duration={480} delay={180}>
              <CleanCard style={styles.card} contentStyle={styles.cardContent}>
                <Text style={styles.cardTitle}>Tài xế</Text>
                <View style={styles.driverInfo}>
                  <View style={styles.driverAvatar}>
                    <Icon name="person" size={24} color={colors.textSecondary} />
                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{data.driverName}</Text>
                    {data.vehiclePlate && (
                      <Text style={styles.vehicleInfo}>
                        {data.vehicleModel ? `${data.vehicleModel} • ` : ''}
                        {data.vehiclePlate}
                      </Text>
                    )}
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Payment Card */}
          {data.totalFare !== null && (
            <Animatable.View animation="fadeInUp" duration={480} delay={240}>
              <CleanCard style={styles.card} contentStyle={styles.cardContent}>
                <Text style={styles.cardTitle}>Thanh toán</Text>
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Tổng cộng:</Text>
                  <Text style={styles.fareValue}>{formatCurrency(data.totalFare)}</Text>
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Rating Card */}
          {isCompleted && data.rating && (
            <Animatable.View animation="fadeInUp" duration={480} delay={300}>
              <CleanCard style={styles.card} contentStyle={styles.cardContent}>
                <Text style={styles.cardTitle}>Đánh giá của bạn</Text>
                <View style={styles.ratingInfo}>
                  <View style={styles.ratingStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name={star <= data.rating.rating_score ? 'star' : 'star-border'}
                        size={24}
                        color="#FFA500"
                      />
                    ))}
                  </View>
                  {data.rating.comment && (
                    <Text style={styles.ratingComment}>{data.rating.comment}</Text>
                  )}
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Action Buttons */}
          {(isOngoing || (isCompleted && !data.rating)) && (
            <Animatable.View animation="fadeInUp" duration={480} delay={360}>
              <CleanCard style={styles.card} contentStyle={styles.actionCardContent}>
                {isOngoing && (
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleResumeRide}
                    activeOpacity={0.7}
                  >
                    <Icon name="play-arrow" size={20} color={colors.primary} />
                    <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                      Tiếp tục theo dõi
                    </Text>
                  </TouchableOpacity>
                )}
                
                {isCompleted && !data.rating && (
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleRateRide}
                    activeOpacity={0.7}
                  >
                    <Icon name="star-rate" size={20} color="#FFA500" />
                    <Text style={[styles.actionButtonText, { color: '#FFA500' }]}>
                      Đánh giá chuyến đi
                    </Text>
                  </TouchableOpacity>
                )}
              </CleanCard>
            </Animatable.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  headerTextSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 12,
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  rideId: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  dateText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 10,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    marginRight: 14,
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dropoffDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    marginRight: 14,
    marginTop: 4,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  routeLine: {
    width: 2,
    height: 30,
    backgroundColor: 'rgba(148,163,184,0.3)',
    marginLeft: 6,
    marginVertical: 4,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  timeText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  routeStats: {
    flexDirection: 'row',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  routeInfoContainer: {
    gap: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(148,163,184,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  routeInfoText: {
    flex: 1,
  },
  driverName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
  },
  fareLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  fareValue: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  ratingInfo: {
    marginTop: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 4,
  },
  ratingComment: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  actionCardContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});

export default RideDetailsScreen;
