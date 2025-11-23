import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import * as Animatable from 'react-native-animatable';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import { colors, typography, spacing } from '../../theme/designTokens';
import ratingService from '../../services/ratingService';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const DriverRatingsScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 28 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [stats, setStats] = useState({
    overall: 0,
    total: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  const loadRatings = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await ratingService.getDriverRatingsHistory(0, 50);
      const ratingsData = response?.content || response?.data || [];
      
      setRatings(ratingsData);

      // Calculate stats
      if (ratingsData.length > 0) {
        const total = ratingsData.length;
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        let sum = 0;

        ratingsData.forEach((rating) => {
          const score = rating.score || rating.rating || 0;
          if (score >= 1 && score <= 5) {
            breakdown[score]++;
            sum += score;
          }
        });

        setStats({
          overall: total > 0 ? (sum / total).toFixed(1) : 0,
          total,
          breakdown,
        });
      } else {
        setStats({
          overall: 0,
          total: 0,
          breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        });
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRatings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadRatings();
    }, [])
  );

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Feather
        key={index}
        name="star"
        size={14}
        color={index < rating ? '#FBBF24' : '#E5E7EB'}
        style={styles.starIcon}
      />
    ));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getProgressWidth = (count) => {
    if (stats.total === 0) return 0;
    return (count / stats.total) * 100;
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader
            floating
            topOffset={headerOffset}
            title="Đánh giá của tôi"
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Đánh giá của tôi"
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRatings(true)}
              tintColor={colors.primary}
            />
          }
        >
          {/* Overall Rating Card */}
          <Animatable.View animation="fadeInUp" duration={400} delay={60}>
            <CleanCard contentStyle={styles.overallCard}>
              <View style={styles.overallHeader}>
                <View style={styles.ratingMain}>
                  <Text style={styles.overallRating}>{stats.overall || '0.0'}</Text>
                  <View style={styles.starsRow}>
                    {renderStars(Math.round(parseFloat(stats.overall) || 0))}
                  </View>
                  <Text style={styles.totalText}>
                    {stats.total} {stats.total === 1 ? 'đánh giá' : 'đánh giá'}
                  </Text>
                </View>
                <View style={styles.ratingIconContainer}>
                  <Feather name="star" size={32} color={colors.primary} />
                </View>
              </View>

              {/* Rating Breakdown */}
              {stats.total > 0 && (
                <View style={styles.breakdownContainer}>
                  {[5, 4, 3, 2, 1].map((star) => (
                    <View key={star} style={styles.breakdownRow}>
                      <Text style={styles.starLabel}>{star}</Text>
                      <Feather name="star" size={12} color="#FBBF24" />
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${getProgressWidth(stats.breakdown[star])}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.countLabel}>{stats.breakdown[star]}</Text>
                    </View>
                  ))}
                </View>
              )}
            </CleanCard>
          </Animatable.View>

          {/* Reviews List */}
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>
              Nhận xét từ khách hàng ({stats.total})
            </Text>

            {ratings.length === 0 ? (
              <Animatable.View animation="fadeInUp" duration={400} delay={120}>
                <CleanCard contentStyle={styles.emptyCard}>
                  <View style={styles.emptyState}>
                    <Feather name="message-circle" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
                    <Text style={styles.emptySubtext}>
                      Đánh giá sẽ xuất hiện sau khi khách hàng hoàn thành chuyến đi
                    </Text>
                  </View>
                </CleanCard>
              </Animatable.View>
            ) : (
              ratings.map((rating, index) => {
                const score = rating.score || rating.rating || 0;
                const riderName = rating.rider_name || rating.riderName || 'Khách hàng';
                const comment = rating.comment || '';
                const createdAt = rating.created_at || rating.createdAt;

                return (
                  <Animatable.View
                    key={rating.rating_id || rating.ratingId || index}
                    animation="fadeInUp"
                    duration={400}
                    delay={120 + index * 50}
                  >
                    <CleanCard contentStyle={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewerInfo}>
                          <View style={styles.reviewerAvatar}>
                            <Feather name="user" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.reviewerDetails}>
                            <Text style={styles.reviewerName}>{riderName}</Text>
                            {createdAt && (
                              <Text style={styles.reviewDate}>{formatDate(createdAt)}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.reviewRating}>
                          {renderStars(score)}
                        </View>
                      </View>

                      {comment ? (
                        <Text style={styles.reviewComment}>{comment}</Text>
                      ) : (
                        <Text style={styles.reviewCommentEmpty}>
                          Khách hàng chưa để lại nhận xét
                        </Text>
                      )}
                    </CleanCard>
                  </Animatable.View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  overallCard: {
    padding: spacing.lg,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ratingMain: {
    flex: 1,
  },
  overallRating: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  starIcon: {
    marginHorizontal: 1,
  },
  totalText: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  ratingIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  starLabel: {
    width: 20,
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  countLabel: {
    width: 30,
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    textAlign: 'right',
  },
  reviewsSection: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  emptyCard: {
    padding: spacing.xl * 2,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  emptySubtext: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewCard: {
    padding: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  reviewCommentEmpty: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});

export default DriverRatingsScreen;
