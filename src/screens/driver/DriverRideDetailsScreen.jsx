import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CleanCard from '../../components/ui/CleanCard';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import MiniMap from '../../components/MiniMap';
import rideService from '../../services/rideService';
import goongService from '../../services/goongService';
import paymentService from '../../services/paymentService';
import { colors } from '../../theme/designTokens';
import { parseBackendDate } from '../../utils/time';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';

const DriverRideDetailsScreen = ({ navigation, route }) => {
  const { rideId } = route?.params || {};
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [completing, setCompleting] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(null);

  useEffect(() => {
    if (rideId) {
      loadRideDetails();
      loadRideRequests();
      loadEarnings();
    }
  }, [rideId]);

  const loadRideDetails = async () => {
    try {
      setLoading(true);
      const response = await rideService.getRideDetails(rideId);
      setRide(response);
      
      // Decode polyline if available
      const polyline = response.polyline || response.route?.polyline;
      if (polyline) {
        try {
          const decodedPolyline = goongService.decodePolyline(polyline);
          const formattedPolyline = decodedPolyline.map(point => [point.longitude, point.latitude]);
          setRoutePolyline(formattedPolyline);
        } catch (error) {
          console.error('❌ [DriverRideDetails] Error decoding polyline:', error);
        }
      }
    } catch (error) {
      console.error('❌ [DriverRideDetails] Error loading ride details:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin chuyến xe. Vui lòng thử lại.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadRideRequests = async () => {
    try {
      const response = await rideService.getRideRequests(rideId);
      const requests = response?.data || response?.content || [];
      setRideRequests(requests);
    } catch (error) {
      console.error('❌ [DriverRideDetails] Error loading ride requests:', error);
    }
  };

  const loadEarnings = async () => {
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

      // Calculate earnings for this ride
      let earnings = 0;
      txList.forEach((tx) => {
        if (
          tx.type === 'CAPTURE_FARE' &&
          tx.direction === 'IN' &&
          tx.status === 'SUCCESS' &&
          (tx.sharedRideId === rideId || tx.shared_ride_id === rideId || tx.rideId === rideId)
        ) {
          earnings += parseFloat(tx.amount) || 0;
        }
      });
      setTotalEarnings(earnings > 0 ? earnings : null);
    } catch (error) {
      console.warn('Could not load earnings:', error);
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = parseBackendDate(dateTimeString);
    if (!date) return 'Ngay lập tức';
    
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return 'Đã qua';
    if (diffMins < 60) return `Trong ${diffMins} phút`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Trong ${diffHours} giờ`;
    
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '0 ₫';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(num);
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
        return '#FF9800';
      case 'ONGOING':
        return '#2196F3';
      case 'COMPLETED':
        return '#4CAF50';
      case 'CANCELLED':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'SCHEDULED':
        return 'Đã lên lịch';
      case 'ONGOING':
        return 'Đang diễn ra';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status || 'Không xác định';
    }
  };

  const handleViewTracking = () => {
    if (!ride) return;
    
    navigation.navigate('DriverRideTracking', {
      rideId: ride.shared_ride_id || ride.sharedRideId || rideId,
      rideData: ride,
      status: ride.status,
    });
  };

  const handleCompleteRide = () => {
    if (!ride) {
      return;
    }

    const rideKey = ride.shared_ride_id || ride.sharedRideId || rideId;
    if (!rideKey) {
      Alert.alert('Lỗi', 'Không xác định được mã chuyến đi.');
      return;
    }

    Alert.alert(
      'Kết thúc chuyến đi',
      'Bạn có chắc chắn muốn hoàn thành chuyến đi này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            try {
              setCompleting(true);
              const response = await rideService.completeRide(rideKey);

              const actions = [];
              if (response) {
                actions.push({
                  text: 'Xem biên nhận',
                  onPress: () =>
                    navigation.navigate('DriverCompletion', {
                      completionData: response,
                    }),
                });
              }
              actions.push({ text: 'Đóng', style: 'cancel' });

              Alert.alert('Thành công', 'Chuyến đi đã được hoàn thành.', actions);

              await Promise.all([loadRideDetails(), loadRideRequests()]);
            } catch (error) {
              console.error('❌ [DriverRideDetails] Complete ride error:', error);
              Alert.alert(
                'Lỗi',
                error?.message || 'Không thể hoàn thành chuyến đi.'
              );
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Đang tải...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (!ride) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.container}>
          <SoftBackHeader
            title="Chi tiết chuyến xe"
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={48} color="#F44336" />
            <Text style={styles.errorText}>Không tìm thấy chuyến xe</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Quay lại</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const startLocation = ride.start_location || ride.startLocation;
  const endLocation = ride.end_location || ride.endLocation;
  const scheduledTime = ride.scheduled_time || ride.scheduledTime;
  const actualStartTime = ride.started_at || ride.startedAt || ride.actual_start_time || ride.actualStartTime;
  const actualEndTime = ride.completed_at || ride.completedAt || ride.actual_end_time || ride.actualEndTime;
  const vehicleModel = ride.vehicle_model || ride.vehicleModel || '';
  const vehiclePlate = ride.vehicle_plate || ride.vehiclePlate || '';
  const driverName = ride.driver_name || ride.driverName || '';
  const driverRating = ride.driver_rating || ride.driverRating || null;
  const actualDistance = ride.actual_distance || ride.actualDistance || null;
  const actualDuration = ride.actual_duration || ride.actualDuration || null;

  return (
    <AppBackground>
      <SafeAreaView style={styles.container}>
        <SoftBackHeader
          title="Chi tiết chuyến xe"
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <CleanCard style={styles.statusCard} contentStyle={styles.statusCardContent}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ride.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(ride.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(ride.status) }]}>
              {getStatusText(ride.status)}
            </Text>
          </View>
          {actualEndTime && (
            <View style={styles.completedTimeContainer}>
              <Icon name="flag" size={18} color="#4CAF50" />
              <View style={styles.completedTimeInfo}>
                <Text style={styles.completedTimeLabel}>Thời gian kết thúc</Text>
                <Text style={styles.completedTimeValue}>{formatDateTime(actualEndTime)}</Text>
              </View>
            </View>
          )}
        </CleanCard>

        {/* Mini Map (Grab-style) */}
        {startLocation && endLocation && (
          <CleanCard style={styles.mapCard} contentStyle={styles.mapCardContent}>
            <MiniMap
              startLocation={startLocation}
              endLocation={endLocation}
              polyline={routePolyline}
              height={200}
            />
          </CleanCard>
        )}

        {/* Route Information */}
        <CleanCard style={styles.card}>
          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="radio-button-checked" size={20} color="#4CAF50" />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Điểm bắt đầu</Text>
              <Text style={styles.routeText}>
                {startLocation?.name || startLocation?.address || 'Không xác định'}
              </Text>
            </View>
          </View>

          <View style={styles.routeDivider} />

          <View style={styles.routeRow}>
            <View style={styles.routeIconContainer}>
              <Icon name="location-on" size={20} color="#F44336" />
            </View>
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Điểm kết thúc</Text>
              <Text style={styles.routeText}>
                {endLocation?.name || endLocation?.address || 'Không xác định'}
              </Text>
            </View>
          </View>
        </CleanCard>

        {/* Driver & Vehicle Info */}
        {(driverName || vehicleModel || vehiclePlate) && (
          <CleanCard style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin tài xế & xe</Text>
            
            {driverName && (
              <View style={styles.detailRow}>
                <Icon name="person" size={20} color="#666" />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Tài xế</Text>
                  <Text style={styles.detailValue}>{driverName}</Text>
                </View>
              </View>
            )}

            {driverRating && (
              <View style={styles.detailRow}>
                <Icon name="star" size={20} color="#FFD700" />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Đánh giá</Text>
                  <Text style={styles.detailValue}>{driverRating.toFixed(1)} ⭐</Text>
                </View>
              </View>
            )}

            {vehicleModel && (
              <View style={styles.detailRow}>
                <Icon name="two-wheeler" size={20} color="#666" />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Loại xe</Text>
                  <Text style={styles.detailValue}>{vehicleModel}</Text>
                </View>
              </View>
            )}

            {vehiclePlate && (
              <View style={styles.detailRow}>
                <Icon name="confirmation-number" size={20} color="#666" />
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Biển số xe</Text>
                  <Text style={styles.detailValue}>{vehiclePlate}</Text>
                </View>
              </View>
            )}
          </CleanCard>
        )}

        {/* Ride Details */}
        <CleanCard style={styles.card}>
          <Text style={styles.cardTitle}>Thông tin chuyến xe</Text>
          
          {scheduledTime && (
            <View style={styles.detailRow}>
              <Icon name="schedule" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Thời gian khởi hành</Text>
                <Text style={styles.detailValue}>{formatDateTime(scheduledTime)}</Text>
              </View>
            </View>
          )}

          {ride.estimated_distance && (
            <View style={styles.detailRow}>
              <Icon name="straighten" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Khoảng cách ước tính</Text>
                <Text style={styles.detailValue}>
                  {(ride.estimated_distance || ride.estimatedDistance || 0).toFixed(1)} km
                </Text>
              </View>
            </View>
          )}     

          {rideRequests.length > 0 && (
            <View style={styles.detailRow}>
              <Icon name="people" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Số hành khách</Text>
                <Text style={styles.detailValue}>{rideRequests.length} người</Text>
              </View>
            </View>
          )}

          {ride.base_fare && (
            <View style={styles.detailRow}>
              <Icon name="attach-money" size={20} color="#666" />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Giá cơ bản</Text>
                <Text style={styles.detailValue}>
                  {formatCurrency(ride.base_fare || ride.baseFare)}
                </Text>
              </View>
            </View>
          )}
        </CleanCard>

        {/* Ride Requests */}
        {rideRequests.length > 0 && (
          <CleanCard style={styles.card}>
            <Text style={styles.cardTitle}>Yêu cầu tham gia ({rideRequests.length})</Text>
            {rideRequests.map((request, index) => (
              <View key={request.shared_ride_request_id || request.sharedRideRequestId || index} style={styles.requestItem}>
                <View style={styles.requestInfo}>
                  <Text style={styles.requestRiderName}>
                    {request.rider_name || request.riderName || 'Hành khách'}
                  </Text>
                  <Text style={styles.requestStatus}>
                    {getStatusText(request.status)}
                  </Text>
                </View>
                {request.total_fare && (
                  <Text style={styles.requestFare}>
                    {formatCurrency(request.total_fare || request.totalFare)}
                  </Text>
                )}
              </View>
            ))}
          </CleanCard>
        )}

        {/* Action Buttons */}
        {(ride.status === 'SCHEDULED' || ride.status === 'ONGOING') && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.trackingButton]}
              onPress={handleViewTracking}
            >
              <Icon name="navigation" size={24} color="#fff" />
              <Text style={styles.actionButtonText}>
                {ride.status === 'SCHEDULED'
                  ? 'Bắt đầu theo dõi'
                  : 'Xem theo dõi'}
              </Text>
            </TouchableOpacity>

            {ride.status === 'ONGOING' && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.completeButton,
                  completing && styles.disabledButton,
                ]}
                onPress={handleCompleteRide}
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="flag" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Kết thúc chuyến đi</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  statusCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  statusCardContent: {
    padding: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  completedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  completedTimeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  completedTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  completedTimeValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  mapCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  mapCardContent: {
    padding: 0,
    overflow: 'hidden',
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  routeText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
    marginLeft: 32,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailInfo: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  requestInfo: {
    flex: 1,
  },
  requestRiderName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  requestStatus: {
    fontSize: 12,
    color: '#666',
  },
  requestFare: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButtons: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  trackingButton: {
    backgroundColor: colors.primary,
  },
  completeButton: {
    backgroundColor: '#FF7043',
  },
  disabledButton: {
    opacity: 0.7,
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default DriverRideDetailsScreen;

