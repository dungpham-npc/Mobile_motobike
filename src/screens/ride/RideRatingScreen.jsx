import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton';
import CleanCard from '../../components/ui/CleanCard';
import { colors } from '../../theme/designTokens';
import ratingService from '../../services/ratingService';
import rideService from '../../services/rideService';

const RideRatingScreen = ({ navigation, route }) => {
  const { 
    ride: initialRide, 
    requestId,
    rideId,
    driverId,
    driverName: paramDriverName,
    totalFare: paramTotalFare,
    actualDistance: paramActualDistance,
  } = route.params || {};
  const [ride, setRide] = useState(initialRide);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch request details if requestId is available to ensure we have complete data
  useEffect(() => {
    const fetchRequestDetails = async () => {
      if (!requestId) return;
      
      // Check if we have placeholder/incomplete data
      const driverName = initialRide?.driverInfo?.driverName || initialRide?.driverName || '';
      const pickupName = initialRide?.pickupLocation?.name || initialRide?.pickup_location_name || '';
      const dropoffName = initialRide?.dropoffLocation?.name || initialRide?.dropoff_location_name || '';
      const fare = initialRide?.driverInfo?.totalFare || initialRide?.totalFare || 0;
      
      // Always fetch if we have placeholder data or missing data
      const needsFetch = !initialRide || 
                        driverName === 'Tài xế' || 
                        pickupName === 'Điểm đón' || 
                        dropoffName === 'Điểm đến' || 
                        fare === 0;
      
      if (needsFetch) {
        try {
          setLoading(true);
          console.log('📥 [RideRating] Fetching request details for requestId:', requestId);
          
          const requestDetails = await rideService.getRequestDetails(requestId);
          console.log('📥 [RideRating] Request details:', JSON.stringify(requestDetails, null, 2));
          
          // Extract data from requestDetails with proper fallbacks
          const extractedRide = {
            driverInfo: {
              driverName: requestDetails?.driver_name || requestDetails?.driverName || initialRide?.driverInfo?.driverName || 'Tài xế',
              driverRating: requestDetails?.driver_rating || requestDetails?.driverRating || initialRide?.driverInfo?.driverRating || 4.8,
              vehicleModel: requestDetails?.vehicle_model || requestDetails?.vehicleModel || initialRide?.driverInfo?.vehicleModel || '',
              vehiclePlate: requestDetails?.vehicle_plate || requestDetails?.vehiclePlate || initialRide?.driverInfo?.vehiclePlate || '',
              totalFare: requestDetails?.total_fare?.amount || requestDetails?.totalFare?.amount || requestDetails?.totalFare || initialRide?.driverInfo?.totalFare || 0,
            },
            pickupLocation: {
              name: requestDetails?.pickup_location?.name || requestDetails?.pickupLocation?.name || requestDetails?.pickup_location_name || initialRide?.pickupLocation?.name || 'Điểm đón',
              address: requestDetails?.pickup_location?.address || requestDetails?.pickupLocation?.address || requestDetails?.pickup_location_address || '',
            },
            dropoffLocation: {
              name: requestDetails?.dropoff_location?.name || requestDetails?.dropoffLocation?.name || requestDetails?.dropoff_location_name || initialRide?.dropoffLocation?.name || 'Điểm đến',
              address: requestDetails?.dropoff_location?.address || requestDetails?.dropoffLocation?.address || requestDetails?.dropoff_location_address || '',
            },
            totalFare: requestDetails?.total_fare?.amount || requestDetails?.totalFare?.amount || requestDetails?.totalFare || initialRide?.totalFare || 0,
          };
          
          setRide(extractedRide);
        } catch (error) {
          console.error('❌ [RideRating] Error fetching request details:', error);
          // Keep the initial ride data if fetch fails
        } finally {
          setLoading(false);
        }
      }
    };
    
    fetchRequestDetails();
  }, [requestId, initialRide]);

  const handleStarPress = (value) => {
    setRating(value);
  };

  const handleStarHover = (value) => {
    setHoveredRating(value);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Vui lòng đánh giá', 'Bạn cần chọn số sao để đánh giá tài xế.');
      return;
    }

    if (!requestId) {
      Alert.alert('Lỗi', 'Thiếu thông tin yêu cầu. Không thể gửi đánh giá.');
      return;
    }

    try {
      setSubmitting(true);
      await ratingService.submitRating(requestId, rating, comment || null);

      Alert.alert(
        'Cảm ơn bạn!',
        'Đánh giá của bạn đã được gửi thành công.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert(
        'Lỗi',
        error.message || 'Không thể gửi đánh giá. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    const displayRating = hoveredRating || rating;

    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          activeOpacity={0.7}
          style={styles.starButton}
        >
          <Icon
            name={i <= displayRating ? 'star' : 'star-border'}
            size={48}
            color={i <= displayRating ? '#FBBF24' : '#E5E7EB'}
          />
        </TouchableOpacity>
      );
    }

    return stars;
  };

  const getRatingText = () => {
    if (rating === 0) return 'Chọn số sao';
    const texts = {
      1: 'Rất không hài lòng',
      2: 'Không hài lòng',
      3: 'Bình thường',
      4: 'Hài lòng',
      5: 'Rất hài lòng',
    };
    return texts[rating] || '';
  };

  // Extract display values with fallbacks - prioritize route params
  const driverName = paramDriverName || ride?.driverInfo?.driverName || ride?.driverName || 'Tài xế';
  const pickupLocationName = ride?.pickupLocation?.name || ride?.pickup_location_name || 'Điểm đón';
  const dropoffLocationName = ride?.dropoffLocation?.name || ride?.dropoff_location_name || 'Điểm đến';
  const totalFare = paramTotalFare || ride?.driverInfo?.totalFare || ride?.totalFare || 0;
  const actualDistance = paramActualDistance || ride?.actualDistance || ride?.actual_distance || null;

  // Show loading indicator while fetching request details
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đánh giá chuyến đi</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đánh giá chuyến đi</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Ride Summary Card */}
        <Animatable.View animation="fadeInUp" duration={400} useNativeDriver>
          <CleanCard style={styles.summaryCard} contentStyle={styles.summaryContent}>
            <View style={styles.driverSection}>
              <View style={styles.driverAvatar}>
                <Icon name="person" size={32} color={colors.primary} />
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverName}</Text>
                <View style={styles.routeInfo}>
                  <Icon name="location-on" size={14} color={colors.textSecondary} />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {pickupLocationName} → {dropoffLocationName}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.rideStats}>
              <View style={styles.statItem}>
                <Icon name="attach-money" size={20} color={colors.primary} />
                <View style={styles.statContent}>
                  <Text style={styles.statLabel}>Tổng cước</Text>
                  <Text style={styles.statValue}>
                    {totalFare > 0 ? rideService.formatCurrency(totalFare) : 'Chưa có'}
                  </Text>
                </View>
              </View>

              {actualDistance && actualDistance > 0 && (
                <View style={styles.statItem}>
                  <Icon name="straighten" size={20} color={colors.primary} />
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Khoảng cách</Text>
                    <Text style={styles.statValue}>{actualDistance.toFixed(1)} km</Text>
                  </View>
                </View>
              )}


            </View>
          </CleanCard>
        </Animatable.View>

        {/* Rating Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={100} useNativeDriver>
          <CleanCard style={styles.ratingCard} contentStyle={styles.ratingContent}>
            <Text style={styles.sectionTitle}>Bạn đánh giá chuyến đi này như thế nào?</Text>

            <View style={styles.starsContainer}>
              {renderStars()}
            </View>

            <Text style={styles.ratingText}>{getRatingText()}</Text>
          </CleanCard>
        </Animatable.View>

        {/* Comment Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={200} useNativeDriver>
          <CleanCard style={styles.commentCard} contentStyle={styles.commentContent}>
            <Text style={styles.sectionTitle}>Ghi chú (tùy chọn)</Text>
            <Text style={styles.sectionSubtitle}>
              Chia sẻ thêm về trải nghiệm của bạn với tài xế
            </Text>

            <TextInput
              style={styles.commentInput}
              placeholder="Viết đánh giá của bạn..."
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>{comment.length}/500</Text>
          </CleanCard>
        </Animatable.View>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <ModernButton
            title="Gửi đánh giá"
            icon="send"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || rating === 0}
            size="large"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 34,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  summaryCard: {
    marginBottom: 20,
  },
  summaryContent: {
    padding: 20,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(16,65,47,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  rideStats: {
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  ratingCard: {
    marginBottom: 20,
  },
  ratingContent: {
    padding: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 8,
  },
  commentCard: {
    marginBottom: 20,
  },
  commentContent: {
    padding: 20,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 120,
    backgroundColor: colors.surface,
    marginTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 8,
  },
  submitContainer: {
    marginTop: 20,
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
});

export default RideRatingScreen;

