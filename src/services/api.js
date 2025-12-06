import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
};

class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.CURRENT.BASE_URL;
    this.timeout = API_CONFIG.CURRENT.TIMEOUT;
    this.token = null;
  }

  // Initialize tokens from storage
  async init() {
    try {
      this.token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (refreshToken) {
        this.setRefreshToken(refreshToken);
      }
    } catch (error) {
      console.error('Error loading tokens from storage:', error);
    }
  }

  // Set authorization token
  setToken(token) {
    this.token = token;
    if (token) {
      AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    }
  }

  // Set refresh token
  setRefreshToken(refreshToken) {
    if (refreshToken) {
      AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  }

  // Get refresh token
  async getRefreshToken() {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  // Clear tokens
  clearTokens() {
    this.token = null;
    AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  // Get authorization headers
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('Refreshing access token...');
      
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      const newAccessToken = data.access_token || data.token;
      const newRefreshToken = data.refresh_token;

      if (newAccessToken) {
        this.setToken(newAccessToken);
        if (newRefreshToken) {
          this.setRefreshToken(newRefreshToken);
        }
        console.log('Token refreshed successfully');
        return newAccessToken;
      } else {
        throw new Error('No access token in refresh response');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Clear invalid tokens
      this.clearTokens();
      throw error;
    }
  }

  // Generic API request method with auto token refresh
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Prepare headers - don't set Content-Type for FormData (let React Native handle it)
    let headers = {};
    const isFormData = options.body instanceof FormData;
    
    if (!isFormData) {
      headers = this.getAuthHeaders();
    } else {
      // For FormData, only set Accept and Authorization
      headers['Accept'] = 'application/json';
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
    }
    
    let config = {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    };

    try {
      console.log(`API Request: ${config.method || 'GET'} ${url}`, {
        isFormData,
        hasBody: !!config.body,
        headers: Object.keys(config.headers),
      });
      
      let response = await fetch(url, config);
      let data = await this.parseResponse(response);

      // Check if token expired (401 Unauthorized)
      if (response.status === 401 && this.token) {
        console.log('Token expired, attempting refresh...');
        
        try {
          // Try to refresh the token
          await this.refreshAccessToken();
          
          // Retry the original request with new token
          // Handle FormData headers correctly
          if (isFormData) {
            config.headers = {
              'Accept': 'application/json',
              'Authorization': `Bearer ${this.token}`,
            };
          } else {
          config.headers = this.getAuthHeaders();
          }
          response = await fetch(url, config);
          data = await this.parseResponse(response);
          
          if (!response.ok) {
            console.error('API Request Error after refresh:', data);
            throw new ApiError(data.message || 'API request failed', response.status, data);
          }
          
          console.log('Request successful after token refresh');
          return data;
        } catch (refreshError) {
          console.error('Token refresh failed, redirecting to login');
          // Token refresh failed, user needs to login again
          throw new ApiError('Session expired. Please login again.', 401, { requiresLogin: true });
        }
      }

      if (!response.ok) {
        const message = (data && data.message) || (typeof data === 'string' ? data : 'API request failed');
        throw new ApiError(message, response.status, data);
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', error);
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      throw new ApiError('Lỗi kết nối mạng hoặc máy chủ không khả dụng', 0, error);
    }
  }

  // GET request
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  // POST request
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // PUT request
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // DELETE request
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file (multipart/form-data)
  async uploadFile(endpoint, file, additionalData = {}) {
    let formData;
    
    if (additionalData instanceof FormData) {
      // If additionalData is already FormData, use it directly
      formData = additionalData;
    } else {
      formData = new FormData();
      // Add file if provided
      if (file) {
        formData.append('file', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      }

      // Add additional data
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
    }

    const headers = {
      // Don't set Content-Type for multipart/form-data in React Native
      // Let the system set it automatically with boundary
      'Accept': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return this.request(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });
  }

  async parseResponse(response) {
    try {
      if (response.status === 204 || response.status === 205) {
        return null;
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader !== null && Number(contentLengthHeader) === 0) {
        return null;
      }

      const text = await response.text();

      if (!text) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        return JSON.parse(text);
      }

      return text;
    } catch (error) {
      console.error('Failed to parse API response:', error);
      throw new ApiError('Invalid response from server', response.status, error);
    }
  }
}

// Custom API Error class
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Create API service instance
const apiService = new ApiService();

// Export the instance and error class
export { apiService, ApiError };
export default apiService;
