import apiService from './api';
import { ENDPOINTS } from '../config/api';

class ReportService {
  constructor() {
    this.apiService = apiService;
  }

  // ========== USER REPORT OPERATIONS ==========

  /**
   * Submit a general user report
   * @param {Object} reportData - { reportType, description }
   * @returns {Promise<Object>} Created report response
   */
  async submitUserReport(reportData) {
    try {
      const response = await this.apiService.post(ENDPOINTS.REPORTS.CREATE, reportData);
      console.log('✅ User report submitted successfully');
      return response;
    } catch (error) {
      console.error('❌ Submit user report error:', error);
      throw error;
    }
  }

  /**
   * Submit a ride-specific report
   * @param {Number} rideId - Ride ID
   * @param {Object} reportData - { reportType, description }
   * @returns {Promise<Object>} Created report response
   */
  async submitRideReport(rideId, reportData) {
    try {
      const endpoint = ENDPOINTS.REPORTS.SUBMIT_RIDE_REPORT.replace('{rideId}', rideId);
      const response = await this.apiService.post(endpoint, reportData);
      console.log('✅ Ride report submitted successfully');
      return response;
    } catch (error) {
      console.error('❌ Submit ride report error:', error);
      throw error;
    }
  }

  // ========== ADMIN REPORT OPERATIONS ==========

  /**
   * Get all reports with optional filters (Admin only)
   * @param {Object} params - { status, reportType, page, size }
   * @returns {Promise<Object>} Paginated reports response
   */
  async getAllReports(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.status) queryParams.append('status', params.status);
      if (params.reportType) queryParams.append('reportType', params.reportType);
      if (params.page !== undefined) queryParams.append('page', params.page);
      if (params.size !== undefined) queryParams.append('size', params.size);

