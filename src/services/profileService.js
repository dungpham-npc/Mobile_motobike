import apiService,{ApiError} from './api';
import { ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Storage keys
const STORAGE_KEYS = {
  USER_DATA: 'user_data',
};

class ProfileService {
  constructor() {
    this.apiService = apiService;
  }

  // Save user data to storage
  async saveUserToStorage(userData) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  }

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

  // Update profile
  async updateProfile(profileData) {
    try {
      console.log('Updating profile with data:', profileData);
      // Backend endpoint is /me/profile, not /me
      const response = await apiService.put('/me/profile', profileData);
      console.log('Profile update response:', response);
      
      // Save updated user data to storage
      if (response) {
      await this.saveUserToStorage(response);
      }
      
      return response;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

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

  // Update avatar
  async updateAvatar(avatarFile) {
    try {
      console.log('Updating avatar with file:', {
        uri: avatarFile.uri,
        type: avatarFile.type,
        name: avatarFile.name,
        platform: Platform.OS,
      });

      // Create FormData with correct field name for backend
      const formData = new FormData();
      
      // Prepare file object - handle URI differently for iOS vs Android
      let fileUri = avatarFile.uri;
      
      // For iOS, remove file:// prefix
      // For Android, keep file:// prefix (React Native handles it)
      if (Platform.OS === 'ios' && fileUri.startsWith('file://')) {
        fileUri = fileUri.replace('file://', '');
      }
      // Android: keep file:// as React Native fetch handles it correctly
      
      // Ensure MIME type is valid
      let mimeType = avatarFile.type || 'image/jpeg';
      if (mimeType === 'image') {
        // If type is just "image", determine from extension
        const uri = avatarFile.uri.toLowerCase();
        if (uri.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else {
          mimeType = 'image/jpeg'; // default
        }
      }
      
      const fileObject = {
        uri: fileUri,
        type: mimeType,
        name: avatarFile.name || 'avatar.jpg',
      };
      
      console.log('File object prepared:', fileObject);
      
      // Backend expects field name 'avatar'
      formData.append('avatar', fileObject);
      
      console.log('FormData created, calling uploadFile...');
      
      // Backend endpoint accepts both PUT and POST
      const response = await apiService.uploadFile('/me/update-avatar', null, formData);
      
      console.log('Avatar update response:', response);
      
      // Save updated user data to storage
      if (response) {
        await this.saveUserToStorage(response);
      }
      
      return response;
    } catch (error) {
      console.error('Update avatar error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data,
        stack: error.stack,
      });
      throw error;
    }
  }

  // Switch profile (rider/driver)
  async switchProfile(targetRole) {
    try {
      const response = await apiService.post('/me/switch-profile', {
        targetRole,
      });
      
      // Refresh user profile
      await this.getCurrentUserProfile();
      
      return response;
    } catch (error) {
      console.error('Switch profile error:', error);
      throw error;
    }
  }

  // Submit student verification - Delegate to verificationService
  async submitStudentVerification(documentFile) {
    try {
      const verificationService = await import('./services/verificationService');
      const response = await verificationService.default.submitStudentVerification(documentFile);
      await this.getCurrentUserProfile(); // Refresh profile after submission
      return response;
    } catch (error) {
      console.error('Student verification error:', error);
      throw error;
    }
  }

  // Submit driver verification - Delegate to verificationService
  async submitDriverVerification(verificationData) {
    try {
      const verificationService = await import('./verificationService');
      const response = await verificationService.default.submitDriverVerification(verificationData);
      await this.getCurrentUserProfile(); // Refresh profile after submission
      return response;
    } catch (error) {
      console.error('Driver verification error:', error);
      throw error;
    }
  }

  // Request OTP
  async requestOtp(purpose, email = null) {
    try {
      console.log('Request OTP', purpose, email);
      const response = await apiService.post( '/otp', {
        otpFor: purpose,
        email, // Only send if provided (for forgot password)
      });
      return response;
    } catch (error) {
      console.error('Request OTP error:', error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOtp(code, purpose, email = null) {
    try {
      const response = await apiService.post('/otp/verify', {
        code,
        otpFor: purpose,
        email, // Only send if provided (for forgot password)
      });
      return response;
    } catch (error) {
      console.error('Verify OTP error:', error);
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
}

const profileService = new ProfileService();
export default profileService;