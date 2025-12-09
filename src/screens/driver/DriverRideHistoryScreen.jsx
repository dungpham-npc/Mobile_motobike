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
import paymentService from '../../services/paymentService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';
import { parseBackendDate } from '../../utils/time';

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

      // Load transactions once for all rides
      let earningsByRideId = {};
      try {
        const transactionsResponse = await paymentService.getTransactionHistory(0, 100, 'CAPTURE_FARE', 'SUCCESS');
        const txList = Array.isArray(transactionsResponse?.content)
          ? transactionsResponse.content
          : Array.isArray(transactionsResponse?.data)
          ? transactionsResponse.data
          : Array.isArray(transactionsResponse?.items)
          ? transactionsResponse.items
          : Array.isArray(transactionsResponse)
          ? transactionsResponse
          : [];

        // Calculate earnings per ride from transactions
        txList.forEach((tx) => {
          if (
            tx.type === 'CAPTURE_FARE' &&
            tx.direction === 'IN' &&
            tx.status === 'SUCCESS' &&
            (tx.sharedRideId || tx.shared_ride_id || tx.rideId)
          ) {
            const rideId = tx.sharedRideId || tx.shared_ride_id || tx.rideId;
            const amount = parseFloat(tx.amount) || 0;
            if (!earningsByRideId[rideId]) {
              earningsByRideId[rideId] = 0;
            }
            earningsByRideId[rideId] += amount;
          }
        });
      } catch (txError) {
        console.warn('Could not load transactions for earnings calculation:', txError);
      }

      // Load ongoing rides (ONGOING, SCHEDULED status)
      try {
        const ongoingResponse = await rideService.getMyRides('ONGOING', 0, 50);
        const scheduledResponse = await rideService.getMyRides('SCHEDULED', 0, 50);

        const ongoingData = ongoingResponse?.data || [];
        const scheduledData = scheduledResponse?.data || [];

        const allOngoing = [...ongoingData, ...scheduledData].map((ride) => {
          const rideId = ride.shared_ride_id || ride.ride_id || ride.id;
          const totalEarnings = 
            ride.total_earnings || 
            ride.totalEarnings || 
            earningsByRideId[rideId] || 
            null;
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
            rideId: rideId,
            status: ride.status,
            userType: 'driver',
            pickupAddress: startAddr,
            dropoffAddress: endAddr,
            totalEarnings: totalEarnings,
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

          const rideId = ride.shared_ride_id || ride.ride_id || ride.id;
          // Calculate totalEarnings from transactions if not in response
          const totalEarnings = 
            ride.total_earnings || 
            ride.totalEarnings || 
            earningsByRideId[rideId] || 
            null;

          return {
            rideId: rideId,
            status: ride.status,
            userType: 'driver',
            pickupAddress: startAddr,
            dropoffAddress: endAddr,
            totalEarnings: totalEarnings,
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

  const handleResumeRide = (ride) => {
    console.log('📍 Resuming ride:', ride);
    navigation.navigate('DriverRideTracking', {
      rideId: ride.rideId,
      initialRideData: ride,
    });
  };

  const handleViewDetails = (ride) => {
    navigation.navigate('DriverRideDetails', {
      ride: ride,
      rideId: ride.rideId,
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ONGOING':
        return '#F97316';
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

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return 'Chưa có';
    if (amount === 0) return 'Miễn phí';
    return `${Number(amount).toLocaleString('vi-VN')} ₫`;
  };

  const formatDate = (dateString) => {
    const date = parseBackendDate(dateString);
    if (!date) return 'N/A';

    return `${String(date.getDate()).padStart(2, '0')}/${String(
      date.getMonth() + 1
    ).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(
      2,
      '0'
    )}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatDateForList = (dateString) => {
    const date = parseBackendDate(dateString);
    if (!date) return 'N/A';

    const months = [
      'Th 1',
      'Th 2',
      'Th 3',
      'Th 4',
      'Th 5',
      'Th 6',
      'Th 7',
      'Th 8',
      'Th 9',
      'Th 10',
      'Th 11',
      'Th 12',
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = date.getHours() % 12 || 12;
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const period = date.getHours() >= 12 ? 'PM' : 'AM';
    return `${day} ${month}, ${hours}:${minutes} ${period}`;
  };

  const renderRideCard = (ride, index) => {
    const isOngoing = ride.status === 'ONGOING' || ride.status === 'SCHEDULED';

    return (
      <TouchableOpacity
        onPress={() => handleViewDetails(ride)}
        activeOpacity={0.7}
        style={styles.rideCardWrapper}
      >
        <CleanCard style={styles.rideCard} contentStyle={styles.rideCardContent}>
          <View style={styles.leftSection}>
            <View style={styles.serviceIcon}>
              <Icon name="two-wheeler" size={24} color="#fff" />
              {isOngoing && (
                <View style={styles.clockIcon}>
                  <Icon name="access-time" size={10} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Chuyến đi của tôi</Text>
              {ride.createdAt && <Text style={styles.dateTimeText}>{formatDateForList(ride.createdAt)}</Text>}
              {ride.passengerCount > 0 && (
                <Text style={styles.passengerText}>{ride.passengerCount} hành khách</Text>
              )}
            </View>
          </View>

          <View style={styles.rightSection}>
            <Text style={styles.priceText}>
              {ride.totalEarnings !== null && ride.totalEarnings !== undefined
                ? formatCurrency(ride.totalEarnings)
                : 'Chưa có'}
            </Text>
            <Icon name="chevron-right" size={24} color={colors.textMuted} />
          </View>
        </CleanCard>
      </TouchableOpacity>
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
        <Animatable.View animation="fadeInUp" duration={480} delay={120}>
          <CleanCard style={styles.emptyCard} contentStyle={styles.emptyCardContent}>
            <Icon name="inbox" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {selectedTab === 'ongoing' ? 'Bạn chưa có chuyến đi nào đang diễn ra' : 'Chưa có lịch sử chuyến đi'}
            </Text>
            {selectedTab === 'ongoing' && (
              <TouchableOpacity style={styles.createRideButton} onPress={() => navigation.navigate('DriverHome')} activeOpacity={0.8}>
                <Icon name="add" size={20} color="#fff" />
                <Text style={styles.createRideButtonText}>Tạo chuyến mới</Text>
              </TouchableOpacity>
            )}
          </CleanCard>
        </Animatable.View>
      );
    }

    return (
      <View style={styles.ridesContainer}>
        {displayRides.map((ride, index) => (
          <Animatable.View key={`${ride.rideId}-${index}`} animation="fadeInUp" duration={480} delay={120 + index * 60}>
            {renderRideCard(ride, index)}
          </Animatable.View>
        ))}
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
            <Animatable.View animation="fadeInUp" duration={480} delay={60}>
              <CleanCard style={styles.tabsCard} contentStyle={styles.tabsCardContent}>
                <View style={styles.tabsContainer}>
                  {tabs.map((tab) => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
                      onPress={() => setSelectedTab(tab.key)}
                      activeOpacity={0.7}
                    >
                      <Icon
                        name={tab.icon}
                        size={20}
                        color={selectedTab === tab.key ? colors.primary : colors.textMuted}
                      />
                      <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </CleanCard>
            </Animatable.View>

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
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
  },
  tabsCard: {
    marginBottom: 12,
  },
  tabsCardContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tab: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  activeTab: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
    flexShrink: 1,
  },
  activeTabText: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  emptyCard: {
    marginBottom: 12,
  },
  emptyCardContent: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  createRideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 8,
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createRideButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  ridesContainer: {
    gap: 12,
  },
  rideCardWrapper: {
    marginBottom: 12,
  },
  rideCard: {
    marginBottom: 0,
  },
  rideCardContent: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    position: 'relative',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clockIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dateTimeText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  passengerText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceText: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
});

export default DriverRideHistoryScreen;

