import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';
import permissionService from './permissionService';

const LOCATION_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes
const LAST_KNOWN_REQUIRED_ACCURACY = 1000; // meters
const FALLBACK_LOCATION = {
  latitude: 10.84148, // FPT University HCMC
  longitude: 106.809844,
  accuracy: null,
};

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.watchId = null;
    this.locationCallbacks = [];
  }

  /**
   * Xin quyền vị trí theo đúng flow Android 11+:
   * - Foreground trước
   * - Background (có thể chuyển qua trang Settings)
   * Lưu ý: vẫn trả true nếu chỉ có foreground để bạn có thể chạy chế độ foreground.
   */
  async requestPermissions(requestBackground = false) {
    try {
      console.log('🔐 LocationService requesting permissions...');

      // 1) Foreground (ưu tiên dùng permissionService nếu bạn có đánh dấu logic riêng)
      let fg = await permissionService?.requestLocationPermission?.(true);
      if (!fg || typeof fg.granted !== 'boolean') {
        fg = await Location.requestForegroundPermissionsAsync();
      }
      if (!fg.granted) {
        console.warn('Foreground location permission denied');
        return false;
      }

      if (!requestBackground) return true;

      // 2) Background: cố xin bằng permissionService trước, fallback sang Expo
      let bg = await permissionService?.requestBackgroundLocationPermission?.(true);
      if (!bg || typeof bg.granted !== 'boolean') {
        bg = await Location.requestBackgroundPermissionsAsync();
      }

      if (!bg.granted && Platform.OS === 'android') {
        // Android 11+ thường phải tự mở Settings để bật "Allow all the time"
        Alert.alert(
          'Cần quyền vị trí nền',
          'Để theo dõi chuyến đi khi app ở nền, hãy bật "Cho phép mọi lúc" trong Cài đặt.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: () => Linking.openSettings() },
          ]
        );
        // Vẫn cho phép tiếp tục với foreground
        console.warn('Background location not granted yet → continuing with foreground only');
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  // Lấy vị trí hiện tại (foreground đủ)
  async getCurrentLocation() {
    try {
      const hasPermission = await this.requestPermissions(false);
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS);
      });

      let location = await Promise.race([locationPromise, timeoutPromise]);

      if (!location) {
        console.warn(`Location request timed out after ${LOCATION_TIMEOUT_MS}ms, using last known position`);
        location = await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY,
        });
      }

      if (!location && this.currentLocation) {
        console.warn('Falling back to cached in-memory location');
        return this.currentLocation;
      }

      if (!location) {
        console.warn('Unable to determine current location, using fallback coordinates');
        location = {
          coords: {
            latitude: FALLBACK_LOCATION.latitude,
            longitude: FALLBACK_LOCATION.longitude,
            accuracy: FALLBACK_LOCATION.accuracy,
          },
          timestamp: Date.now(),
        };
      }

      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
      };

      return this.currentLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  // Bắt đầu theo dõi foreground (watchPosition)
  async startLocationTracking(callback) {
    try {
      const hasPermission = await this.requestPermissions(false);
      if (!hasPermission) {
        throw new Error('Location permission denied');
      }

      if (callback && !this.locationCallbacks.includes(callback)) {
        this.locationCallbacks.push(callback);
      }

      if (this.watchId) {
        return; // Đã theo dõi rồi
      }

      this.watchId = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
          mayShowUserSettingsDialog: true, // gợi ý user bật dịch vụ vị trí
        },
        (location) => {
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            timestamp: location.timestamp,
            speed: location.coords.speed,
            heading: location.coords.heading,
          };

          // Notify all callbacks
          this.locationCallbacks.forEach(cb => {
            try {
              cb(this.currentLocation);
            } catch (error) {
              console.error('Error in location callback:', error);
            }
          });
        }
      );

      console.log('Location tracking (foreground) started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      throw error;
    }
  }

  // Dừng theo dõi foreground
  stopLocationTracking(callback = null) {
    if (callback) {
      const index = this.locationCallbacks.indexOf(callback);
      if (index > -1) this.locationCallbacks.splice(index, 1);
    } else {
      this.locationCallbacks = [];
    }

    if (this.locationCallbacks.length === 0 && this.watchId) {
      this.watchId.remove();
      this.watchId = null;
      console.log('Location tracking (foreground) stopped');
    }
  }

  getCachedLocation() {
    return this.currentLocation;
  }

  async getAddressFromCoordinates(latitude, longitude) {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        return {
          formattedAddress: this.formatAddress(address),
          street: address.street,
          name: address.name,
          city: address.city,
          region: address.region,
          country: address.country,
          postalCode: address.postalCode,
        };
      }
      return null;
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return null;
    }
  }

  async getCoordinatesFromAddress(address) {
    try {
      const locations = await Location.geocodeAsync(address);
      if (locations && locations.length > 0) {
        return {
          latitude: locations[0].latitude,
          longitude: locations[0].longitude,
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding:', error);
      return null;
    }
  }

  formatAddress(address) {
    const parts = [];
    if (address.name && address.name !== address.street) parts.push(address.name);
    if (address.street) parts.push(address.street);
    if (address.city) parts.push(address.city);
    if (address.region && address.region !== address.city) parts.push(address.region);
    return parts.join(', ') || 'Vị trí không xác định';
    }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }

  formatDistance(distanceInKm) {
    if (distanceInKm < 1) return `${Math.round(distanceInKm * 1000)}m`;
    return `${distanceInKm.toFixed(1)}km`;
  }

  formatDuration(durationInMinutes) {
    if (durationInMinutes < 60) return `${Math.round(durationInMinutes)} phút`;
    const hours = Math.floor(durationInMinutes / 60);
    const minutes = Math.round(durationInMinutes % 60);
    return `${hours}h ${minutes}p`;
  }

  isWithinRadius(centerLat, centerLon, targetLat, targetLon, radiusKm) {
    const distance = this.calculateDistance(centerLat, centerLon, targetLat, targetLon);
    return distance <= radiusKm;
  }

  getMapRegion(latitude, longitude, latitudeDelta = 0.01, longitudeDelta = 0.01) {
    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }

  getRegionForCoordinates(coordinates, padding = 0.01) {
    if (!coordinates || coordinates.length === 0) return null;
    if (coordinates.length === 1) return this.getMapRegion(coordinates[0].latitude, coordinates[0].longitude);

    let minLat = coordinates[0].latitude;
    let maxLat = coordinates[0].latitude;
    let minLon = coordinates[0].longitude;
    let maxLon = coordinates[0].longitude;

    coordinates.forEach(coord => {
      minLat = Math.min(minLat, coord.latitude);
      maxLat = Math.max(maxLat, coord.latitude);
      minLon = Math.min(minLon, coord.longitude);
      maxLon = Math.max(maxLon, coord.longitude);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const latitudeDelta = Math.max(maxLat - minLat + padding, 0.01);
    const longitudeDelta = Math.max(maxLon - minLon + padding, 0.01);

    return { latitude: centerLat, longitude: centerLon, latitudeDelta, longitudeDelta };
  }
}

const locationService = new LocationService();
export default locationService;
