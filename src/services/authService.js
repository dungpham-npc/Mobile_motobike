import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
};

class AuthService {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  // Initialize service
  async init() {
    try {
      await apiService.init();
      await this.loadUserFromStorage();
    } catch (error) {
      console.error('AuthService init error:', error);
    }
  }

  // Load user data from storage
  async loadUserFromStorage() {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userData) {
        this.currentUser = JSON.parse(userData);
      }
    } catch (error) {
      console.error('Error loading user from storage:', error);
    }
  }

  // Save user data to storage
  async saveUserToStorage(userData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      this.currentUser = userData;
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  }

  // Save tokens to storage
  async saveTokens(accessToken, refreshToken) {
    try {
      if (!accessToken) {
        throw new Error('Access token is required');
      }
      
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        apiService.setRefreshToken(refreshToken);
      }
      
      this.token = accessToken;
      apiService.setToken(accessToken);
      
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      // Decode JWT payload (base64)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Check if token expires within next 5 minutes
      return payload.exp <= (currentTime + 300);
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  // Get valid token (refresh if needed)
  async getValidToken() {
    try {
      // Load current token from storage if not in memory
      if (!this.token) {
        this.token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      }

      // If no token or expired, try to refresh
      if (!this.token || this.isTokenExpired(this.token)) {
        console.log('🔄 Token expired or missing, attempting refresh...');
        await this.refreshAccessToken();
      }

      return this.token;
    } catch (error) {
      console.error('Error getting valid token:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('🔄 Refreshing access token...');
      const response = await apiService.post('/auth/refresh', {
        refresh_token: refreshToken
      });

      const newAccessToken = response.access_token || response.token;
      const newRefreshToken = response.refresh_token || refreshToken;

      if (!newAccessToken) {
        throw new Error('No access token received from refresh');
      }

      await this.saveTokens(newAccessToken, newRefreshToken);
      console.log('✅ Token refreshed successfully');
      
      return newAccessToken;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      // If refresh fails, user needs to login again
      await this.clearStorage();
      throw new Error('Session expired. Please login again.');
    }
  }

  // Clear storage
  async clearStorage() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);
      this.token = null;
      this.currentUser = null;
      apiService.clearTokens(); // Use new method to clear both tokens
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  // Login
  async login(email, password, targetProfile = 'rider') {
    try {
      const response = await apiService.post('/auth/login', {
        email,
        password,
        targetProfile,
      });

      // Save tokens - fix for undefined token
      const accessToken = response.access_token || response.token;
      const refreshToken = response.refresh_token;
      
      if (!accessToken) {
        throw new Error('No access token received from server');
      }

      await this.saveTokens(accessToken, refreshToken);

      // Get user profile
      const userProfile = await this.getCurrentUserProfile();
      
      // Check if user has active profile
      const activeProfile = response.active_profile || response.activeProfile;
      console.log('📋 Active profile from login:', activeProfile);
      
      return {
        success: true,
        user: userProfile,
        token: accessToken,
        activeProfile: activeProfile, // null if user doesn't have profile yet
        needsProfile: !activeProfile, // true if user needs to verify to get profile
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register
  async register(userData) {
    try {
      const response = await apiService.post('/auth/register', userData);
      
      return {
        success: true,
        message: response.message || 'Registration successful',
        userId: response.user_id,
      };
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      // Call logout API
      await apiService.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
      // Continue with local logout even if API fails
    } finally {
      // Clear local storage
      await this.clearStorage();
    }
  }

  // Get current user profile
  async getCurrentUserProfile() {
    try {
      const response = await apiService.get('/me');
      await this.saveUserToStorage(response);
      return response;
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  // // Update profile
  // async updateProfile(profileData) {
  //   try {
  //     const response = await apiService.put('/me', profileData);
  //     await this.saveUserToStorage(response);
  //     return response;
  //   } catch (error) {
  //     console.error('Update profile error:', error);
  //     throw error;
  //   }
  // }

  // Update password
  async updatePassword(oldPassword, newPassword) {
    try {
      const response = await apiService.put('/me/update-password', {
        oldPassword,
        newPassword,
      });
      return response;
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  }

  // Backward-compatible alias for screens expecting changePassword
  async changePassword(oldPassword, newPassword) {
    return this.updatePassword(oldPassword, newPassword);
  }

  // // Update avatar
  // async updateAvatar(avatarFile) {
  //   try {
  //     // Create FormData with correct field name for backend
  //     const formData = new FormData();
      
  //     const fileObject = {
  //       uri: avatarFile.uri,
  //       type: avatarFile.type || 'image/jpeg',
  //       name: avatarFile.name || 'avatar.jpg',
  //     };
      
  //     // For React Native iOS, we might need to use different format
  //     if (Platform.OS === 'ios') {
  //       fileObject.uri = avatarFile.uri.replace('file://', '');
  //     }
      
  //     formData.append('avatar', fileObject);
      
  //     const response = await apiService.uploadFile('/me/update-avatar', null, formData);
  //     return response;
  //   } catch (error) {
  //     console.error('Update avatar error:', error);
  //     throw error;
  //   }
  // }

  // // Switch profile (rider/driver)
  // async switchProfile(targetRole) {
  //   try {
  //     const response = await apiService.post('/me/switch-profile', {
  //       targetRole,
  //     });
      
  //     // Refresh user profile
  //     await this.getCurrentUserProfile();
      
  //     return response;
  //   } catch (error) {
  //     console.error('Switch profile error:', error);
  //     throw error;
  //   }
  // }

  // // Submit student verification - Delegate to verificationService
  // async submitStudentVerification(documentFile) {
  //   try {
  //     const verificationService = await import('./verificationService');
  //     const response = await verificationService.default.submitStudentVerification(documentFile);
  //     await this.getCurrentUserProfile(); // Refresh profile after submission
  //     return response;
  //   } catch (error) {
  //     console.error('Student verification error:', error);
  //     throw error;
  //   }
  // }

  // // Submit driver verification - Delegate to verificationService
  // async submitDriverVerification(verificationData) {
  //   try {
  //     const verificationService = await import('./verificationService');
  //     const response = await verificationService.default.submitDriverVerification(verificationData);
  //     await this.getCurrentUserProfile(); // Refresh profile after submission
  //     return response;
  //   } catch (error) {
  //     console.error('Driver verification error:', error);
  //     throw error;
  //   }
  // }

  // Request OTP
  // Backend endpoint: POST /api/v1/otp
  // Request body: { email: string, otpFor: "VERIFY_EMAIL" | "VERIFY_PHONE" | "FORGOT_PASSWORD" }
  async requestOtp(purpose, email = null) {
    try {
      if (!email) {
        throw new Error('Email is required to request OTP');
      }
      console.log('📧 Request OTP for:', purpose, 'email:', email);
      const response = await apiService.post(ENDPOINTS.OTP.REQUEST, {
        email: email,
        otpFor: purpose,
      });
      console.log('✅ OTP requested successfully');
      return response;
    } catch (error) {
      console.error('❌ Request OTP error:', error);
      throw error;
    }
  }

  // Verify OTP
  // Backend endpoint: POST /api/v1/otp/verify
  // Request body: { email: string, otpFor: string, code: string }
  async verifyOtp(code, purpose, email = null) {
    try {
      if (!email) {
        throw new Error('Email is required to verify OTP');
      }
      if (!code || code.length !== 6) {
        throw new Error('OTP code must be 6 digits');
      }
      console.log('🔐 Verifying OTP for:', purpose, 'email:', email);
      const response = await apiService.post(ENDPOINTS.OTP.VERIFY, {
        email: email,
        otpFor: purpose,
        code: code,
      });
      console.log('✅ OTP verified successfully');
      return response;
    } catch (error) {
      console.error('❌ Verify OTP error:', error);
      throw error;
    }
  }

  // Forgot password
  async forgotPassword(emailOrPhone) {
    try {
      const response = await apiService.post('/auth/forgot-password', {
        emailOrPhone,
      });
      return response;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  // Reset password with OTP
  async resetPassword(email, otp, newPassword) {
    try {
      const response = await apiService.post('/auth/reset-password', {
        email,
        otp,
        newPassword,
      });
      return response;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return this.currentUser !== null && apiService.token !== null;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if user is driver
  isDriver() {
    return this.currentUser?.user?.user_type === 'driver' || 
           this.currentUser?.driver_profile !== null;
  }

  // Check if user is rider
  isRider() {
    return this.currentUser?.user?.user_type === 'rider' || 
           this.currentUser?.rider_profile !== null;
  }

  // Check if user has active rider profile (verified)
  isRiderVerified() {
    return this.currentUser?.rider_profile?.status === 'ACTIVE' ||
           this.currentUser?.rider_profile?.status === 'active';
  }

  // Check if user needs rider verification
  needsRiderVerification() {
    // User has rider profile but it's not active (needs verification)
    return this.currentUser?.rider_profile !== null && 
           !this.isRiderVerified();
  }

  // Check if user can use rider features
  canUseRiderFeatures() {
    return this.isRiderVerified();
  }

  // Get rider verification status
  getRiderVerificationStatus() {
    if (!this.currentUser?.rider_profile) {
      return 'NO_PROFILE'; // No rider profile created yet
    }
    
    const status = this.currentUser.rider_profile.status;
    switch (status?.toLowerCase()) {
      case 'active':
        return 'VERIFIED';
      case 'pending':
        return 'PENDING';
      case 'suspended':
        return 'SUSPENDED';
      default:
        return 'UNKNOWN';
    }
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser?.user?.user_type === 'admin' || 
           this.currentUser?.admin_profile !== null;
  }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService;
