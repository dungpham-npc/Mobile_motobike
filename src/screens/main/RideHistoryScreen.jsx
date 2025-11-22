import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import rideService from '../../services/rideService';
import authService from '../../services/authService';
import ratingService from '../../services/ratingService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';

const RideHistoryScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('ongoing'); // ongoing, completed, all
  const [ongoingRides, setOngoingRides] = useState([]);
  const [completedRides, setCompletedRides] = useState([]);
  const [ratedRequestIds, setRatedRequestIds] = useState(new Set()); // Track which requests have been rated
  
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
      
      // Get current user to extract userId (thử dùng userId thay cho riderId)
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        setOngoingRides([]);
        setCompletedRides([]);
        return;
      }

      // Extract userId from user data
      const userId = currentUser?.user?.user_id || currentUser?.user_id;
      if (!userId) {
        setOngoingRides([]);
        setCompletedRides([]);
        return;
      }

      // Load ratings to check which requests have been rated
      try {
        const ratingsResponse = await ratingService.getRiderRatingsHistory(0, 100);
        const ratings = ratingsResponse?.data || [];
        const ratedIds = new Set(ratings.map(rating => rating.shared_ride_request_id || rating.requestId));
        setRatedRequestIds(ratedIds);
      } catch (ratingError) {
        console.warn('⚠️ Could not load ratings (will assume no ratings):', ratingError);
        setRatedRequestIds(new Set());
      }

      // Load ongoing rides (CONFIRMED, ONGOING) - thử dùng userId
      try {
        const ongoingResponse = await rideService.getRiderRequests(userId, 'ONGOING', 0, 50);
        const confirmedResponse = await rideService.getRiderRequests(userId, 'CONFIRMED', 0, 50);

        
        const ongoingData = ongoingResponse?.data || [];
        const confirmedData = confirmedResponse?.data || [];
        
        // Combine and transform to ride cards format
        const allOngoing = [...ongoingData, ...confirmedData].map(request => {
          
          // Get pickup address - prioritize address, then name
          const pickupAddr = request.pickup_location?.address || 
                           request.pickup_location?.name || 
                           request.pickup_location_name || 
                           'N/A';
          
          // Get dropoff address - prioritize name if address is "N/A", then address, then name
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
          
          return {
            rideId: request.shared_ride_id,
            requestId: request.shared_ride_request_id,
            status: request.status,
            userType: 'rider',
            pickupAddress: pickupAddr,
            dropoffAddress: dropoffAddr,
            totalFare: request.fare_amount !== undefined && request.fare_amount !== null ? request.fare_amount : (request.total_fare !== undefined && request.total_fare !== null ? request.total_fare : null),
            distance: request.distance_km || request.estimated_distance_km || request.actual_distance || null,
            driverInfo: {
              driverName: request.driver_name || null,
              driverId: request.driver_id || null,
            },
            createdAt: request.created_at,
            pickupTime: request.pickup_time,
            estimatedPickupTime: request.estimated_pickup_time,
            actualPickupTime: request.actual_pickup_time,
            actualDropoffTime: request.actual_dropoff_time,
            // Raw data để debug
            raw: request,
          };
        });

        setOngoingRides(allOngoing);
      } catch (error) {
        console.error('Error loading ongoing rides:', error);
        setOngoingRides([]);
      }

      // Load completed rides
      try {
        const completedResponse = await rideService.getRiderRequests(userId, 'COMPLETED', 0, 50);
        const completedData = completedResponse?.data || [];
        
        const allCompleted = completedData.map(request => {
          
          // Get pickup address - prioritize address, then name
          const pickupAddr = request.pickup_location?.address || 
                           request.pickup_location?.name || 
                           request.pickup_location_name || 
                           'N/A';
          
          // Get dropoff address - prioritize name if address is "N/A", then address, then name
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
          
          return {
            rideId: request.shared_ride_id,
            requestId: request.shared_ride_request_id,
            status: request.status,
            userType: 'rider',
            pickupAddress: pickupAddr,
            dropoffAddress: dropoffAddr,
            totalFare: request.fare_amount !== undefined && request.fare_amount !== null ? request.fare_amount : (request.total_fare !== undefined && request.total_fare !== null ? request.total_fare : null),
            distance: request.actual_distance || request.distance_km || request.estimated_distance_km || null,
            driverInfo: {
              driverName: request.driver_name || null,
              driverId: request.driver_id || null,
            },
            createdAt: request.created_at,
            completedAt: request.actual_dropoff_time || request.estimated_dropoff_time,
            actualPickupTime: request.actual_pickup_time,
            actualDropoffTime: request.actual_dropoff_time,
            // Raw data để debug
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
      // Navigate to driver tracking screen
      navigation.navigate('DriverRideTracking', {
        rideId: ride.rideId,
        initialRideData: ride,
      });
    } else {
      // Navigate to rider tracking screen
      navigation.navigate('RideTracking', {
        rideId: ride.rideId,
        requestId: ride.requestId,
        driverInfo: ride.driverInfo,
        status: ride.status,
      });
    }
  };

  const handleViewDetails = (ride) => {
    // Navigate to ride details screen with full ride data
    navigation.navigate('RideDetails', {
      ride: ride,
      rideId: ride.rideId,
      requestId: ride.requestId,
    });
  };

  const handleRateRide = async (ride) => {
    try {
      console.log('📋 Loading ride data for rating:', ride.rideId, ride.requestId);
      
      // Extract data from ride.raw first (most reliable source for request-specific data)
      const raw = ride.raw || {};
      
      // Try to get full ride data from API to ensure we have all information
      let rideData = null;
      let requestData = null;
      try {
        const rideResponse = await rideService.getRideById(ride.rideId);
        console.log('📦 Raw ride response:', JSON.stringify(rideResponse, null, 2));
        
        // Handle response structure - could be direct data or wrapped in { data: ... }
        // Check if response has data property and it's not empty
        if (rideResponse?.data && typeof rideResponse.data === 'object' && Object.keys(rideResponse.data).length > 0) {
          rideData = rideResponse.data;
        } else if (rideResponse && typeof rideResponse === 'object' && Object.keys(rideResponse).length > 0) {
          rideData = rideResponse;
        }
        
        console.log('✅ Processed rideData:', JSON.stringify(rideData, null, 2));
        console.log('🔍 rideData fields:', {
          hasDriverId: !!rideData?.driver_id,
          hasDriverName: !!rideData?.driver_name,
          hasActualDistance: rideData?.actual_distance !== undefined,
          hasActualDuration: rideData?.actual_duration !== undefined,
          driver_id: rideData?.driver_id,
          driver_name: rideData?.driver_name,
          actual_distance: rideData?.actual_distance,
          actual_duration: rideData?.actual_duration,
        });
        
        // Try to get request-specific data by fetching ride requests
        try {
          const requestsResponse = await rideService.getRideRequests(ride.rideId);
          const requestList = Array.isArray(requestsResponse) 
            ? requestsResponse 
            : (requestsResponse?.data || requestsResponse?.content || requestsResponse?.items || []);
          
          requestData = requestList.find(req => 
            req.shared_ride_request_id === ride.requestId || 
            req.shared_ride_request_id === parseInt(ride.requestId) ||
            req.request_id === ride.requestId
          );
          console.log('✅ Found request data from ride requests:', JSON.stringify(requestData, null, 2));
        } catch (reqError) {
          console.warn('⚠️ Could not load ride requests, using raw data:', reqError);
        }
      } catch (error) {
        console.warn('⚠️ Could not load ride data, using cached data:', error);
      }
      
      // Use requestData if available, otherwise use raw
      const request = requestData || raw;
      
      // Extract values with explicit checks
      // Driver info from rideData (most reliable)
      let driverId = null;
      let driverName = null;
      if (rideData) {
        driverId = rideData.driver_id ?? rideData.driver?.driver_id ?? null;
        driverName = rideData.driver_name ?? rideData.driver?.name ?? rideData.driver?.full_name ?? null;
      }
      // Fallback to request/raw if rideData doesn't have it
      if (!driverId) driverId = request?.driver_id ?? null;
      if (!driverName) driverName = request?.driver_name ?? request?.driver?.name ?? request?.driver?.full_name ?? null;
      
      // Fare from request (request-specific) - check both fare_amount and total_fare
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
      
      console.log('💰 Fare extraction:', {
        requestFareAmount: request?.fare_amount,
        requestTotalFare: request?.total_fare,
        rawFareAmount: raw?.fare_amount,
        rawTotalFare: raw?.total_fare,
        finalTotalFare: totalFare,
      });
      
      // Distance from rideData (ride-level), fallback to request/raw
      let actualDistance = null;
      if (rideData && (rideData.actual_distance !== undefined && rideData.actual_distance !== null)) {
        actualDistance = rideData.actual_distance;
      } else if (request && (request.actual_distance !== undefined && request.actual_distance !== null)) {
        actualDistance = request.actual_distance;
      } else if (request && request.distance_km) {
        actualDistance = request.distance_km;
      } else if (raw && raw.actual_distance) {
        actualDistance = raw.actual_distance;
      } else if (raw && raw.distance_km) {
        actualDistance = raw.distance_km;
      }
      
      // Duration from rideData (ride-level), fallback to request/raw
      let actualDuration = null;
      if (rideData && (rideData.actual_duration !== undefined && rideData.actual_duration !== null)) {
        actualDuration = rideData.actual_duration;
      } else if (request && (request.actual_duration !== undefined && request.actual_duration !== null)) {
        actualDuration = request.actual_duration;
      } else if (request && request.duration_minutes) {
        actualDuration = request.duration_minutes;
      } else if (raw && raw.actual_duration) {
        actualDuration = raw.actual_duration;
      } else if (raw && raw.duration_minutes) {
        actualDuration = raw.duration_minutes;
      }
      
      console.log('📋 Final rating data:', {
        rideId: ride.rideId,
        requestId: ride.requestId,
        driverId,
        driverName,
        totalFare,
        actualDistance,
        actualDuration,
        debug: {
          rideDataExists: !!rideData,
          rideDataDriverId: rideData?.driver_id,
          rideDataDriverName: rideData?.driver_name,
          rideDataActualDistance: rideData?.actual_distance,
          rideDataActualDuration: rideData?.actual_duration,
          requestFareAmount: request?.fare_amount,
          requestTotalFare: request?.total_fare,
        },
      });
      
      // Navigate to rating screen
      navigation.navigate('RatingScreen', {
        rideId: ride.rideId,
        requestId: ride.requestId,
        driverId,
        driverName,
        totalFare,
        actualDistance,
        actualDuration,
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
    if (!dateString) return 'N/A';
    try {
      // Parse ISO string and format without timezone conversion
      const date = new Date(dateString);
      // Use UTC methods to avoid timezone conversion
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
      // Parse ISO string and format without timezone conversion
      const date = new Date(dateString);
      // Use UTC methods to avoid timezone conversion
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const period = date.getUTCHours() >= 12 ? 'PM' : 'AM';
      const displayHours = date.getUTCHours() % 12 || 12;
      return `${displayHours}:${minutes} ${period}`;
    } catch (e) {
      return dateString;
    }
  };

  const formatDateForList = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const months = ['Th 1', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7', 'Th 8', 'Th 9', 'Th 10', 'Th 11', 'Th 12'];
      const day = date.getUTCDate();
      const month = months[date.getUTCMonth()];
      const hours = date.getUTCHours() % 12 || 12;
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const period = date.getUTCHours() >= 12 ? 'PM' : 'AM';
      return `${day} ${month}, ${hours}:${minutes} ${period}`;
    } catch (e) {
      return dateString;
    }
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
          {/* Left: Service Icon and Name */}
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
              {ride.createdAt && (
                <Text style={styles.dateTimeText}>
                  {formatDateForList(ride.createdAt)}
                </Text>
              )}
            </View>
          </View>

          {/* Right: Price and Arrow */}
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
              {selectedTab === 'ongoing' 
                ? 'Bạn chưa có chuyến đi nào đang diễn ra' 
                : 'Chưa có lịch sử chuyến đi'}
            </Text>
            {selectedTab === 'ongoing' && (
              <TouchableOpacity
                style={styles.createRideButton}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.8}
              >
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
          <Animatable.View
            key={`${ride.rideId || ride.requestId}-${index}`}
            animation="fadeInUp"
            duration={480}
            delay={120 + index * 60}
          >
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          <View style={styles.headerSpacing}>
            <GlassHeader
              title="Lịch sử chuyến đi"
              subtitle={`${ongoingRides.length} đang diễn ra | ${completedRides.length} hoàn thành`}
            />
          </View>

          <View style={styles.content}>
            {/* Tabs */}
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

            {/* Content */}
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
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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

