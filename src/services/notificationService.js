import apiService from './api';
import { ENDPOINTS } from '../config/api';

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
};

const notificationService = {
  async getNotifications(page = 0, size = 20, sortBy = 'createdAt', sortDir = 'desc') {
    const query = buildQueryString({ page, size, sortBy, sortDir });
    const endpoint = `${ENDPOINTS.NOTIFICATIONS.LIST}?${query}`;
    return apiService.get(endpoint);
  },

  async getNotificationById(notifId) {
    const endpoint = ENDPOINTS.NOTIFICATIONS.DETAIL.replace('{notifId}', notifId);
    return apiService.get(endpoint);
  },

  async markAsRead(notifId) {
    const endpoint = ENDPOINTS.NOTIFICATIONS.MARK_READ.replace('{notifId}', notifId);
    return apiService.put(endpoint, {});
  },

  async markAllAsRead() {
    return apiService.put(ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, {});
  },

  async deleteNotification(notifId) {
    const endpoint = ENDPOINTS.NOTIFICATIONS.DELETE.replace('{notifId}', notifId);
    return apiService.delete(endpoint);
  },

  async deleteAllNotifications() {
    return apiService.delete(ENDPOINTS.NOTIFICATIONS.DELETE_ALL);
  },
};

export default notificationService;
