import React, { useState, useEffect, useCallback } from 'react';
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
import ratingService from '../../services/ratingService';
import paymentService from '../../services/paymentService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';
import { parseBackendDate } from '../../utils/time';

const RideHistoryScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('ongoing');
  const [ongoingRides, setOngoingRides] = useState([]);
  const [completedRides, setCompletedRides] = useState([]);
  const [ratedRequestIds, setRatedRequestIds] = useState(new Set());

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

      const userId = currentUser?.user?.user_id || currentUser?.user_id;
      if (!userId) {
        setOngoingRides([]);
        setCompletedRides([]);
        return;
      }

      // Load transactions to calculate totalFare
      let fareByRequestId = {};
      let fareByRideId = {};
      try {
        const transactionsResponse = await paymentService.getTransactionHistory(0, 100);
        const txList = Array.isArray(transactionsResponse?.content)
          ? transactionsResponse.content
          : Array.isArray(transactionsResponse?.data)
          ? transactionsResponse.data
          : Array.isArray(transactionsResponse?.items)
          ? transactionsResponse.items
          : Array.isArray(transactionsResponse)
          ? transactionsResponse
          : [];

        // Calculate fare per request/ride from transactions
        // Rider pays: CAPTURE_FARE with direction OUT, or HOLD_CREATE
        txList.forEach((tx) => {
          const amount = parseFloat(tx.amount) || 0;
          
          // CAPTURE_FARE (final payment)
          if (tx.type === 'CAPTURE_FARE' && tx.direction === 'OUT' && tx.status === 'SUCCESS') {
            const requestId = tx.sharedRideRequestId || tx.shared_ride_request_id || tx.requestId;
            const rideId = tx.sharedRideId || tx.shared_ride_id || tx.rideId;
            
            if (requestId) {
              if (!fareByRequestId[requestId]) {
                fareByRequestId[requestId] = 0;
              }
              fareByRequestId[requestId] += amount;
            }
            
            if (rideId) {
              if (!fareByRideId[rideId]) {
                fareByRideId[rideId] = 0;
              }
              fareByRideId[rideId] += amount;
            }
          }
          
          // HOLD_CREATE (temporary hold, might be the actual fare)
          if (tx.type === 'HOLD_CREATE' && tx.direction === 'OUT' && tx.status === 'SUCCESS') {
            const requestId = tx.sharedRideRequestId || tx.shared_ride_request_id || tx.requestId;
            const rideId = tx.sharedRideId || tx.shared_ride_id || tx.rideId;
            
            if (requestId && !fareByRequestId[requestId]) {
              fareByRequestId[requestId] = amount;
            }
            
            if (rideId && !fareByRideId[rideId]) {
              fareByRideId[rideId] = amount;
            }
          }
        });
      } catch (txError) {
        console.warn('Could not load transactions for fare calculation:', txError);
      }

      try {
        const ratingsResponse = await ratingService.getRiderRatingsHistory(0, 100);
        const ratings = ratingsResponse?.data || [];
        const ratedIds = new Set(
          ratings.map((rating) => rating.shared_ride_request_id || rating.requestId)
        );
        setRatedRequestIds(ratedIds);
      } catch (ratingError) {
        console.warn('⚠️ Could not load ratings (will assume no ratings):', ratingError);
        setRatedRequestIds(new Set());
      }

      try {
        const ongoingResponse = await rideService.getRiderRequests(userId, 'ONGOING', 0, 50);
        const confirmedResponse = await rideService.getRiderRequests(userId, 'CONFIRMED', 0, 50);

        const ongoingData = ongoingResponse?.data || [];
        const confirmedData = confirmedResponse?.data || [];

        const allOngoing = [...ongoingData, ...confirmedData].map((request) => {
          const pickupAddr =
            request.pickup_location?.address ||
            request.pickup_location?.name ||
            request.pickup_location_name ||
            'N/A';

          let dropoffAddr = 'N/A';
          if (request.dropoff_location) {
            if (request.dropoff_location.address && request.dropoff_location.address !== 'N/A') {
              dropoffAddr = request.dropoff_location.address;
            } else if (request.dropoff_location.name) {
              dropoffAddr = request.dropoff_location.name;
            }
          } else if (request.dropoff_location_name) {
            dropoffAddr = request.dropoff_location_name;
          }

          const requestId = request.shared_ride_request_id || request.requestId;
          const rideId = request.shared_ride_id;
          
          // Calculate totalFare: priority: response -> transactions by requestId -> transactions by rideId
          const totalFare =
            request.fare_amount !== undefined && request.fare_amount !== null
              ? request.fare_amount
              : request.total_fare !== undefined && request.total_fare !== null
              ? request.total_fare
              : fareByRequestId[requestId] || fareByRideId[rideId] || null;

          return {
            rideId: rideId,
            requestId: requestId,
            status: request.status,
            userType: 'rider',
            pickupAddress: pickupAddr,
            dropoffAddress: dropoffAddr,
            totalFare: totalFare,
            distance:
              request.distance_km || request.estimated_distance_km || request.actual_distance || null,
            driverInfo: {
              driverName: request.driver_name || null,
              driverId: request.driver_id || null,
            },
            createdAt: request.created_at,
            pickupTime: request.pickup_time,
            estimatedPickupTime: request.estimated_pickup_time,
            actualPickupTime: request.actual_pickup_time,
            actualDropoffTime: request.actual_dropoff_time,
            raw: request,
          };
        });

        setOngoingRides(allOngoing);
      } catch (error) {
        console.error('Error loading ongoing rides:', error);
        setOngoingRides([]);
      }

      try {
        const completedResponse = await rideService.getRiderRequests(userId, 'COMPLETED', 0, 50);
        const completedData = completedResponse?.data || [];

        const allCompleted = completedData.map((request) => {
          const pickupAddr =
            request.pickup_location?.address ||
            request.pickup_location?.name ||
            request.pickup_location_name ||
            'N/A';

          let dropoffAddr = 'N/A';
          if (request.dropoff_location) {
            if (request.dropoff_location.address && request.dropoff_location.address !== 'N/A') {
              dropoffAddr = request.dropoff_location.address;
            } else if (request.dropoff_location.name) {
              dropoffAddr = request.dropoff_location.name;
            }
          } else if (request.dropoff_location_name) {
            dropoffAddr = request.dropoff_location_name;
          }

          const requestId = request.shared_ride_request_id || request.requestId;
          const rideId = request.shared_ride_id;
          
          // Calculate totalFare: priority: response -> transactions by requestId -> transactions by rideId
          const totalFare =
            request.fare_amount !== undefined && request.fare_amount !== null
              ? request.fare_amount
              : request.total_fare !== undefined && request.total_fare !== null
              ? request.total_fare
              : fareByRequestId[requestId] || fareByRideId[rideId] || null;

          return {
            rideId: rideId,
            requestId: requestId,
            status: request.status,
            userType: 'rider',
            pickupAddress: pickupAddr,
            dropoffAddress: dropoffAddr,
            totalFare: totalFare,
            distance:
              request.actual_distance ||
              request.distance_km ||
              request.estimated_distance_km ||
              null,
            driverInfo: {
              driverName: request.driver_name || null,
              driverId: request.driver_id || null,
            },
            createdAt: request.created_at,
            completedAt: request.actual_dropoff_time || request.estimated_dropoff_time,
            actualPickupTime: request.actual_pickup_time,
            actualDropoffTime: request.actual_dropoff_time,
            raw: request,
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

    if (ride.userType === 'driver') {
      navigation.navigate('DriverRideTracking', {
        rideId: ride.rideId,
        initialRideData: ride,
      });
    } else {
      navigation.navigate('RideTracking', {
        rideId: ride.rideId,
        requestId: ride.requestId,
        driverInfo: ride.driverInfo,
        status: ride.status,
      });
    }
  };

  const handleViewDetails = (ride) => {
    navigation.navigate('RideDetails', {
      ride: ride,
      rideId: ride.rideId,
      requestId: ride.requestId,
    });
  };

  const handleRateRide = async (ride) => {
    try {
      console.log('📋 Loading ride data for rating:', ride.rideId, ride.requestId);

      const raw = ride.raw || {};

      let rideData = null;
      let requestData = null;
      try {
        const rideResponse = await rideService.getRideById(ride.rideId);
        if (
          rideResponse?.data &&
          typeof rideResponse.data === 'object' &&
          Object.keys(rideResponse.data).length > 0
        ) {
          rideData = rideResponse.data;
        } else if (rideResponse && typeof rideResponse === 'object' && Object.keys(rideResponse).length > 0) {
          rideData = rideResponse;
        }

        try {
          const requestsResponse = await rideService.getRideRequests(ride.rideId);
          const requestList = Array.isArray(requestsResponse)
            ? requestsResponse
            : requestsResponse?.data || requestsResponse?.content || requestsResponse?.items || [];

          requestData = requestList.find(
            (req) =>
              req.shared_ride_request_id === ride.requestId ||
              req.shared_ride_request_id === parseInt(ride.requestId, 10) ||
              req.request_id === ride.requestId
          );
        } catch (reqError) {
          console.warn('⚠️ Could not load ride requests, using raw data:', reqError);
        }
      } catch (error) {
        console.warn('⚠️ Could not load ride data, using cached data:', error);
      }

      const request = requestData || raw;

      let driverId = null;
      let driverName = null;
      if (rideData) {
        driverId = rideData.driver_id ?? rideData.driver?.driver_id ?? null;
        driverName = rideData.driver_name ?? rideData.driver?.name ?? rideData.driver?.full_name ?? null;
      }
      if (!driverId) driverId = request?.driver_id ?? null;
      if (!driverName)
        driverName = request?.driver_name ?? request?.driver?.name ?? request?.driver?.full_name ?? null;

      let totalFare = null;
      if (request && request.fare_amount !== undefined && request.fare_amount !== null) {
        totalFare = request.fare_amount;
      } else if (request && request.total_fare !== undefined && request.total_fare !== null) {
        totalFare = request.total_fare;
      } else if (raw && raw.fare_amount !== undefined && raw.fare_amount !== null) {
        totalFare = raw.fare_amount;
      } else if (raw && raw.total_fare !== undefined && raw.total_fare !== null) {
        totalFare = raw.total_fare;
      }

      let actualDistance = null;
      if (rideData && rideData.actual_distance !== undefined && rideData.actual_distance !== null) {
        actualDistance = rideData.actual_distance;
      } else if (request && request.actual_distance !== undefined && request.actual_distance !== null) {
        actualDistance = request.actual_distance;
      } else if (request && request.distance_km) {
        actualDistance = request.distance_km;
      } else if (raw && raw.actual_distance) {
        actualDistance = raw.actual_distance;
      } else if (raw && raw.distance_km) {
        actualDistance = raw.distance_km;
      }

      let actualDuration = null;
      if (rideData && rideData.actual_duration !== undefined && rideData.actual_duration !== null) {
        actualDuration = rideData.actual_duration;
      } else if (request && request.actual_duration !== undefined && request.actual_duration !== null) {
        actualDuration = request.actual_duration;
      } else if (request && request.duration_minutes) {
        actualDuration = request.duration_minutes;
      } else if (raw && raw.actual_duration) {
        actualDuration = raw.actual_duration;
      } else if (raw && raw.duration_minutes) {
        actualDuration = raw.duration_minutes;
      }

      navigation.navigate('RideRating', {
        rideId: ride.rideId,
        requestId: ride.requestId,
        driverId,
        driverName,
        totalFare,
        actualDistance,
      });
    } catch (error) {
      console.error('❌ Error loading ride data for rating:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến đi. Vui lòng thử lại.');
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ONGOING':
      case 'CONFIRMED':
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
    const isOngoing = ride.status === 'ONGOING' || ride.status === 'CONFIRMED';

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
              <Text style={styles.serviceName}>Xe máy</Text>
              {ride.createdAt && <Text style={styles.dateTimeText}>{formatDateForList(ride.createdAt)}</Text>}
            </View>
          </View>

          <View style={styles.rightSection}>
            <Text style={styles.priceText}>
              {ride.totalFare !== null && ride.totalFare !== undefined
                ? formatCurrency(ride.totalFare)
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
          </CleanCard>
        </Animatable.View>
      );
    }

    return (
      <View style={styles.ridesContainer}>
        {displayRides.map((ride, index) => (
          <Animatable.View key={`${ride.rideId || ride.requestId}-${index}`} animation="fadeInUp" duration={480} delay={120 + index * 60}>
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
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tab: {
    flexGrow: 1,
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
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textMuted,
    flexShrink: 1,
    textAlign: 'center',
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

export default RideHistoryScreen;
