import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_RIDE_KEY = 'active_ride';

class ActiveRideService {
  /**
   * Lưu thông tin ride đang active
   */
  async saveActiveRide(rideData) {
    try {
      const activeRide = {
        rideId: rideData.rideId,
        requestId: rideData.requestId,
        status: rideData.status,
        userType: rideData.userType, // 'driver' hoặc 'rider'
        driverInfo: rideData.driverInfo,
        pickupLocation: rideData.pickupLocation,
        dropoffLocation: rideData.dropoffLocation,
        totalFare: rideData.totalFare,
        timestamp: Date.now(),
        // Thêm các field khác cần thiết
        ...rideData
      };
      
      await AsyncStorage.setItem(ACTIVE_RIDE_KEY, JSON.stringify(activeRide));
      console.log('✅ Active ride saved:', activeRide);
      return activeRide;
    } catch (error) {
      console.error('❌ Failed to save active ride:', error);
      return null;
    }
  }

  /**
   * Lấy thông tin ride đang active
   */
  async getActiveRide() {
    try {
      const activeRideData = await AsyncStorage.getItem(ACTIVE_RIDE_KEY);
      if (activeRideData) {
        const activeRide = JSON.parse(activeRideData);
        
        // Validate requestId and rideId
        const requestId = activeRide.requestId;
        const rideId = activeRide.rideId;
        
        if (!requestId || requestId === 'undefined' || requestId === 'null' || requestId === '{requestId}') {
          console.warn('⚠️ Invalid requestId in stored ride, clearing...');
          await this.clearActiveRide();
          return null;
        }
        
        if (!rideId || rideId === 'undefined' || rideId === 'null' || rideId === '{rideId}') {
          console.warn('⚠️ Invalid rideId in stored ride, clearing...');
          await this.clearActiveRide();
          return null;
        }
        
        // Kiểm tra xem ride có còn valid không (không quá 24h)
        const now = Date.now();
        const rideAge = now - (activeRide.timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (rideAge > maxAge) {
          console.log('⏰ Active ride expired, clearing...');
          await this.clearActiveRide();
          return null;
        }
        
        console.log('📱 Retrieved active ride:', activeRide);
        return activeRide;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get active ride:', error);
      // Clear corrupted data
      try {
        await this.clearActiveRide();
      } catch (clearError) {
        console.error('Failed to clear corrupted active ride:', clearError);
      }
      return null;
    }
  }

  /**
   * Xóa thông tin ride đang active
   */
  async clearActiveRide() {
    try {
      await AsyncStorage.removeItem(ACTIVE_RIDE_KEY);
      console.log('🗑️ Active ride cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear active ride:', error);
      return false;
    }
  }

  /**
   * Kiểm tra xem có ride đang active không
   */
  async hasActiveRide() {
    const activeRide = await this.getActiveRide();
    return activeRide !== null;
  }

  /**
   * Cập nhật status của active ride
   */
  async updateActiveRideStatus(status) {
    try {
      const activeRide = await this.getActiveRide();
      if (activeRide) {
        activeRide.status = status;
        activeRide.timestamp = Date.now();
        await this.saveActiveRide(activeRide);
        console.log('🔄 Active ride status updated:', status);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Failed to update active ride status:', error);
      return false;
    }
  }
}

export default new ActiveRideService();
