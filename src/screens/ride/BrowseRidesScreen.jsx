import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import CleanCard from '../../components/ui/CleanCard.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';
import rideService from '../../services/rideService';

const BrowseRidesScreen = ({ navigation }) => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadRides(true);
  }, []);

  useEffect(() => {
    console.log('🔍 [BrowseRides] Rides state changed, count:', rides.length);
    if (rides.length > 0) {
      console.log('🔍 [BrowseRides] First ride in state:', JSON.stringify(rides[0], null, 2));
    }
  }, [rides]);

  const loadRides = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setPage(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = reset ? 0 : page;
      const response = await rideService.getAvailableRides(null, null, currentPage, 20);
      
      console.log('🔍 [BrowseRides] Raw API response:', JSON.stringify(response, null, 2));
      
      const ridesData = response?.data || response?.content || response || [];
      const pagination = response?.pagination || {};
      
      console.log('🔍 [BrowseRides] Extracted ridesData:', JSON.stringify(ridesData, null, 2));
      console.log('🔍 [BrowseRides] Number of rides:', ridesData.length);
      
      if (ridesData.length > 0) {
        console.log('🔍 [BrowseRides] First ride:', JSON.stringify(ridesData[0], null, 2));
        console.log('🔍 [BrowseRides] First ride start_location:', JSON.stringify(ridesData[0].start_location, null, 2));
        console.log('🔍 [BrowseRides] First ride end_location:', JSON.stringify(ridesData[0].end_location, null, 2));
        console.log('🔍 [BrowseRides] First ride scheduled_time:', ridesData[0].scheduled_time);
      }
      
      if (reset) {
        setRides(ridesData);
      } else {
        setRides(prev => [...prev, ...ridesData]);
      }

      // Check if there are more pages
      const totalPages = pagination.totalPages || 1;
      setHasMore(currentPage + 1 < totalPages);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Error loading rides:', error);
      if (reset) {
        setRides([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRides(true);
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadRides(false);
    }
  };

  const handleRidePress = (ride) => {
    const rideId = ride.shared_ride_id || ride.sharedRideId || ride.rideId;
    navigation.navigate('RideDetails', { rideId });
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'Ngay lập tức';
    
    try {
      // Backend sends local time (Vietnam UTC+7) but marks it as UTC with 'Z'
      // Remove 'Z' to parse as local time without timezone conversion
      let localTimeString = dateTimeString;
      if (dateTimeString.endsWith('Z')) {
        localTimeString = dateTimeString.replace('Z', '');
      }
      
      // Parse as local time (no timezone conversion)
      const date = new Date(localTimeString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('⚠️ [BrowseRides] Invalid date:', dateTimeString);
        return 'Ngay lập tức';
      }
      
      // Extract hours and minutes directly from the string to avoid timezone issues
      // Format: "2025-11-10T22:09:44" or "2025-11-10T22:09:44Z"
      const timeMatch = localTimeString.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
      }
      
      // Fallback to Date parsing
      const now = new Date();
      const diffMs = date - now;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 0) return 'Đã qua';
      if (diffMins < 60) return `Trong ${diffMins} phút`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Trong ${diffHours} giờ`;
      
      // Format as local time (already in local timezone)
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('❌ [BrowseRides] Error formatting date time:', error, dateTimeString);
      return 'Ngay lập tức';
    }
  };

  const renderRideItem = ({ item, index }) => {
    console.log(`🔍 [BrowseRides] Rendering item ${index}:`, JSON.stringify(item, null, 2));
    
    const rideId = item.shared_ride_id || item.sharedRideId || item.rideId;
    const driverName = item.driver_name || item.driverName || 'Tài xế';
    const driverRating = item.driver_rating || item.driverRating || 4.8;
    
    // Extract location names/addresses - handle null, undefined, and empty strings
    // LocationResponse structure: { locationId, name, lat, lng, address }
    const getLocationDisplay = (location) => {
      console.log('🔍 [BrowseRides] getLocationDisplay called with:', JSON.stringify(location, null, 2));
      if (!location) {
        console.log('🔍 [BrowseRides] Location is null/undefined');
        return null;
      }
      const name = location.name;
      const address = location.address;
      console.log('🔍 [BrowseRides] Location name:', name, 'type:', typeof name);
      console.log('🔍 [BrowseRides] Location address:', address, 'type:', typeof address);
      
      // Return name if it exists and is not empty, otherwise return address
      if (name != null && name !== undefined && String(name).trim() !== '') {
        console.log('🔍 [BrowseRides] Returning name:', String(name).trim());
        return String(name).trim();
      }
      if (address != null && address !== undefined && String(address).trim() !== '') {
        console.log('🔍 [BrowseRides] Returning address:', String(address).trim());
        return String(address).trim();
      }
      console.log('🔍 [BrowseRides] No valid name or address found');
      return null;
    };
    
    const startLocationRaw = item.start_location || item.startLocation;
    const endLocationRaw = item.end_location || item.endLocation;
    
    console.log('🔍 [BrowseRides] startLocationRaw:', JSON.stringify(startLocationRaw, null, 2));
    console.log('🔍 [BrowseRides] endLocationRaw:', JSON.stringify(endLocationRaw, null, 2));
    
    const startLocation = getLocationDisplay(startLocationRaw) || 'Điểm đi';
    const endLocation = getLocationDisplay(endLocationRaw) || 'Điểm đến';
    
    console.log('🔍 [BrowseRides] Final startLocation:', startLocation);
    console.log('🔍 [BrowseRides] Final endLocation:', endLocation);
    
    const scheduledTime = item.scheduled_time || item.scheduledTime;
    console.log('🔍 [BrowseRides] Raw scheduledTime:', scheduledTime);
    
    const formattedTime = formatDateTime(scheduledTime);
    console.log('🔍 [BrowseRides] Formatted time:', formattedTime);
    
    const baseFare = item.base_fare || item.baseFare || 0;
    const availableSeats = item.available_seats !== undefined ? item.available_seats : 1;

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={400}
        delay={index * 50}
        useNativeDriver
      >
        <TouchableOpacity
          style={styles.rideCard}
          activeOpacity={0.88}
          onPress={() => handleRidePress(item)}
        >
          <CleanCard style={styles.card} contentStyle={styles.cardContent}>
            <View style={styles.rideHeader}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Icon name="person" size={24} color={colors.primary} />
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={14} color="#FBBF24" />
                    <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
                    <Text style={styles.seatsText}> • {availableSeats} chỗ trống</Text>
                  </View>
                </View>
              </View>
              <View style={styles.fareContainer}>
                <Text style={styles.fareText}>{rideService.formatCurrency(baseFare)}</Text>
              </View>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <View style={styles.pickupDot} />
                <Text style={styles.routeText} numberOfLines={1}>{startLocation}</Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routePoint}>
                <View style={styles.dropoffDot} />
                <Text style={styles.routeText} numberOfLines={1}>{endLocation}</Text>
              </View>
            </View>

            <View style={styles.rideFooter}>
              <View style={styles.timeContainer}>
                <Icon name="schedule" size={16} color={colors.textSecondary} />
                <Text style={styles.timeText}>{formattedTime}</Text>
              </View>
              <Icon name="chevron-right" size={24} color={colors.textSecondary} />
            </View>
          </CleanCard>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="directions-car" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Không có chuyến xe nào</Text>
        <Text style={styles.emptySubtitle}>
          Hiện tại không có chuyến xe chia sẻ nào khả dụng
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <GlassHeader
          title="Chuyến xe khả dụng"
          subtitle="Tìm chuyến đi phù hợp"
          onBackPress={() => navigation.goBack()}
        />

        {loading && rides.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải chuyến xe...</Text>
          </View>
        ) : (
          <FlatList
            data={rides}
            renderItem={renderRideItem}
            keyExtractor={(item, index) => 
              (item.shared_ride_id || item.sharedRideId || item.rideId || index).toString()
            }
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={renderEmpty}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
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
  rideCard: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    padding: 20,
    gap: 16,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(16,65,47,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  seatsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  fareContainer: {
    alignItems: 'flex-end',
  },
  fareText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  routeContainer: {
    gap: 8,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  dropoffDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44336',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: colors.border,
    marginLeft: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default BrowseRidesScreen;

