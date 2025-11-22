import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import { colors } from '../../theme/designTokens';
import rideService from '../../services/rideService';

const AvailableRidesScreen = ({ navigation }) => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAvailableRides();
  }, []);

  const loadAvailableRides = async () => {
    try {
      setLoading(true);
      const response = await rideService.getAvailableRides();
      console.log('📋 Available rides response:', response);
      
      if (response?.data) {
        // Filter rides that are available for joining (SCHEDULED or ONGOING)
        const availableRides = response.data.filter(ride => 
          ride.status === 'SCHEDULED' || ride.status === 'ONGOING' || ride.status === 'PENDING'
        );
        console.log('✅ Filtered rides:', availableRides.length, 'rides');
        setRides(availableRides);
      } else {
        setRides([]);
      }
    } catch (error) {
      console.error('Error loading available rides:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách chuyến đi. Vui lòng thử lại.');
      setRides([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAvailableRides();
    setRefreshing(false);
  };

  const handleJoinRide = (ride) => {
    console.log('🚗 Joining ride:', ride);
    
    // Navigate to RideBooking with the selected ride
    navigation.navigate('RideBooking', {
      mode: 'join_ride',
      selectedRide: ride,
      fixedDropoff: {
        lat: ride.end_location?.lat,
        lng: ride.end_location?.lng,
        locationId: ride.end_location?.location_id,
        name: ride.end_location?.name,
        address: ride.end_location?.address,
      }
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const renderRideItem = ({ item }) => (
    <Animatable.View animation="fadeInUp" duration={400} useNativeDriver>
      <CleanCard style={styles.rideCard}>
        {/* Route Badge for Template Routes */}
        {item.route_id && (
          <View style={styles.routeBadge}>
            <Icon name="route" size={14} color="#3B82F6" />
            <Text style={styles.routeBadgeText}>Tuyến cố định</Text>
          </View>
        )}

        {/* Driver Info */}
        <View style={styles.driverSection}>
          <View style={styles.driverAvatar}>
            <Icon name="person" size={24} color={colors.primary} />
          </View>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {item.driver_name || 'Tài xế'}
            </Text>
            <View style={styles.driverMeta}>
              <Icon name="star" size={14} color="#FBBF24" />
              <Text style={styles.metaText}>
                {(item.driver_rating || 5.0).toFixed(1)}
              </Text>
              <Text style={styles.metaText}> • </Text>
              <Text style={styles.metaText}>{item.vehicle_model || 'Xe máy'}</Text>
            </View>
          </View>
        </View>

        {/* Route Info */}
        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <Icon name="trip-origin" size={16} color="#22C55E" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.start_location?.name || 'Điểm đón'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <Icon name="location-on" size={16} color="#EF4444" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.end_location?.name || 'Điểm đến'}
            </Text>
          </View>
        </View>

        {/* Time & Price */}
        <View style={styles.detailsSection}>
          <View style={styles.detailItem}>
            <Icon name="schedule" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              {formatDateTime(item.scheduled_time)}
            </Text>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Khoảng cách</Text>
            <Text style={styles.priceText}>
              {item.estimated_distance ? `${item.estimated_distance.toFixed(1)} km` : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Join Button */}
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleJoinRide(item)}
          activeOpacity={0.7}
        >
          <Icon name="group-add" size={20} color="#FFF" />
          <Text style={styles.joinButtonText}>Tham gia</Text>
        </TouchableOpacity>
      </CleanCard>
    </Animatable.View>
  );

  const renderEmptyState = () => (
    <Animatable.View
      animation="fadeIn"
      duration={600}
      style={styles.emptyContainer}
    >
      <Icon name="directions-car" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Chưa có chuyến đi nào</Text>
      <Text style={styles.emptySubtitle}>
        Hiện tại không có chuyến đi nào đang mở.{'\n'}Vui lòng thử lại sau.
      </Text>
      <TouchableOpacity style={styles.refreshButton} onPress={loadAvailableRides}>
        <Icon name="refresh" size={20} color={colors.primary} />
        <Text style={styles.refreshButtonText}>Tải lại</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  return (
    <AppBackground>
      <SafeAreaView style={styles.container}>
        <GlassHeader
          title="Chuyến đi có sẵn"
          onBackPress={() => navigation.goBack()}
        />

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải chuyến đi...</Text>
          </View>
        ) : (
          <FlatList
            data={rides}
            renderItem={renderRideItem}
            keyExtractor={(item) => 
              (item.shared_ride_id || item.sharedRideId || item.rideId || Math.random()).toString()
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  rideCard: {
    marginBottom: 16,
    padding: 16,
  },
  routeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    gap: 4,
  },
  routeBadgeText: {
    fontSize: 12,
    color: '#3B82F6',
    fontFamily: 'Inter_500Medium',
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    marginLeft: 4,
  },
  routeSection: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginLeft: 7,
    marginVertical: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontFamily: 'Inter_400Regular',
  },
  detailsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_600SemiBold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  refreshButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.primary,
  },
});

export default AvailableRidesScreen;

