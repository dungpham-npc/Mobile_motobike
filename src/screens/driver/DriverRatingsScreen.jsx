import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

const DriverRatingsScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState('all');

  const ratingStats = {
    overall: 4.8,
    total: 156,
    breakdown: {
      5: 98,
      4: 32,
      3: 18,
      2: 6,
      1: 2
    }
  };

  const recentReviews = [
    {
      id: 1,
      riderName: 'Nguyen Van A',
      rating: 5,
      comment: 'Tài xế lái xe rất an toàn, đúng giờ và thái độ thân thiện. Sẽ chọn lại lần sau!',
      date: '2024-01-16T14:30:00Z',
      route: 'Ký túc xá A → Trường FPT'
    },
    {
      id: 2,
      riderName: 'Le Thi B',
      rating: 4,
      comment: 'Xe sạch sẽ, tài xế lịch sự. Chỉ có điều hơi nhanh một chút.',
      date: '2024-01-15T16:20:00Z',
      route: 'Nhà văn hóa → Chợ Bến Thành'
    },
    {
      id: 3,
      riderName: 'Pham Van C',
      rating: 5,
      comment: 'Tuyệt vời! Tài xế rất am hiểu đường và tránh được kẹt xe.',
      date: '2024-01-15T12:45:00Z',
      route: 'Trọ sinh viên → Trường FPT'
    },
    {
      id: 4,
      riderName: 'Hoang Thi D',
      rating: 3,
      comment: 'Bình thường, không có gì đặc biệt.',
      date: '2024-01-14T18:15:00Z',
      route: 'Vincom → Ký túc xá B'
    },
    {
      id: 5,
      riderName: 'Tran Van E',
      rating: 5,
      comment: 'Tài xế rất chuyên nghiệp, có mũ bảo hiểm dự phòng và lái xe cẩn thận.',
      date: '2024-01-14T10:30:00Z',
      route: 'Trường FPT → Chợ Bến Thành'
    }
  ];

  const filterOptions = [
    { key: 'all', label: 'Tất cả', count: ratingStats.total },
    { key: '5', label: '5 sao', count: ratingStats.breakdown[5] },
    { key: '4', label: '4 sao', count: ratingStats.breakdown[4] },
    { key: '3', label: '3 sao', count: ratingStats.breakdown[3] },
    { key: '2-1', label: '≤2 sao', count: ratingStats.breakdown[2] + ratingStats.breakdown[1] }
  ];

  const filteredReviews = selectedFilter === 'all' 
    ? recentReviews 
    : selectedFilter === '2-1'
    ? recentReviews.filter(review => review.rating <= 2)
    : recentReviews.filter(review => review.rating.toString() === selectedFilter);

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
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  };

  const getProgressWidth = (count) => {
    return (count / ratingStats.total) * 100;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
                  colors={['#4CAF50', '#2E7D32']}
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
              filteredReviews.map((review) => (
                <Animatable.View 
                  key={review.id} 
                  animation="fadeInUp" 
                  style={styles.reviewCard}
                >
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      <View style={styles.reviewerAvatar}>
                        <Icon name="person" size={20} color="#666" />
                      </View>
                      <View style={styles.reviewerDetails}>
                        <Text style={styles.reviewerName}>{review.riderName}</Text>
                        <Text style={styles.reviewDate}>{formatDate(review.date)}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewRating}>
                      {renderStars(review.rating)}
                    </View>
                  </View>
                  
                  <Text style={styles.reviewRoute}>{review.route}</Text>
                  
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </Animatable.View>
              ))
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
});

export default DriverRatingsScreen;