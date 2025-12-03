import apiService,{ApiError} from './api';
import { ENDPOINTS } from '../config/api';
class ProfileService {
  constructor() {
    this.apiService = apiService;
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
      const response = await apiService.put('/me', profileData);
      await this.saveUserToStorage(response);
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
      // Create FormData with correct field name for backend
      const formData = new FormData();
      
      const fileObject = {
        uri: avatarFile.uri,
        type: avatarFile.type || 'image/jpeg',
        name: avatarFile.name || 'avatar.jpg',
      };
      
      // For React Native iOS, we might need to use different format
      if (Platform.OS === 'ios') {
        fileObject.uri = avatarFile.uri.replace('file://', '');
      }
      
      formData.append('avatar', fileObject);
      
      const response = await apiService.uploadFile('/me/update-avatar', null, formData);
      return response;
    } catch (error) {
      console.error('Update avatar error:', error);
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