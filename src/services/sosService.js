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

  async getMyAlerts(statuses = null) {
    try {
      const params = statuses && statuses.length > 0 ? { status: statuses.join(',') } : {};
      console.log('🔍 getMyAlerts - statuses:', statuses);
      console.log('🔍 getMyAlerts - params:', params);
      const result = await apiService.get(ENDPOINTS.SOS.MY_ALERTS, params);
      console.log('🔍 getMyAlerts - result count:', result?.length || 0);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể tải danh sách cảnh báo', 0, error);
    }
  },

  async getAlert(alertId) {
    try {
      return await apiService.get(`${ENDPOINTS.SOS.TRIGGER}/${alertId}`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể tải chi tiết cảnh báo', 0, error);
    }
  },

  async getAlertTimeline(alertId) {
    try {
      return await apiService.get(`${ENDPOINTS.SOS.TRIGGER}/${alertId}/timeline`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể tải timeline', 0, error);
    }
  },

  // Emergency Contacts Management
  async getContacts() {
    try {
      return await apiService.get(ENDPOINTS.SOS.CONTACTS);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể tải danh sách liên hệ khẩn cấp', 0, error);
    }
  },

  async createContact(contactData) {
    try {
      return await apiService.post(ENDPOINTS.SOS.CONTACTS, contactData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể tạo liên hệ khẩn cấp', 0, error);
    }
  },

  async updateContact(contactId, contactData) {
    try {
      return await apiService.put(`${ENDPOINTS.SOS.CONTACTS}/${contactId}`, contactData);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể cập nhật liên hệ khẩn cấp', 0, error);
    }
  },

  async deleteContact(contactId) {
    try {
      return await apiService.delete(`${ENDPOINTS.SOS.CONTACTS}/${contactId}`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể xóa liên hệ khẩn cấp', 0, error);
    }
  },

  async setPrimaryContact(contactId) {
    try {
      return await apiService.post(`${ENDPOINTS.SOS.CONTACTS}/${contactId}/primary`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Không thể đặt liên hệ chính', 0, error);
    }
  },
};

export default sosService;
