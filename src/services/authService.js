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
  async getCurrentUserProfile(forceRefresh = false) {
    try {
      // Add timestamp to force fresh request (bypass cache if needed)
      const url = forceRefresh ? `/me?t=${Date.now()}` : '/me';
      const response = await apiService.get(url);
      
      // Always save to storage to ensure we have latest data
      await this.saveUserToStorage(response);
      
      console.log('📋 Profile loaded:', {
        active_profile: response?.active_profile || response?.activeProfile,
        user_type: response?.user?.user_type,
        has_driver_profile: response?.driver_profile !== null,
      });
      
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

  // Switch profile (rider/driver)
  async switchProfile(targetRole) {
    try {
      console.log('🔄 Switching profile to:', targetRole);
      const response = await apiService.post(ENDPOINTS.PROFILE.SWITCH_PROFILE, {
        targetProfile: targetRole, // Backend expects 'targetProfile' not 'targetRole'
      });
      
      console.log('✅ Switch profile response:', JSON.stringify(response, null, 2));
      
      // Extract active_profile and access_token (handle both snake_case and camelCase)
      const activeProfile = response.active_profile || response.activeProfile;
      const accessToken = response.access_token || response.access_token;
      
      console.log('📋 Extracted values:', {
        activeProfile,
        hasAccessToken: !!accessToken,
      });
      
      // Update access token if provided (CRITICAL: must update token before refreshing profile)
      if (accessToken) {
        console.log('💾 Saving new access token...');
        await this.saveTokens(accessToken, null);
        console.log('✅ Access token saved');
      } else {
        console.warn('⚠️ No access token in switch response');
      }
      
      // Wait a moment to ensure backend has processed the switch
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force refresh user profile to get updated role and activeProfile
      console.log('🔄 Refreshing user profile...');
      const updatedProfile = await this.getCurrentUserProfile(true);
      
      // Ensure activeProfile is set from switch response (highest priority)
      if (activeProfile) {
        // Set active_profile in the updated profile
        updatedProfile.active_profile = activeProfile;
        updatedProfile.activeProfile = activeProfile; // Also set camelCase for compatibility
        await this.saveUserToStorage(updatedProfile);
        console.log('💾 Saved activeProfile to user data:', activeProfile);
      } else {
        // Fallback: use activeProfile from /me response
        const profileActiveProfile = updatedProfile?.active_profile || updatedProfile?.activeProfile;
        if (profileActiveProfile) {
          console.log('📋 Using activeProfile from /me:', profileActiveProfile);
          updatedProfile.active_profile = profileActiveProfile;
          updatedProfile.activeProfile = profileActiveProfile;
          await this.saveUserToStorage(updatedProfile);
        } else {
          console.warn('⚠️ No activeProfile found in switch response or /me');
        }
      }
      
      // Final verification
      const finalProfile = await this.getCurrentUserProfile(true);
      console.log('✅ Final profile after switch:', {
        active_profile: finalProfile?.active_profile || finalProfile?.activeProfile,
        user_type: finalProfile?.user?.user_type,
        has_driver_profile: finalProfile?.driver_profile !== null,
        has_rider_profile: finalProfile?.rider_profile !== null,
      });
      
      return {
        ...response,
        active_profile: activeProfile || finalProfile?.active_profile || finalProfile?.activeProfile,
        access_token: accessToken,
      };
    } catch (error) {
      console.error('❌ Switch profile error:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Không thể chuyển đổi chế độ', error.status || 500);
    }
  }

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
    // Priority 1: Check activeProfile from backend (most accurate after switch)
    if (this.currentUser?.active_profile) {
      return this.currentUser.active_profile === 'driver';
    }
    // Priority 2: Check user_type
    if (this.currentUser?.user?.user_type === 'driver') {
      return true;
    }
    // Priority 3: Check if driver_profile exists (fallback)
    return this.currentUser?.driver_profile !== null;
  }

  // Check if user is rider
  isRider() {
    return this.currentUser?.user?.user_type === 'rider' || 
           this.currentUser?.rider_profile !== null;
  }

  // Normalize verification status strings
  normalizeStatus(status) {
    return typeof status === 'string' ? status.trim().toLowerCase() : '';
  }

  // Check if user has active rider profile (verified)
  isRiderVerified() {
    // 1) Check rider_profile status (if backend returns it)
    const riderProfileStatus =
      this.currentUser?.rider_profile?.status ||
      this.currentUser?.riderProfile?.status ||
      this.currentUser?.verification?.rider_profile_status ||
      this.currentUser?.verification?.riderProfileStatus;

    if (this.normalizeStatus(riderProfileStatus) && ['active', 'verified', 'approved'].includes(this.normalizeStatus(riderProfileStatus))) {
      return true;
    }

    // 2) Check campus verification flags
    const campusVerified =
      this.currentUser?.verification?.is_campus_verified ??
      this.currentUser?.verification?.campus_verified ??
      this.currentUser?.user?.campus_verified;

    if (campusVerified === true) {
      return true;
    }

    // 3) Check student verification status
    const studentStatus = this.currentUser?.verification?.student?.status;
    if (this.normalizeStatus(studentStatus) && ['approved', 'verified', 'active'].includes(this.normalizeStatus(studentStatus))) {
      return true;
    }

    // 4) Fallback: check if rider_profile exists (legacy behavior)
    return this.currentUser?.rider_profile !== null;
  }

  // Check if user needs rider verification
  needsRiderVerification() {
    const hasRiderProfile = this.currentUser?.rider_profile !== null || this.currentUser?.verification?.rider_profile_status;
    return hasRiderProfile && !this.isRiderVerified();
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
