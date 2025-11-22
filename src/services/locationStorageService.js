import AsyncStorage from '@react-native-async-storage/async-storage';
import locationService from './LocationService';
import goongService from './goongService';

class LocationStorageService {
  constructor() {
    this.CURRENT_LOCATION_KEY = 'current_location';
    this.CURRENT_ADDRESS_KEY = 'current_address';
    this.LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Lưu vị trí hiện tại vào AsyncStorage
   */
  async saveCurrentLocation(location) {
    try {
      const locationData = {
        ...location,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(this.CURRENT_LOCATION_KEY, JSON.stringify(locationData));
      return locationData;
    } catch (error) {
      console.error('Error saving current location:', error);
      throw error;
    }
  }

  /**
   * Lấy vị trí hiện tại từ AsyncStorage
   */
  async getCurrentLocation() {
    try {
      const locationStr = await AsyncStorage.getItem(this.CURRENT_LOCATION_KEY);
      if (!locationStr) return null;

      const locationData = JSON.parse(locationStr);
      const now = Date.now();
      
      // Kiểm tra xem vị trí có còn mới không (trong vòng 5 phút)
      if (now - locationData.timestamp > this.LOCATION_CACHE_DURATION) {
        return null; // Vị trí đã cũ, cần lấy lại
      }

      return {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  /**
   * Lưu địa chỉ hiện tại vào AsyncStorage
   */
  async saveCurrentAddress(address) {
    try {
      const addressData = {
        ...address,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(this.CURRENT_ADDRESS_KEY, JSON.stringify(addressData));
      return addressData;
    } catch (error) {
      console.error('Error saving current address:', error);
      throw error;
    }
  }

  /**
   * Lấy địa chỉ hiện tại từ AsyncStorage
   */
  async getCurrentAddress() {
    try {
      const addressStr = await AsyncStorage.getItem(this.CURRENT_ADDRESS_KEY);
      if (!addressStr) return null;

      const addressData = JSON.parse(addressStr);
      const now = Date.now();
      
      // Kiểm tra xem địa chỉ có còn mới không (trong vòng 5 phút)
      if (now - addressData.timestamp > this.LOCATION_CACHE_DURATION) {
        return null; // Địa chỉ đã cũ, cần lấy lại
      }

      return addressData;
    } catch (error) {
      console.error('Error getting current address:', error);
      return null;
    }
  }

  /**
   * Lấy vị trí và địa chỉ hiện tại (ưu tiên cache, fallback GPS)
   */
  async getCurrentLocationWithAddress(forceRefresh = false) {
    try {
      let location = null;
      let address = null;

      if (!forceRefresh) {
        // Thử lấy từ cache trước
        location = await this.getCurrentLocation();
        address = await this.getCurrentAddress();
      }

      // Nếu không có cache hoặc cache đã cũ, lấy từ GPS
      if (!location) {
        location = await locationService.getCurrentLocation();
        if (location) {
          await this.saveCurrentLocation(location);
        }
      }

      // Nếu không có địa chỉ cache, reverse geocode
      if (location && !address) {
        try {
          const reverseGeocode = await goongService.reverseGeocode(
            location.latitude, 
            location.longitude
          );
          
          if (reverseGeocode && reverseGeocode.results && reverseGeocode.results.length > 0) {
            const result = reverseGeocode.results[0];
            address = {
              formattedAddress: result.formatted_address,
              shortAddress: this.extractShortAddress(result.formatted_address),
              components: result.address_components,
              placeId: result.place_id
            };
            await this.saveCurrentAddress(address);
          }
        } catch (geocodeError) {
          console.warn('Reverse geocoding failed:', geocodeError);
          // Tạo địa chỉ fallback từ tọa độ
          address = {
            formattedAddress: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
            shortAddress: 'Vị trí hiện tại',
            components: [],
            placeId: null
          };
        }
      }

      return {
        location,
        address,
        isFromCache: !forceRefresh && location && address
      };
    } catch (error) {
      console.error('Error getting current location with address:', error);
      throw error;
    }
  }

  /**
   * Trích xuất địa chỉ ngắn gọn từ formatted address
   */
  extractShortAddress(formattedAddress) {
    if (!formattedAddress) return 'Vị trí hiện tại';
    
    // Tách các phần của địa chỉ
    const parts = formattedAddress.split(', ');
    
    // Lấy 2-3 phần đầu tiên (số nhà, đường, phường/quận)
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(', ');
    } else if (parts.length >= 2) {
      return parts.slice(0, 2).join(', ');
    }
    
    return parts[0] || 'Vị trí hiện tại';
  }

  /**
   * Xóa cache vị trí (khi user logout hoặc cần refresh)
   */
  async clearLocationCache() {
    try {
      await AsyncStorage.multiRemove([
        this.CURRENT_LOCATION_KEY,
        this.CURRENT_ADDRESS_KEY
      ]);
    } catch (error) {
      console.error('Error clearing location cache:', error);
    }
  }

  /**
   * Kiểm tra xem có cache vị trí không
   */
  async hasValidLocationCache() {
    try {
      const location = await this.getCurrentLocation();
      const address = await this.getCurrentAddress();
      return location && address;
    } catch (error) {
      return false;
    }
  }
}

export const locationStorageService = new LocationStorageService();
