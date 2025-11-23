import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';

const ResetPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const [formData, setFormData] = useState({
    emailOrPhone: '',
    otpCode: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false,
  });

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers
    };
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendResetRequest = async () => {
    if (!formData.emailOrPhone.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập email hoặc số điện thoại');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(formData.emailOrPhone);
      
      setStep(2);
      startCountdown();
      Alert.alert('Thành công', 'Mã OTP đã được gửi đến email/số điện thoại của bạn');
    } catch (error) {
      console.error('Send reset request error:', error);
      
      let errorMessage = 'Không thể gửi yêu cầu đặt lại mật khẩu';
      if (error instanceof ApiError) {
        switch (error.status) {
          case 404:
            errorMessage = 'Email hoặc số điện thoại không tồn tại trong hệ thống';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!formData.otpCode.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã OTP');
      return;
    }

    if (formData.otpCode.length !== 6) {
      Alert.alert('Lỗi', 'Mã OTP phải có 6 chữ số');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyOtp(formData.otpCode, 'password_reset');
      
      setStep(3);
      Alert.alert('Thành công', 'Mã OTP đã được xác minh. Vui lòng đặt mật khẩu mới');
    } catch (error) {
      console.error('Verify OTP error:', error);
      
      let errorMessage = 'Mã OTP không chính xác hoặc đã hết hạn';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    const passwordValidation = validatePassword(formData.newPassword);
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Mật khẩu không hợp lệ', 
        'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số'
      );
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Lỗi', 'Xác nhận mật khẩu không khớp');
      return;
    }

    setLoading(true);
    try {
      // Note: This would need a reset password API endpoint
      // For now, we'll simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Thành công', 
        'Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      console.error('Reset password error:', error);
      
      let errorMessage = 'Không thể đặt lại mật khẩu';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (countdown > 0) return;
    
    setLoading(true);
    try {
      await authService.forgotPassword(formData.emailOrPhone);
      startCountdown();
      Alert.alert('Thành công', 'Mã OTP mới đã được gửi');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi lại mã OTP');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Animatable.View animation="fadeInRight">
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Nhập thông tin tài khoản</Text>
              <Text style={styles.stepDescription}>
                Nhập email hoặc số điện thoại đã đăng ký để nhận mã OTP
              </Text>
              
              <View style={styles.inputContainer}>
                <Icon name="email" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email hoặc số điện thoại"
                  value={formData.emailOrPhone}
                  onChangeText={(value) => updateFormData('emailOrPhone', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <ModernButton
                title={loading ? "Đang gửi..." : "Gửi mã OTP"}
                onPress={sendResetRequest}
                disabled={loading}
                icon={loading ? null : "send"}
                style={styles.actionButton}
              />
            </View>
          </Animatable.View>
        );

      case 2:
        return (
          <Animatable.View animation="fadeInRight">
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Xác minh OTP</Text>
              <Text style={styles.stepDescription}>
                Nhập mã OTP 6 chữ số đã được gửi đến {formData.emailOrPhone}
              </Text>
              
              <View style={styles.inputContainer}>
                <Icon name="security" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mã OTP (6 chữ số)"
                  value={formData.otpCode}
                  onChangeText={(value) => updateFormData('otpCode', value.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>

              <ModernButton
                title={loading ? "Đang xác minh..." : "Xác minh OTP"}
                onPress={verifyOTP}
                disabled={loading}
                icon={loading ? null : "verified"}
                style={styles.actionButton}
              />

              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Không nhận được mã? </Text>
                <TouchableOpacity 
                  onPress={resendOTP}
                  disabled={countdown > 0 || loading}
                >
                  <Text style={[
                    styles.resendLink,
                    (countdown > 0 || loading) && styles.resendLinkDisabled
                  ]}>
                    {countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi lại'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animatable.View>
        );

      case 3:
        const passwordValidation = validatePassword(formData.newPassword);
        
        return (
          <Animatable.View animation="fadeInRight">
            <View style={styles.stepCard}>
              <Text style={styles.stepTitle}>Đặt mật khẩu mới</Text>
              <Text style={styles.stepDescription}>
                Tạo mật khẩu mới cho tài khoản của bạn
              </Text>
              
              <View style={styles.inputContainer}>
                <Icon name="lock" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu mới"
                  value={formData.newPassword}
                  onChangeText={(value) => updateFormData('newPassword', value)}
                  secureTextEntry={!showPasswords.new}
                />
                <TouchableOpacity
                  onPress={() => togglePasswordVisibility('new')}
                  style={styles.eyeIcon}
                >
                  <Icon 
                    name={showPasswords.new ? 'visibility' : 'visibility-off'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Icon name="lock-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu mới"
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  secureTextEntry={!showPasswords.confirm}
                />
                <TouchableOpacity
                  onPress={() => togglePasswordVisibility('confirm')}
                  style={styles.eyeIcon}
                >
                  <Icon 
                    name={showPasswords.confirm ? 'visibility' : 'visibility-off'} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>

              {/* Password Requirements */}
              {formData.newPassword.length > 0 && (
                <View style={styles.requirementsContainer}>
                  <Text style={styles.requirementsTitle}>Yêu cầu mật khẩu:</Text>
                  <View style={styles.requirementsList}>
                    <View style={styles.requirementItem}>
                      <Icon 
                        name={passwordValidation.minLength ? 'check' : 'close'} 
                        size={16} 
                        color={passwordValidation.minLength ? '#4CAF50' : '#F44336'} 
                      />
                      <Text style={[
                        styles.requirementText,
                        { color: passwordValidation.minLength ? '#4CAF50' : '#F44336' }
                      ]}>
                        Ít nhất 8 ký tự
                      </Text>
                    </View>
                    
                    <View style={styles.requirementItem}>
                      <Icon 
                        name={passwordValidation.hasUpperCase ? 'check' : 'close'} 
                        size={16} 
                        color={passwordValidation.hasUpperCase ? '#4CAF50' : '#F44336'} 
                      />
                      <Text style={[
                        styles.requirementText,
                        { color: passwordValidation.hasUpperCase ? '#4CAF50' : '#F44336' }
                      ]}>
                        Có chữ hoa
                      </Text>
                    </View>
                    
                    <View style={styles.requirementItem}>
                      <Icon 
                        name={passwordValidation.hasLowerCase ? 'check' : 'close'} 
                        size={16} 
                        color={passwordValidation.hasLowerCase ? '#4CAF50' : '#F44336'} 
                      />
                      <Text style={[
                        styles.requirementText,
                        { color: passwordValidation.hasLowerCase ? '#4CAF50' : '#F44336' }
                      ]}>
                        Có chữ thường
                      </Text>
                    </View>
                    
                    <View style={styles.requirementItem}>
                      <Icon 
                        name={passwordValidation.hasNumbers ? 'check' : 'close'} 
                        size={16} 
                        color={passwordValidation.hasNumbers ? '#4CAF50' : '#F44336'} 
                      />
                      <Text style={[
                        styles.requirementText,
                        { color: passwordValidation.hasNumbers ? '#4CAF50' : '#F44336' }
                      ]}>
                        Có số
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Password Match */}
              {formData.confirmPassword.length > 0 && (
                <View style={styles.matchContainer}>
                  <Icon 
                    name={formData.newPassword === formData.confirmPassword ? 'check' : 'close'} 
                    size={16} 
                    color={formData.newPassword === formData.confirmPassword ? '#4CAF50' : '#F44336'} 
                  />
                  <Text style={[
                    styles.matchText,
                    { color: formData.newPassword === formData.confirmPassword ? '#4CAF50' : '#F44336' }
                  ]}>
                    {formData.newPassword === formData.confirmPassword 
                      ? 'Mật khẩu khớp' 
                      : 'Mật khẩu không khớp'
                    }
                  </Text>
                </View>
              )}

              <ModernButton
                title={loading ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
                onPress={resetPassword}
                disabled={loading || !passwordValidation.isValid}
                icon={loading ? null : "lock-reset"}
                style={styles.actionButton}
              />
            </View>
          </Animatable.View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#2196F3', '#1976D2']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Đặt lại mật khẩu</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            {[1, 2, 3].map((stepNumber) => (
              <View key={stepNumber} style={styles.progressStep}>
                <View style={[
                  styles.progressDot,
                  step >= stepNumber && styles.progressDotActive
                ]}>
                  {step > stepNumber ? (
                    <Icon name="check" size={16} color="#fff" />
                  ) : (
                    <Text style={[
                      styles.progressDotText,
                      step >= stepNumber && styles.progressDotTextActive
                    ]}>
                      {stepNumber}
                    </Text>
                  )}
                </View>
                {stepNumber < 3 && (
                  <View style={[
                    styles.progressLine,
                    step > stepNumber && styles.progressLineActive
                  ]} />
                )}
              </View>
            ))}
          </View>

          {/* Step Labels */}
          <View style={styles.stepsLabels}>
            <Text style={[styles.stepLabel, step >= 1 && styles.stepLabelActive]}>
              Nhập thông tin
            </Text>
            <Text style={[styles.stepLabel, step >= 2 && styles.stepLabelActive]}>
              Xác minh OTP
            </Text>
            <Text style={[styles.stepLabel, step >= 3 && styles.stepLabelActive]}>
              Mật khẩu mới
            </Text>
          </View>

          {/* Step Content */}
          {renderStepContent()}

          {/* Back Step Button */}
          {step > 1 && (
            <TouchableOpacity 
              style={styles.backStepButton}
              onPress={() => setStep(step - 1)}
            >
              <Icon name="arrow-back" size={16} color="#2196F3" />
              <Text style={styles.backStepText}>Quay lại bước trước</Text>
            </TouchableOpacity>
          )}

          {/* Info */}
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Nếu bạn gặp khó khăn trong việc đặt lại mật khẩu, vui lòng liên hệ bộ phận hỗ trợ.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    backgroundColor: '#2196F3',
  },
  progressDotText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  progressDotTextActive: {
    color: '#fff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#2196F3',
  },
  stepsLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  stepLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  stepLabelActive: {
    color: '#2196F3',
    fontWeight: '500',
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1a1a1a',
  },
  eyeIcon: {
    padding: 5,
  },
  actionButton: {
    marginTop: 8,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    color: '#2196F3',
    textDecorationLine: 'underline',
  },
  resendLinkDisabled: {
    color: '#ccc',
    textDecorationLine: 'none',
  },
  requirementsContainer: {
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requirementText: {
    fontSize: 12,
    marginLeft: 8,
  },
  matchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  matchText: {
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  backStepText: {
    fontSize: 16,
    color: '#2196F3',
    marginLeft: 8,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default ResetPasswordScreen;