      const endpoint = `${ENDPOINTS.REPORTS.LIST}?${queryParams.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('❌ Get all reports error:', error);
      throw error;
    }
  }

  /**
   * Get report details by ID (Admin only)
   * @param {Number} reportId - Report ID
   * @returns {Promise<Object>} Report details
   */
  async getReportById(reportId) {
    try {
      const endpoint = ENDPOINTS.REPORTS.DETAILS.replace('{reportId}', reportId);
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('❌ Get report details error:', error);
      throw error;
    }
  }

  /**
   * Update report status (Admin only)
   * @param {Number} reportId - Report ID
   * @param {Object} updateData - { status, adminNotes }
   * @returns {Promise<Object>} Updated report response
   */
  async updateReportStatus(reportId, updateData) {
    try {
      const endpoint = ENDPOINTS.REPORTS.UPDATE_STATUS.replace('{reportId}', reportId);
      const response = await this.apiService.patch(endpoint, updateData);
      console.log('✅ Report status updated successfully');
      return response;
    } catch (error) {
      console.error('❌ Update report status error:', error);
      throw error;
    }
  }

  /**
   * Resolve a report (Admin only)
   * @param {Number} reportId - Report ID
   * @param {Object} resolutionData - { resolutionMessage }
   * @returns {Promise<Object>} Resolved report response
   */
  async resolveReport(reportId, resolutionData) {
    try {
      const endpoint = ENDPOINTS.REPORTS.RESOLVE.replace('{reportId}', reportId);
      const response = await this.apiService.post(endpoint, resolutionData);
      console.log('✅ Report resolved successfully');
      return response;
    } catch (error) {
      console.error('❌ Resolve report error:', error);
      throw error;
    }
  }

  /**
   * Get user's own reports
   * @param {Object} params - { page, size }
   * @returns {Promise<Object>} Paginated user reports
   */
  async getMyReports(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page !== undefined) queryParams.append('page', params.page);
      if (params.size !== undefined) queryParams.append('size', params.size);

      const endpoint = `${ENDPOINTS.REPORTS.MY_REPORTS}?${queryParams.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('❌ Get my reports error:', error);
      throw error;
    }
  }

  /**
   * Submit driver response to a report
   * @param {Number} reportId - Report ID
   * @param {Object} responseData - { driverResponse }
   * @returns {Promise<Object>} Updated report response
   */
  async submitDriverResponse(reportId, responseData) {
    try {
      const endpoint = ENDPOINTS.REPORTS.DRIVER_RESPONSE.replace('{reportId}', reportId);
      const response = await this.apiService.post(endpoint, responseData);
      console.log('✅ Driver response submitted successfully');
      return response;
    } catch (error) {
      console.error('❌ Submit driver response error:', error);
      throw error;
    }
  }

  /**
   * Get report analytics (Admin only)
   * @returns {Promise<Object>} Analytics data
   */
  async getReportAnalytics() {
    try {
      const response = await this.apiService.get(ENDPOINTS.REPORTS.ANALYTICS);
      return response;
    } catch (error) {
      console.error('❌ Get report analytics error:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Get report type display text
   * @param {String} type - Report type enum
   * @returns {String} Display text
   */
  getReportTypeText(type) {
    const types = {
      SAFETY: 'An toàn',
      BEHAVIOR: 'Hành vi',
      RIDE_EXPERIENCE: 'Trải nghiệm chuyến đi',
      PAYMENT: 'Thanh toán',
      ROUTE: 'Tuyến đường',
      TECHNICAL: 'Kỹ thuật',
      OTHER: 'Khác',
    };
    return types[type] || type;
  }

  /**
   * Get report status display text
   * @param {String} status - Report status enum
   * @returns {String} Display text
   */
  getReportStatusText(status) {
    const statuses = {
      PENDING: 'Chờ xử lý',
      OPEN: 'Đang mở',
      IN_PROGRESS: 'Đang xử lý',
      RESOLVED: 'Đã giải quyết',
      DISMISSED: 'Đã bỏ qua',
    };
    return statuses[status] || status;
  }

  /**
   * Get report status color
   * @param {String} status - Report status enum
   * @returns {String} Color hex code
   */
  getReportStatusColor(status) {
    const colors = {
      PENDING: '#F59E0B', // Amber
      OPEN: '#3B82F6', // Blue
      IN_PROGRESS: '#8B5CF6', // Purple
      RESOLVED: '#22C55E', // Green
      DISMISSED: '#6B7280', // Gray
    };
    return colors[status] || '#6B7280';
  }

  /**
   * Get report type icon
   * @param {String} type - Report type enum
   * @returns {String} Material icon name
   */
  getReportTypeIcon(type) {
    const icons = {
      SAFETY: 'security',
      BEHAVIOR: 'person-outline',
      RIDE_EXPERIENCE: 'star-outline',
      PAYMENT: 'payment',
      ROUTE: 'route',
      TECHNICAL: 'build',
      OTHER: 'more-horiz',
    };
    return icons[type] || 'report-problem';
  }

  /**
   * Format date to Vietnamese locale
   * @param {String} dateString - ISO date string
   * @returns {String} Formatted date
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  /**
   * Get report types for filter
   * @returns {Array<Object>} Array of { key, label } objects
   */
  getReportTypes() {
    return [
      { key: 'SAFETY', label: 'An toàn' },
      { key: 'BEHAVIOR', label: 'Hành vi' },
      { key: 'RIDE_EXPERIENCE', label: 'Trải nghiệm' },
      { key: 'PAYMENT', label: 'Thanh toán' },
      { key: 'ROUTE', label: 'Tuyến đường' },
      { key: 'TECHNICAL', label: 'Kỹ thuật' },
      { key: 'OTHER', label: 'Khác' },
    ];
  }

  /**
   * Get report statuses for filter
   * @returns {Array<Object>} Array of { key, label } objects
   */
  getReportStatuses() {
    return [
      { key: 'PENDING', label: 'Chờ xử lý' },
      { key: 'OPEN', label: 'Đang mở' },
      { key: 'IN_PROGRESS', label: 'Đang xử lý' },
      { key: 'RESOLVED', label: 'Đã giải quyết' },
      { key: 'DISMISSED', label: 'Đã bỏ qua' },
    ];
  }

  /**
   * Get report priorities
   * @returns {Array<Object>} Array of { key, label } objects
   */
  getReportPriorities() {
    return [
      { key: 'LOW', label: 'Thấp' },
      { key: 'MEDIUM', label: 'Trung bình' },
      { key: 'HIGH', label: 'Cao' },
      { key: 'CRITICAL', label: 'Khẩn cấp' },
    ];
  }

  /**
   * Get priority display text
   * @param {String} priority - Priority level enum
   * @returns {String} Display text
   */
  getPriorityText(priority) {
    const priorities = {
      LOW: 'Thấp',
      MEDIUM: 'Trung bình',
      HIGH: 'Cao',
      CRITICAL: 'Khẩn cấp',
    };
    return priorities[priority] || priority;
  }

  /**
   * Get priority color
   * @param {String} priority - Priority level enum
   * @returns {String} Color hex code
   */
  getPriorityColor(priority) {
    const colors = {
      LOW: '#10B981', // Green
      MEDIUM: '#3B82F6', // Blue
      HIGH: '#F59E0B', // Amber
      CRITICAL: '#EF4444', // Red
    };
    return colors[priority] || '#6B7280';
  }

  /**
   * Get priority icon
   * @param {String} priority - Priority level enum
   * @returns {String} Material icon name
   */
  getPriorityIcon(priority) {
    const icons = {
      LOW: 'arrow-downward',
      MEDIUM: 'remove',
      HIGH: 'arrow-upward',
      CRITICAL: 'priority-high',
    };
    return icons[priority] || 'info';
  }
}

export default new ReportService();

