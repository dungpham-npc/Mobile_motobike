import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import rideService from '../../services/rideService';
import authService from '../../services/authService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors, typography, spacing } from '../../theme/designTokens';

const DriverRideHistoryScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('ongoing');
  const [ongoingRides, setOngoingRides] = useState([]);
  const [completedRides, setCompletedRides] = useState([]);

  const tabs = [
    { key: 'ongoing', label: 'Đang diễn ra', icon: 'two-wheeler' },
    { key: 'completed', label: 'Hoàn thành', icon: 'check-circle' },
    { key: 'all', label: 'Tất cả', icon: 'list' },
  ];

  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [])
  );

  const loadRides = async () => {
    try {
      setLoading(true);

      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        setOngoingRides([]);
        setCompletedRides([]);
        return;
      }

      // Load ongoing rides
      try {
        const ongoingResponse = await rideService.getMyRides('ONGOING', 0, 50);
        const confirmedResponse = await rideService.getMyRides('CONFIRMED', 0, 50);

        const ongoingData = ongoingResponse?.data || [];
        const confirmedData = confirmedResponse?.data || [];

        const allOngoing = [...ongoingData, ...confirmedData].map((ride) => {
          const startAddr =
            ride.start_location?.address ||
            ride.start_location?.name ||
            ride.start_location_name ||
            'N/A';

          let endAddr = 'N/A';
          if (ride.end_location) {
            if (ride.end_location.address && ride.end_location.address !== 'N/A') {
              endAddr = ride.end_location.address;
            } else if (ride.end_location.name) {
              endAddr = ride.end_location.name;
            }
          } else if (ride.end_location_name) {
            endAddr = ride.end_location_name;
          }

          return {
            rideId: ride.shared_ride_id || ride.ride_id || ride.id,
            status: ride.status,
            userType: 'driver',
            pickupAddress: startAddr,
            dropoffAddress: endAddr,
            totalEarnings: ride.total_earnings || ride.totalEarnings || null,
            passengerCount: ride.passenger_count || ride.passengerCount || 0,
            distance:
              ride.actual_distance ||
              ride.distance_km ||
              ride.estimated_distance_km ||
              null,
            createdAt: ride.created_at || ride.createdAt,
            departureTime: ride.departure_time || ride.departureTime,
            estimatedDepartureTime: ride.estimated_departure_time || ride.estimatedDepartureTime,
            actualStartTime: ride.actual_start_time || ride.actualStartTime,
            actualEndTime: ride.actual_end_time || ride.actualEndTime,
            raw: ride,
          };
        });

        setOngoingRides(allOngoing);
      } catch (error) {
        console.error('Error loading ongoing rides:', error);
        setOngoingRides([]);
      }

      // Load completed rides
      try {
        const completedResponse = await rideService.getMyCompletedRides(0, 50);
        const completedData = completedResponse?.data || [];

        const allCompleted = completedData.map((ride) => {
          const startAddr =
            ride.start_location?.address ||
            ride.start_location?.name ||
            ride.start_location_name ||
            'N/A';

          let endAddr = 'N/A';
          if (ride.end_location) {
            if (ride.end_location.address && ride.end_location.address !== 'N/A') {
              endAddr = ride.end_location.address;
            } else if (ride.end_location.name) {
              endAddr = ride.end_location.name;
            }
          } else if (ride.end_location_name) {
            endAddr = ride.end_location_name;
          }

          return {
            rideId: ride.shared_ride_id || ride.ride_id || ride.id,
            status: ride.status,
            userType: 'driver',
            pickupAddress: startAddr,
            dropoffAddress: endAddr,
            totalEarnings: ride.total_earnings || ride.totalEarnings || null,
            passengerCount: ride.passenger_count || ride.passengerCount || 0,
            distance:
              ride.actual_distance ||
              ride.distance_km ||
              ride.estimated_distance_km ||
              null,
            createdAt: ride.created_at || ride.createdAt,
            completedAt: ride.actual_end_time || ride.actualEndTime || ride.completed_at || ride.completedAt,
            actualStartTime: ride.actual_start_time || ride.actualStartTime,
            actualEndTime: ride.actual_end_time || ride.actualEndTime,
            raw: ride,
          };
        });

        setCompletedRides(allCompleted);
      } catch (error) {
        console.error('Error loading completed rides:', error);
        setCompletedRides([]);
      }
    } catch (error) {
      console.error('Error loading rides:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách chuyến đi. Vui lòng thử lại.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRides();
  };

  const handleViewDetails = (ride) => {
    navigation.navigate('DriverRideDetails', {
      ride: ride,
      rideId: ride.rideId,
    });
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'Chưa có';
    if (amount === 0) return 'Miễn phí';
    return `${Number(amount).toLocaleString('vi-VN')} ₫`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  };

  const renderRideCard = (ride, index) => {
    const isOngoing = ride.status === 'ONGOING' || ride.status === 'CONFIRMED';

    return (
      <Animatable.View
        key={`${ride.rideId}-${index}`}
        animation="fadeInUp"
        duration={400}
        delay={100 + index * 30}
      >
        <TouchableOpacity
          onPress={() => handleViewDetails(ride)}
          activeOpacity={0.7}
        >
          <CleanCard style={styles.rideCard} contentStyle={styles.rideCardContent}>
            <View style={styles.rideTop}>
              <View style={styles.rideLeft}>
                <View style={[styles.rideIcon, { backgroundColor: isOngoing ? '#FEF3C7' : '#D1FAE5' }]}>
                  <Icon 
                    name="two-wheeler" 
                    size={18} 
                    color={isOngoing ? '#F59E0B' : '#10B981'} 
                  />
                </View>
                <View style={styles.rideInfo}>
                  <Text style={styles.rideTitle}>Chuyến đi của tôi</Text>
                  <View style={styles.rideMeta}>
                    {ride.createdAt && (
                      <>
                        <Icon name="access-time" size={12} color={colors.textMuted} />
                        <Text style={styles.rideMetaText}>{formatDate(ride.createdAt)}</Text>
                      </>
                    )}
                    {ride.passengerCount > 0 && (
                      <>
                        <Text style={styles.rideMetaDot}>•</Text>
                        <Icon name="people" size={12} color={colors.textMuted} />
                        <Text style={styles.rideMetaText}>{ride.passengerCount} hành khách</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.rideRight}>
                <Text style={styles.ridePrice}>
                  {ride.totalEarnings !== null && ride.totalEarnings !== undefined
                    ? formatCurrency(ride.totalEarnings)
                    : 'Chưa có'}
                </Text>
                <Icon name="chevron-right" size={20} color={colors.textMuted} />
              </View>
            </View>
            
            <View style={styles.rideRoute}>
              <View style={styles.routeItem}>
                <View style={styles.routeDot} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride.pickupAddress}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeItem}>
                <Icon name="location-on" size={12} color="#EF4444" />
                <Text style={styles.routeText} numberOfLines={1}>
                  {ride.dropoffAddress}
                </Text>
              </View>
            </View>
          </CleanCard>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  const renderContent = () => {
    let displayRides = [];

    switch (selectedTab) {
      case 'ongoing':
        displayRides = ongoingRides;
        break;
      case 'completed':
        displayRides = completedRides;
        break;
      case 'all':
        displayRides = [...ongoingRides, ...completedRides];
        break;
      default:
        displayRides = [];
    }

    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      );
    }

    if (displayRides.length === 0) {
      return (
        <Animatable.View animation="fadeInUp" duration={400} delay={100}>
          <CleanCard style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
            <View style={styles.emptyIcon}>
              <Icon name="inbox" size={48} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedTab === 'ongoing' ? 'Chưa có chuyến đi đang diễn ra' : 'Chưa có lịch sử chuyến đi'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedTab === 'ongoing' 
                ? 'Bạn sẽ thấy các chuyến đi đang diễn ra ở đây'
                : 'Lịch sử chuyến đi của bạn sẽ hiển thị ở đây'}
            </Text>
          </CleanCard>
        </Animatable.View>
      );
    }

    return (
      <View style={styles.ridesContainer}>
        {displayRides.map((ride, index) => renderRideCard(ride, index))}
      </View>
    );
  };

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
          <View style={styles.headerSpacing}>
            <GlassHeader
              title="Lịch sử chuyến đi"
              subtitle={`${ongoingRides.length} đang diễn ra | ${completedRides.length} hoàn thành`}
            />
          </View>

          <View style={styles.content}>
            {/* Tabs */}
            <View style={styles.tabsWrapper}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tab,
                    selectedTab === tab.key && styles.tabActive
                  ]}
                  onPress={() => setSelectedTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={tab.icon}
                    size={16}
                    color={selectedTab === tab.key ? colors.primary : colors.textMuted}
                  />
                  <Text style={[
                    styles.tabText,
                    selectedTab === tab.key && styles.tabTextActive
                  ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {renderContent()}
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
  scrollContent: {
    paddingBottom: 160,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  // Tabs
  tabsWrapper: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  // Loading
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl * 2,
    minHeight: 200,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  // Empty State
  emptyCard: {
    marginBottom: spacing.sm,
  },
  emptyCardContent: {
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Rides Container
  ridesContainer: {
    gap: spacing.sm,
  },
  // Ride Card
  rideCard: {
    marginBottom: 0,
  },
  rideCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  rideTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  rideIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rideInfo: {
    flex: 1,
  },
  rideTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  rideMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  rideMetaText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  rideMetaDot: {
    fontSize: typography.small,
    color: colors.textMuted,
  },
  rideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ridePrice: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  // Route
  rideRoute: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  routeLine: {
    width: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    marginLeft: 2,
  },
  routeText: {
    flex: 1,
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
});

export default DriverRideHistoryScreen;
