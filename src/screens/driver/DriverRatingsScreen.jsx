import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';
import ratingService from '../../services/ratingService';

const DriverRatingsScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratings, setRatings] = useState([]);
  const [ratingStats, setRatingStats] = useState({
    overall: 0,
    total: 0,
    breakdown: {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0
    }
  });

  useFocusEffect(
    useCallback(() => {
      loadRatings();
    }, [])
  );

  const loadRatings = async () => {
    try {
      setLoading(true);
      const response = await ratingService.getDriverRatingsHistory(0, 100);
      const ratingsData = response?.data || response?.content || [];
      
      setRatings(ratingsData);

      // Calculate stats from ratings
      const total = ratingsData.length;
      let sum = 0;
      const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

      ratingsData.forEach((rating) => {
        const score = rating.score || rating.rating || 0;
        sum += score;
        if (score >= 1 && score <= 5) {
          breakdown[Math.floor(score)]++;
        }
      });

      const overall = total > 0 ? sum / total : 0;

      setRatingStats({
        overall: parseFloat(overall.toFixed(1)),
        total,
        breakdown,
      });
    } catch (error) {
      console.error('Error loading ratings:', error);
      Alert.alert('Lỗi', 'Không thể tải đánh giá. Vui lòng thử lại.');
      setRatings([]);
      setRatingStats({
        overall: 0,
        total: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRatings();
  };

  const filterOptions = [
    { key: 'all', label: 'Tất cả', count: ratingStats.total },
    { key: '5', label: '5 sao', count: ratingStats.breakdown[5] },
    { key: '4', label: '4 sao', count: ratingStats.breakdown[4] },
    { key: '3', label: '3 sao', count: ratingStats.breakdown[3] },
    { key: '2-1', label: '≤2 sao', count: ratingStats.breakdown[2] + ratingStats.breakdown[1] }
  ];

  const filteredReviews = selectedFilter === 'all' 
    ? ratings 
    : selectedFilter === '2-1'
    ? ratings.filter(review => (review.score || review.rating || 0) <= 2)
    : ratings.filter(review => Math.floor(review.score || review.rating || 0).toString() === selectedFilter);

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Icon
        key={index}
        name="star"
        size={16}
        color={index < rating ? '#FF9800' : '#E0E0E0'}
      />
    ));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  };

  const getProgressWidth = (count) => {
    return (count / ratingStats.total) * 100;
  };

  if (loading && ratings.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF9800']} />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#FF9800', '#F57C00']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Đánh giá của tôi</Text>
            <Text style={styles.headerSubtitle}>Xem phản hồi từ khách hàng</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Overall Rating */}
          <Animatable.View animation="fadeInUp" style={styles.overallCard}>
            <View style={styles.overallHeader}>
              <View style={styles.ratingDisplay}>
                <Text style={styles.overallRating}>{ratingStats.overall}</Text>
                <View style={styles.starsContainer}>
                  {renderStars(Math.floor(ratingStats.overall))}
                  <Text style={styles.totalReviews}>({ratingStats.total} đánh giá)</Text>
                </View>
              </View>
              <LinearGradient
                colors={['#FF9800', '#F57C00']}
                style={styles.ratingIcon}
              >
                <Icon name="star" size={32} color="#fff" />
              </LinearGradient>
            </View>

            {/* Rating Breakdown */}
            <View style={styles.breakdownContainer}>
              {[5, 4, 3, 2, 1].map((star) => (
                <View key={star} style={styles.breakdownRow}>
                  <Text style={styles.starLabel}>{star} sao</Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${getProgressWidth(ratingStats.breakdown[star])}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.countLabel}>{ratingStats.breakdown[star]}</Text>
                </View>
              ))}
            </View>
          </Animatable.View>

          {/* Performance Metrics */}
          <View style={styles.metricsCard}>
            <Text style={styles.cardTitle}>Chỉ số hiệu suất</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <LinearGradient
                  colors={['#10412F', '#000000']}
                  style={styles.metricIcon}
                >
                  <Icon name="check-circle" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.metricValue}>96%</Text>
                <Text style={styles.metricLabel}>Tỷ lệ hoàn thành</Text>
              </View>

              <View style={styles.metricItem}>
                <LinearGradient
                  colors={['#2196F3', '#1976D2']}
                  style={styles.metricIcon}
                >
                  <Icon name="schedule" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.metricValue}>92%</Text>
                <Text style={styles.metricLabel}>Đúng giờ</Text>
              </View>

              <View style={styles.metricItem}>
                <LinearGradient
                  colors={['#9C27B0', '#7B1FA2']}
                  style={styles.metricIcon}
                >
                  <Icon name="thumb-up" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.metricValue}>89%</Text>
                <Text style={styles.metricLabel}>Hài lòng</Text>
              </View>

              <View style={styles.metricItem}>
                <LinearGradient
                  colors={['#FF5722', '#D84315']}
                  style={styles.metricIcon}
                >
                  <Icon name="security" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.metricValue}>98%</Text>
                <Text style={styles.metricLabel}>An toàn</Text>
              </View>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filterOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterTab,
                    selectedFilter === option.key && styles.filterTabActive
                  ]}
                  onPress={() => setSelectedFilter(option.key)}
                >
                  <Text style={[
                    styles.filterTabText,
                    selectedFilter === option.key && styles.filterTabTextActive
                  ]}>
                    {option.label} ({option.count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Reviews List */}
          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>Nhận xét từ khách hàng</Text>
            {filteredReviews.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="rate-review" size={48} color="#ccc" />
                <Text style={styles.emptyText}>Chưa có đánh giá nào</Text>
              </View>
            ) : (
              filteredReviews.map((review, index) => {
                const score = review.score || review.rating || 0;
                const riderName = review.rider_name || review.riderName || review.rider?.full_name || review.rider?.name || 'Khách hàng';
                const comment = review.comment || review.comment_text || '';
                const date = review.created_at || review.createdAt || review.date;
                const route = review.route || 
                  (review.pickup_location && review.dropoff_location 
                    ? `${review.pickup_location.address || review.pickup_location.name || 'N/A'} → ${review.dropoff_location.address || review.dropoff_location.name || 'N/A'}`
                    : 'N/A');

                return (
                  <Animatable.View 
                    key={review.rating_id || review.id || index} 
                    animation="fadeInUp" 
                    style={styles.reviewCard}
                  >
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={styles.reviewerAvatar}>
                          <Icon name="person" size={20} color="#666" />
                        </View>
                        <View style={styles.reviewerDetails}>
                          <Text style={styles.reviewerName}>{riderName}</Text>
                          <Text style={styles.reviewDate}>{formatDate(date)}</Text>
                        </View>
                      </View>
                      <View style={styles.reviewRating}>
                        {renderStars(Math.floor(score))}
                      </View>
                    </View>
                    
                    {route !== 'N/A' && <Text style={styles.reviewRoute}>{route}</Text>}
                    
                    {comment && <Text style={styles.reviewComment}>{comment}</Text>}
                  </Animatable.View>
                );
              })
            )}
          </View>

          {/* Tips for Improvement */}
          <View style={styles.tipsCard}>
            <Text style={styles.cardTitle}>Gợi ý cải thiện</Text>
            <View style={styles.tip}>
              <Icon name="lightbulb" size={20} color="#FF9800" />
              <Text style={styles.tipText}>
                Luôn đeo khẩu trang và cung cấp nước sát khuẩn cho khách hàng
              </Text>
            </View>
            <View style={styles.tip}>
              <Icon name="lightbulb" size={20} color="#FF9800" />
              <Text style={styles.tipText}>
                Giao tiếp thân thiện và hỏi thăm về nhiệt độ điều hòa
              </Text>
            </View>
            <View style={styles.tip}>
              <Icon name="lightbulb" size={20} color="#FF9800" />
              <Text style={styles.tipText}>
                Chọn đường đi tối ưu và thông báo khi có thay đổi lộ trình
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  overallCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  overallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ratingDisplay: {
    flex: 1,
  },
  overallRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalReviews: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  ratingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownContainer: {
    marginTop: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starLabel: {
    width: 40,
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginHorizontal: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
  countLabel: {
    width: 30,
    fontSize: 14,
    color: '#666',
    textAlign: 'right',
  },
  metricsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterTabActive: {
    backgroundColor: '#FF9800',
  },
  filterTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  reviewsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reviewerDetails: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  reviewDate: {
    fontSize: 12,
    color: '#666',
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewRoute: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  tipsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});

export default DriverRatingsScreen;