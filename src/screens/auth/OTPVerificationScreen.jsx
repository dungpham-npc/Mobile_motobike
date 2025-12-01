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
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import * as Animatable from 'react-native-animatable';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const OTPVerificationScreen = ({ navigation, route }) => {
  const { email, purpose = 'VERIFY_EMAIL' } = route.params || {};
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  
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
      setError('');
      await authService.requestOtp(purpose, email);
      setCountdown(60); // Reset countdown
    } catch (error) {
      console.error('Request OTP error:', error);
      setError('Không thể gửi mã OTP. Vui lòng thử lại.');
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (value, index) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      setError(''); // Clear error when user types

      // Auto focus next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (key, index) => {
    if (key !== 'Backspace') return;

    setError('');

    if (otp[index]) {
      // Clear current digit
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      return;
    }

    if (index > 0) {
      // Move focus back and clear previous digit
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const verifyOTP = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Vui lòng nhập đầy đủ mã OTP');
      return;
    }

    setLoading(true);
    setError('');

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
                verifiedEmail: true,
                prefillEmail: email 
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
      
      setError(errorMessage);
      
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
    setError('');
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
      
      setError(errorMessage);
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

  const safeGoBack = () => navigation?.goBack?.();

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title=""
          subtitle=""
          onBackPress={safeGoBack}
        />

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
          >
            {/* Hero Card */}
            <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
              <CleanCard contentStyle={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Feather name="mail" size={24} color={colors.accent} />
                </View>
                <View style={{ gap: 6 }}>
                  <Text style={styles.heroTitle}>Xác minh OTP</Text>
                  <Text style={styles.heroSubtitle}>
                    Chúng tôi đã gửi mã OTP 6 số để {getPurposeText()} đến
                  </Text>
                  <Text style={styles.heroEmail}>{email}</Text>
                </View>
              </CleanCard>
            </Animatable.View>

            {/* OTP Input Card */}
            <Animatable.View animation="fadeInUp" delay={200} duration={500} useNativeDriver>
              <CleanCard contentStyle={styles.otpCard}>
                <Text style={styles.otpLabel}>Nhập mã xác minh</Text>
                <View style={styles.otpInputContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => inputRefs.current[index] = ref}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        error && styles.otpInputError
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
                {error && (
                  <Text style={styles.errorText}>{error}</Text>
                )}
              </CleanCard>
            </Animatable.View>

            {/* Verify Button */}
            <Animatable.View animation="fadeInUp" delay={400} duration={500} useNativeDriver>
              <ModernButton
                title={loading ? 'Đang xác minh...' : 'Xác minh'}
                onPress={verifyOTP}
                disabled={loading || otp.join('').length !== 6}
                icon={loading ? null : 'check-circle'}
                style={styles.verifyButton}
              />
            </Animatable.View>

            {/* Resend OTP Card */}
            <Animatable.View animation="fadeInUp" delay={600} duration={500} useNativeDriver>
              <CleanCard contentStyle={styles.resendCard}>
                <Text style={styles.resendText}>Không nhận được mã?</Text>
                
                {countdown > 0 ? (
                  <View style={styles.countdownContainer}>
                    <Feather name="clock" size={16} color={colors.textSecondary} />
                    <Text style={styles.countdownText}>
                      Gửi lại sau {countdown}s
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity 
                    onPress={resendOTP}
                    disabled={resending}
                    style={styles.resendButton}
                  >
                    {resending ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <>
                        <Feather name="refresh-cw" size={16} color={colors.accent} />
                        <Text style={styles.resendButtonText}>Gửi lại mã OTP</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </CleanCard>
            </Animatable.View>

            {/* Help Card */}
            <Animatable.View animation="fadeInUp" delay={800} duration={500} useNativeDriver>
              <CleanCard variant="accent" contentStyle={styles.helpCard}>
                <Feather name="info" size={18} color={colors.accent} />
                <Text style={styles.helpText}>
                  Kiểm tra thư mục spam nếu không thấy email
                </Text>
              </CleanCard>
            </Animatable.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  heroEmail: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 4,
  },
  otpCard: {
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 20,
  },
  otpLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  otpInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 60,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    backgroundColor: colors.glassLight,
  },
  otpInputFilled: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  otpInputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  verifyButton: {
    marginTop: 8,
  },
  resendCard: {
    paddingVertical: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 12,
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownText: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

export default OTPVerificationScreen;
