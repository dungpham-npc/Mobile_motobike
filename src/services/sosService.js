import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';
import locationService from './LocationService';

const buildDescription = (role, rideId) => {
  const timestamp = new Date().toISOString();
  const rideLabel = rideId ? `chuyến ${rideId}` : 'ngoài chuyến đi';
  return `SOS được kích hoạt bởi ${role} (${rideLabel}) lúc ${timestamp}`;
};

const sosService = {
  async triggerAlert({ rideId = null, rideSnapshot = null, description = null, role = 'rider' }) {
    let location = null;
    try {
      location = await locationService.getCurrentLocation();
    } catch (error) {
      location = locationService.getCachedLocation();
      if (!location) {
        throw error;
      }
    }

    let rideSnapshotPayload = null;
    if (rideSnapshot) {
      try {
        rideSnapshotPayload = JSON.stringify(rideSnapshot);
      } catch (error) {
        console.error('Failed to serialize ride snapshot:', error);
      }
    }

    const payload = {
      currentLat: location.latitude,
      currentLng: location.longitude,
      description: description || buildDescription(role, rideId),
      rideSnapshot: rideSnapshotPayload,
    };

    if (rideId) {
      payload.sharedRideId = rideId;
    }

    try {
      return await apiService.post(ENDPOINTS.SOS.TRIGGER, payload);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể gửi SOS', 0, error);
    }
  },
};

export default sosService;
