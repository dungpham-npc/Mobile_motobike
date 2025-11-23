import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';

const OTPVerificationScreen = ({ navigation, route }) => {
  const { email, purpose = 'VERIFY_EMAIL' } = route.params || {};
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  
  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto request OTP when screen loads
    requestOTP();
    
    // Start countdown
    setCountdown(60);
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const requestOTP = async () => {
    try {
      setResending(true);
      await authService.requestOtp(purpose, email);
      setCountdown(60); // Reset countdown
    } catch (error) {
      console.error('Request OTP error:', error);
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (value, index) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Auto focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOTP = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mã OTP');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.verifyOtp(otpCode, purpose, email);
      
      Alert.alert(
        'Xác minh thành công!',
        'Email của bạn đã được xác minh. Bạn có thể đăng nhập ngay bây giờ.',
        [
          { 
            text: 'Đăng nhập', 
            onPress: () => {
              // Navigate back to login and try auto login
              navigation.navigate('Login', { 
                emailVerified: true,
                email: email 
              });
            }
          }
        ]
      );
    } catch (error) {
      console.error('Verify OTP error:', error);
      
      let errorMessage = 'Mã OTP không chính xác';
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = 'Mã OTP không hợp lệ hoặc đã hết hạn';
            break;
          case 404:
            errorMessage = 'Không tìm thấy mã OTP. Vui lòng yêu cầu mã mới';
            break;
          case 429:
            errorMessage = 'Quá nhiều lần thử. Vui lòng đợi một lúc';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      Alert.alert('Xác minh thất bại', errorMessage);
      
      // Clear OTP inputs on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (countdown > 0) return;
    
    setResending(true);
    try {
      await authService.requestOtp(purpose, email);
      
      Alert.alert(
        'Đã gửi lại mã OTP',
        'Vui lòng kiểm tra email và nhập mã OTP mới'
      );
      
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Resend OTP error:', error);
      
      let errorMessage = 'Không thể gửi lại mã OTP';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setResending(false);
    }
  };

  const getPurposeText = () => {
    switch (purpose) {
      case 'VERIFY_EMAIL':
        return 'xác minh email';
      case 'password_reset':
        return 'đặt lại mật khẩu';
      default:
        return 'xác minh';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        {/* Header */}
        <LinearGradient
          colors={['#4CAF50', '#2E7D32']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Xác minh OTP</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Instructions */}
          <Animatable.View animation="fadeInUp" style={styles.instructionsContainer}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.iconGradient}
              >
                <Icon name="email" size={48} color="#fff" />
              </LinearGradient>
            </View>
            
            <Text style={styles.title}>Nhập mã xác minh</Text>
            <Text style={styles.subtitle}>
              Chúng tôi đã gửi mã OTP 6 số để {getPurposeText()} đến
            </Text>
            <Text style={styles.email}>{email}</Text>
          </Animatable.View>

          {/* OTP Input */}
          <Animatable.View animation="fadeInUp" delay={200} style={styles.otpContainer}>
            <View style={styles.otpInputContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={ref => inputRefs.current[index] = ref}
                  style={[
                    styles.otpInput,
                    digit && styles.otpInputFilled
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>
          </Animatable.View>

          {/* Verify Button */}
          <Animatable.View animation="fadeInUp" delay={400}>
            <ModernButton
              title={loading ? "Đang xác minh..." : "Xác minh"}
              onPress={verifyOTP}
              disabled={loading || otp.join('').length !== 6}
              icon={loading ? null : "verified-user"}
              style={styles.verifyButton}
            />
          </Animatable.View>

          {/* Resend OTP */}
          <Animatable.View animation="fadeInUp" delay={600} style={styles.resendContainer}>
            <Text style={styles.resendText}>Không nhận được mã?</Text>
            
            {countdown > 0 ? (
              <Text style={styles.countdownText}>
                Gửi lại sau {countdown}s
              </Text>
            ) : (
              <TouchableOpacity 
                onPress={resendOTP}
                disabled={resending}
                style={styles.resendButton}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#4CAF50" />
                ) : (
                  <Text style={styles.resendButtonText}>Gửi lại mã OTP</Text>
                )}
              </TouchableOpacity>
            )}
          </Animatable.View>

          {/* Help */}
          <View style={styles.helpContainer}>
            <Icon name="help-outline" size={16} color="#666" />
            <Text style={styles.helpText}>
              Kiểm tra thư mục spam nếu không thấy email
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
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
    justifyContent: 'center',
  },
  instructionsContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
  },
  otpContainer: {
    marginBottom: 32,
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  otpInputFilled: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  verifyButton: {
    marginBottom: 24,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
  },
  helpText: {
    fontSize: 12,
    color: '#1565C0',
    marginLeft: 8,
    textAlign: 'center',
    flex: 1,
  },
});

export default OTPVerificationScreen;
