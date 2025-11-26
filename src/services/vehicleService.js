import apiService from './api';
import { ENDPOINTS } from '../config/api';

class VehicleService {
  constructor() {
    this.apiService = apiService;
  }

  // ========== DRIVER VEHICLE MANAGEMENT ==========

  /**
   * Get all vehicles for the current driver
   * @param {Object} params - Query parameters
   * @param {number} params.page - Page number (0-based)
   * @param {number} params.size - Page size
   * @param {string} params.sortBy - Sort field
   * @param {string} params.sortDir - Sort direction (asc/desc)
   * @returns {Promise<Object>} Paginated vehicle list
   */
  async getDriverVehicles(params = {}) {
    try {
      const {
        page = 0,
        size = 10,
        sortBy = 'createdAt',
        sortDir = 'desc'
      } = params;


      const endpoint = ENDPOINTS.VEHICLES.GET_BY_DRIVER;
      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sortBy,
        sortDir,
        _t: Date.now().toString() // Add timestamp to bypass cache
      });

      const response = await this.apiService.get(`${endpoint}?${queryParams.toString()}`);
      
      return response;
    } catch (error) {
      console.error('Error fetching driver vehicles:', error);
      throw error;
    }
  }

  /**
   * Get vehicle by ID
   * @param {number} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Vehicle details
   */
  async getVehicleById(vehicleId) {
    try {
      console.log('Fetching vehicle by ID:', vehicleId);
      
      const endpoint = ENDPOINTS.VEHICLES.GET_BY_ID.replace('{vehicleId}', vehicleId);
      const response = await this.apiService.get(endpoint);
      
      console.log('Vehicle fetched successfully:', response);
      return response;
    } catch (error) {
      console.error('Error fetching vehicle by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new vehicle
   * @param {Object} vehicleData - Vehicle data
   * @param {string} vehicleData.plateNumber - Vehicle plate number
   * @param {string} vehicleData.model - Vehicle model
   * @param {string} vehicleData.color - Vehicle color
   * @param {number} vehicleData.year - Manufacturing year
   * @param {number} vehicleData.capacity - Vehicle capacity
   * @param {string} vehicleData.fuelType - Fuel type
   * @param {string} vehicleData.insuranceExpiry - Insurance expiry date (ISO string)
   * @param {string} vehicleData.lastMaintenance - Last maintenance date (ISO string)
   * @returns {Promise<Object>} Created vehicle
   */
  async createVehicle(vehicleData) {
    try {
      console.log('Creating vehicle:', vehicleData);

      // Validate required fields
      const requiredFields = ['plateNumber', 'model', 'color', 'year', 'capacity', 'fuelType'];
      for (const field of requiredFields) {
        if (!vehicleData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const response = await this.apiService.post(ENDPOINTS.VEHICLES.CREATE, vehicleData);
      console.log('Vehicle created successfully:', response);
      
      return response;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  /**
   * Update vehicle
   * @param {number} vehicleId - Vehicle ID
   * @param {Object} vehicleData - Updated vehicle data
   * @returns {Promise<Object>} Updated vehicle
   */
  async updateVehicle(vehicleId, vehicleData) {
    try {
      console.log('Updating vehicle:', vehicleId, vehicleData);
      
      const endpoint = ENDPOINTS.VEHICLES.UPDATE.replace('{vehicleId}', vehicleId);
      const response = await this.apiService.put(endpoint, vehicleData);
      
      console.log('Vehicle updated successfully:', response);
      return response;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  }

  /**
   * Delete vehicle
   * @param {number} vehicleId - Vehicle ID
   * @returns {Promise<Object>} Delete confirmation
   */
  async deleteVehicle(vehicleId) {
    try {
      console.log('Deleting vehicle:', vehicleId);
      
      const endpoint = ENDPOINTS.VEHICLES.DELETE.replace('{vehicleId}', vehicleId);
      const response = await this.apiService.delete(endpoint);
      
      console.log('Vehicle deleted successfully:', response);
      return response;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  }

  // ========== UTILITY METHODS ==========

  /**
   * Get current user info (helper method)
   * @returns {Promise<Object>} Current user
   */
  async getCurrentUser() {
    try {
      // Import authService dynamically to avoid circular dependency
      const authService = (await import('./authService')).default;
      return authService.getCurrentUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Get vehicles by status
   * @param {string} status - Vehicle status (active, inactive, maintenance, etc.)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Filtered vehicles
   */
  async getVehiclesByStatus(status, params = {}) {
    try {
      const {
        page = 0,
        size = 10,
        sortBy = 'createdAt',
        sortDir = 'desc'
      } = params;

      console.log('Fetching vehicles by status:', status, params);

      const endpoint = ENDPOINTS.VEHICLES.GET_BY_STATUS.replace('{status}', status);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sortBy,
        sortDir
      });

      const response = await this.apiService.get(`${endpoint}?${queryParams}`);
      console.log('Vehicles by status fetched successfully:', response);
      
      return response;
    } catch (error) {
      console.error('Error fetching vehicles by status:', error);
      throw error;
    }
  }

  /**
   * Get all vehicles (admin function)
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} All vehicles
   */
  async getAllVehicles(params = {}) {
    try {
      const {
        page = 0,
        size = 10,
        sortBy = 'createdAt',
        sortDir = 'desc'
      } = params;

      console.log('Fetching all vehicles:', params);

      const queryParams = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sortBy,
        sortDir
      });

      const response = await this.apiService.get(`${ENDPOINTS.VEHICLES.GET_ALL}?${queryParams}`);
      console.log('All vehicles fetched successfully:', response);
      
      return response;
    } catch (error) {
      console.error('Error fetching all vehicles:', error);
      throw error;
    }
  }

  // ========== HELPER METHODS ==========

  /**
   * Format vehicle for display
   * @param {Object} vehicle - Raw vehicle data
   * @returns {Object} Formatted vehicle
   */
  formatVehicle(vehicle) {
    if (!vehicle) return null;

    return {
      id: vehicle.vehicle_id || vehicle.vehicleId,
      driverId: vehicle.driver_id || vehicle.driverId,
      plateNumber: vehicle.plate_number || vehicle.plateNumber,
      model: vehicle.model,
      color: vehicle.color,
      year: vehicle.year,
      capacity: vehicle.capacity,
      fuelType: vehicle.fuel_type || vehicle.fuelType,
      status: vehicle.status,
      insuranceExpiry: vehicle.insurance_expiry || vehicle.insuranceExpiry,
      lastMaintenance: vehicle.last_maintenance || vehicle.lastMaintenance,
      verifiedAt: vehicle.verified_at || vehicle.verifiedAt,
      createdAt: vehicle.created_at || vehicle.createdAt,
      // Computed fields
      displayName: `${vehicle.model} (${vehicle.plate_number || vehicle.plateNumber})`,
      isActive: vehicle.status === 'active',
      isVerified: !!(vehicle.verified_at || vehicle.verifiedAt),
    };
  }

  /**
   * Format vehicles list
   * @param {Array} vehicles - Raw vehicles array
   * @returns {Array} Formatted vehicles
   */
  formatVehicles(vehicles) {
    if (!Array.isArray(vehicles)) return [];
    return vehicles.map(vehicle => this.formatVehicle(vehicle));
  }

  /**
   * Validate vehicle data
   * @param {Object} vehicleData - Vehicle data to validate
   * @returns {Object} Validation result
   */
  validateVehicleData(vehicleData) {
    const errors = [];

    // Required fields
    const requiredFields = {
      plateNumber: 'Biển số xe',
      model: 'Mẫu xe',
      color: 'Màu xe',
      year: 'Năm sản xuất',
      capacity: 'Số chỗ ngồi',
      fuelType: 'Loại nhiên liệu'
    };

    for (const [field, label] of Object.entries(requiredFields)) {
      if (!vehicleData[field]) {
        errors.push(`${label} là bắt buộc`);
      }
    }

    // Validate plate number format (Vietnamese format)
    if (vehicleData.plateNumber) {
      const plateRegex = /^[0-9]{2}[A-Z]{1,2}-[0-9]{3,5}$/;
      if (!plateRegex.test(vehicleData.plateNumber)) {
        errors.push('Biển số xe không đúng định dạng (VD: 29A-12345)');
      }
    }

    // Validate year
    if (vehicleData.year) {
      const currentYear = new Date().getFullYear();
      if (vehicleData.year < 1990 || vehicleData.year > currentYear + 1) {
        errors.push(`Năm sản xuất phải từ 1990 đến ${currentYear + 1}`);
      }
    }

    // Validate capacity
    if (vehicleData.capacity && (vehicleData.capacity < 1 || vehicleData.capacity > 10)) {
      errors.push('Số chỗ ngồi phải từ 1 đến 10');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default new VehicleService();
