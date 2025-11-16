import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';
import mockData from '../../data/mockData.json';

const RideHistoryScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, completed, cancelled

  const rides = mockData.rides;

  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.dropoffLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         ride.pickupLocation.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedFilter === 'all') return matchesSearch;
    return matchesSearch && ride.status === selectedFilter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#22C55E';
      case 'cancelled':
        return '#EF4444';
      case 'ongoing':
        return '#F97316';
      default:
        return colors.textSecondary;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Hoàn thành';
      case 'cancelled':
        return 'Đã hủy';
      case 'ongoing':
        return 'Đang diễn ra';
      default:
        return 'Không xác định';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('vi-VN') + ' VNĐ';
  };

  const filterOptions = [
    { key: 'all', label: 'Tất cả' },
    { key: 'completed', label: 'Hoàn thành' },
    { key: 'cancelled', label: 'Đã hủy' }
  ];

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSpacing}>
            <GlassHeader title="Lịch sử chuyến đi" subtitle="Quản lý chuyến đi" />
          </View>

          <View style={styles.content}>
            {/* Search Bar */}
            <Animatable.View animation="fadeInUp" duration={400}>
              <CleanCard style={styles.card} contentStyle={styles.searchCardContent}>
                <View style={styles.searchBar}>
                  <Icon name="search" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm kiếm theo địa điểm..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Icon name="clear" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Filter Tabs */}
            <Animatable.View animation="fadeInUp" duration={400} delay={60}>
              <CleanCard style={styles.card} contentStyle={styles.filterCardContent}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
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
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </CleanCard>
            </Animatable.View>

            {/* Rides List */}
            {filteredRides.length === 0 ? (
              <Animatable.View animation="fadeInUp" duration={400} delay={120}>
                <CleanCard style={styles.card} contentStyle={styles.emptyCardContent}>
                  <View style={styles.emptyState}>
                    <Icon name="history" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyStateText}>Không có chuyến đi nào</Text>
                    <Text style={styles.emptyStateSubtext}>
                      {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Bạn chưa có chuyến đi nào'}
                    </Text>
                  </View>
                </CleanCard>
              </Animatable.View>
            ) : (
              filteredRides.map((ride, index) => (
                <Animatable.View
                  key={ride.id}
                  animation="fadeInUp"
                  duration={400}
                  delay={120 + index * 40}
                >
                  <CleanCard style={styles.card} contentStyle={styles.rideCardContent}>
                    <View style={styles.rideHeader}>
                      <View style={styles.rideStatus}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: getStatusColor(ride.status) }
                        ]} />
                        <Text style={[
                          styles.statusText,
                          { color: getStatusColor(ride.status) }
                        ]}>
                          {getStatusText(ride.status)}
                        </Text>
                      </View>
                      <Text style={styles.rideDate}>
                        {formatDate(ride.date)}
                      </Text>
                    </View>

                    <View style={styles.rideRoute}>
                      <View style={styles.routePoint}>
                        <View style={styles.pickupDot} />
                        <Text style={styles.locationText}>{ride.pickupLocation}</Text>
                      </View>
                      
                      <View style={styles.routeLine} />
                      
                      <View style={styles.routePoint}>
                        <View style={styles.dropoffDot} />
                        <Text style={styles.locationText}>{ride.dropoffLocation}</Text>
                      </View>
                    </View>

                    <View style={styles.rideFooter}>
                      <View style={styles.rideInfo}>
                        <View style={styles.infoItem}>
                          <Icon name="schedule" size={16} color={colors.textSecondary} />
                          <Text style={styles.infoText}>{ride.duration} phút</Text>
                        </View>
                        <View style={styles.infoItem}>
                          <Icon name="motorcycle" size={16} color={colors.textSecondary} />
                          <Text style={styles.infoText}>Xe máy</Text>
                        </View>
                      </View>
                      <Text style={styles.fareText}>
                        {formatCurrency(ride.fare)}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.detailsButton}>
                      <Text style={styles.detailsButtonText}>Xem chi tiết</Text>
                      <Icon name="chevron-right" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </CleanCard>
                </Animatable.View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 160,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  content: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 20,
  },
  card: {
    marginBottom: 12,
  },
  searchCardContent: {
    padding: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassLight,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  filterCardContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  filterScrollContent: {
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  rideCardContent: {
    padding: 20,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  rideDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  rideRoute: {
    marginBottom: 16,
    gap: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.textMuted,
    marginLeft: 5,
    marginVertical: 2,
    opacity: 0.3,
  },
  locationText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rideInfo: {
    flexDirection: 'row',
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  fareText: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.18)',
    gap: 4,
  },
  detailsButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  emptyCardContent: {
    padding: 40,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default RideHistoryScreen;
