import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import GoongMap from '../../components/GoongMap.jsx';
import { locationTrackingService } from '../../services/locationTrackingService';
import rideService from '../../services/rideService';

const { width, height } = Dimensions.get('window');

const RideTrackingScreen = ({ route, navigation }) => {
  const { rideId, startTracking = false, rideData: initialRideData } = route.params || {};
  
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [rideData, setRideData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (rideId) {
      if (initialRideData) {
        // Use data from accept response
        setRideData(initialRideData);
        setLoading(false);
        
        // Fit map to show both pickup and dropoff points
        if (initialRideData?.pickup_lat && initialRideData?.pickup_lng && 
            initialRideData?.dropoff_lat && initialRideData?.dropoff_lng) {
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.fitToCoordinates([
                { latitude: initialRideData.pickup_lat, longitude: initialRideData.pickup_lng },
                { latitude: initialRideData.dropoff_lat, longitude: initialRideData.dropoff_lng }
              ], { edgePadding: 50 });
            }
          }, 1000);
        }
      } else {
        // Fallback: try to load from API (may fail)
        loadRideData();
      }
    }
    
    if (startTracking) {
      startTrackingService();
    }
  }, [rideId, startTracking, initialRideData]);

  const loadRideData = async () => {
    try {
      setLoading(true);
      // Load ride details from API
      const ride = await rideService.getRideById(rideId);
      setRideData(ride);
      
      // Fit map to show both pickup and dropoff points
      if (ride?.pickupLat && ride?.pickupLng && ride?.dropoffLat && ride?.dropoffLng) {
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates([
              { latitude: ride.pickupLat, longitude: ride.pickupLng },
              { latitude: ride.dropoffLat, longitude: ride.dropoffLng }
            ], { edgePadding: 50 });
          }
        }, 1000); // Wait for map to be ready
      }
    } catch (error) {
      console.error('Failed to load ride data:', error);
      setError('Không thể tải thông tin chuyến đi');
    } finally {
      setLoading(false);
    }
  };

  const startTrackingService = async () => {
    try {
      const success = await locationTrackingService.startTracking(rideId);
      
      if (success) {
        setIsTracking(true);
        Alert.alert(
          'Bắt đầu theo dõi',
          'GPS tracking đã được kích hoạt. Hệ thống đang theo dõi vị trí của bạn.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Chờ đợi',
          'GPS tracking sẽ được kích hoạt khi app trở về foreground.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to start tracking:', error);
      Alert.alert(
        'Lỗi',
        'Không thể bắt đầu GPS tracking. Vui lòng kiểm tra quyền truy cập vị trí.',
        [{ text: 'OK' }]
      );
    }
  };

  const stopTrackingService = async () => {
    try {
      await locationTrackingService.stopTracking();
      setIsTracking(false);
      Alert.alert(
        'Dừng theo dõi',
        'GPS tracking đã được dừng.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to stop tracking:', error);
      Alert.alert('Lỗi', 'Không thể dừng GPS tracking.', [{ text: 'OK' }]);
    }
  };

  const startRide = async () => {
    try {
      Alert.alert(
        'Bắt đầu chuyến đi',
        'Bạn có chắc chắn muốn bắt đầu chuyến đi này?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            onPress: async () => {
              try {
                await rideService.startRide(rideId);
                Alert.alert(
                  'Thành công',
                  'Chuyến đi đã được bắt đầu.',
                  [{ text: 'OK' }]
                );
                // Reload ride data to update status
                loadRideData();
              } catch (error) {
                console.error('Failed to start ride:', error);
                Alert.alert('Lỗi', 'Không thể bắt đầu chuyến đi.', [{ text: 'OK' }]);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to start ride:', error);
      Alert.alert('Lỗi', 'Không thể bắt đầu chuyến đi.', [{ text: 'OK' }]);
    }
  };

  const completeRide = async () => {
    try {
      Alert.alert(
        'Hoàn thành chuyến đi',
        'Bạn có chắc chắn muốn hoàn thành chuyến đi này?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xác nhận',
            onPress: async () => {
              try {
                await rideService.completeRide(rideId);
                await stopTrackingService();
                Alert.alert(
                  'Thành công',
                  'Chuyến đi đã được hoàn thành.',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack()
                    }
                  ]
                );
              } catch (error) {
                console.error('Failed to complete ride:', error);
                Alert.alert('Lỗi', 'Không thể hoàn thành chuyến đi.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error completing ride:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Đang tải thông tin chuyến đi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error" size={64} color="#f44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadRideData}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Theo dõi chuyến đi #{rideId}</Text>
        <View style={styles.statusIndicator}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isTracking ? '#4CAF50' : '#f44336' }
          ]} />
          <Text style={styles.statusText}>
            {isTracking ? 'Đang theo dõi' : 'Dừng theo dõi'}
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <GoongMap
          onRef={(api) => { mapRef.current = api; }}
          style={styles.map}
          initialRegion={{
            latitude: rideData?.pickupLat || 10.7769,
            longitude: rideData?.pickupLng || 106.7009,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
          markers={[
            // Pickup Marker
            ...(rideData?.pickupLat && rideData?.pickupLng ? [{
              latitude: rideData.pickupLat,
              longitude: rideData.pickupLng,
              title: 'Điểm đón',
              description: rideData.pickupLocationName || 'Điểm đón',
              pinColor: '#4CAF50'
            }] : []),
            // Dropoff Marker
            ...(rideData?.dropoffLat && rideData?.dropoffLng ? [{
              latitude: rideData.dropoffLat,
              longitude: rideData.dropoffLng,
              title: 'Điểm đến',
              description: rideData.dropoffLocationName || 'Điểm đến',
              pinColor: '#f44336'
            }] : [])
          ]}
          polyline={rideData?.polyline ? decodePolyline(rideData.polyline) : null}
        />
      </View>

      {/* Ride Info */}
      <ScrollView style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Thông tin chuyến đi</Text>
          
          <View style={styles.infoRow}>
            <Icon name="person" size={20} color="#666" />
            <Text style={styles.infoText}>
              Khách hàng: {rideData?.riderName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="location-on" size={20} color="#666" />
            <Text style={styles.infoText}>
              Điểm đón: {rideData?.pickupLocationName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="place" size={20} color="#666" />
            <Text style={styles.infoText}>
              Điểm đến: {rideData?.dropoffLocationName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="attach-money" size={20} color="#666" />
            <Text style={styles.infoText}>
              Giá: {rideData?.totalFare ? `${rideData.totalFare.toLocaleString()} VNĐ` : 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Icon name="schedule" size={20} color="#666" />
            <Text style={styles.infoText}>
              Thời gian đón: {rideData?.pickupTime ? new Date(rideData.pickupTime).toLocaleString('vi-VN') : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {!isTracking ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={startTrackingService}
            >
              <Icon name="play-arrow" size={24} color="white" />
              <Text style={styles.actionButtonText}>Bắt đầu theo dõi</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton]}
              onPress={stopTrackingService}
            >
              <Icon name="stop" size={24} color="white" />
              <Text style={styles.actionButtonText}>Dừng theo dõi</Text>
            </TouchableOpacity>
          )}

          {rideData?.status === 'SCHEDULED' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.startRideButton]}
              onPress={startRide}
            >
              <Icon name="directions-car" size={24} color="white" />
              <Text style={styles.actionButtonText}>Bắt đầu chuyến đi</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={completeRide}
          >
            <Icon name="check-circle" size={24} color="white" />
            <Text style={styles.actionButtonText}>Hoàn thành chuyến đi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper function to decode polyline
const decodePolyline = (encoded) => {
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return poly;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#f44336',
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  mapContainer: {
    height: height * 0.4,
    backgroundColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  actionContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  startRideButton: {
    backgroundColor: '#FF9800',
  },
  completeButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default RideTrackingScreen;
