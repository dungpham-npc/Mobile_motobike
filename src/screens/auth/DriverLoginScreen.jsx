import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import GlassButton from '../../components/ui/GlassButton.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { colors } from '../../theme/designTokens';

const DriverLoginScreen = ({ navigation, route }) => {
  // Pre-fill email if coming from registration
  const prefillEmail = route?.params?.prefillEmail || '';
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Update email when route params change
  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    // Show success message if email was just verified
    if (route?.params?.verifiedEmail) {
      Alert.alert(
        'Xác minh thành công!',
        'Email của bạn đã được xác minh. Bây giờ bạn có thể đăng nhập.',
        [{ text: 'OK' }]
      );
    }
  }, [prefillEmail, route?.params?.verifiedEmail]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.login(email, password, 'driver');
      if (result.success) {
        // After email verification, user should have profile and can login
        // Phone verification is separate and not required for login
        navigation.replace('DriverMain');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      // Check for email verification pending - auto navigate to OTP screen
      if (error.message?.includes("Email verification is pending") || 
          error.data?.error?.id === "auth.unauthorized.email-verification-pending" ||
          error.message?.includes("email-verification-pending") ||
          error.data?.error?.id === "user.validation.profile-not-exists") {
        // Automatically navigate to OTP verification screen for email verification
        navigation.navigate('OTPVerification', {
          email: email,
          purpose: 'VERIFY_EMAIL',
          fromLogin: true, // Flag to indicate coming from login
        });
        return;
      }
      
      let errorMessage = 'Đã có lỗi xảy ra';
      if (error instanceof ApiError) {
        // Handle session expired from auto token refresh
        if (error.data?.requiresLogin) {
          errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else {
          switch (error.status) {
            case 401:
              errorMessage = 'Email hoặc mật khẩu không chính xác'; 
              break;
            case 400:
              errorMessage = error.message || 'Thông tin không hợp lệ'; 
              break;
            case 0:
              errorMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.'; 
              break;
            default:
              errorMessage = error.message || errorMessage;
          }
        }
      }
      Alert.alert('Đăng nhập thất bại', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
        >
          <View style={styles.inner}>
            <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
              <View style={styles.hero}>
                <Image
                  source={require('../../../assets/login_image.png')}
                  style={styles.illustration}
                  resizeMode="contain"
                />
                <Text style={styles.welcome}>Chào mừng tài xế</Text>
                <Text style={styles.subtitle}>Đăng nhập để bắt đầu nhận chuyến</Text>
              </View>
            </Animatable.View>

            <CleanCard style={styles.formCard} contentStyle={styles.formContent}>
              <View style={styles.inputWrap}>
                <Icon name="email" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập email"
                  placeholderTextColor="rgba(148,163,184,0.9)"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputWrap}>
                <Icon name="lock" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập mật khẩu"
                  placeholderTextColor="rgba(148,163,184,0.9)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
                  <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.forgotPassword} onPress={() => navigation.navigate('ResetPassword')}>
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              <GlassButton 
                title={loading ? 'Đang đăng nhập...' : 'Đăng nhập'} 
                onPress={handleLogin} 
                style={styles.signInButton}
              />
            </CleanCard>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register', { defaultProfile: 'driver' })}>
                <Text style={styles.registerLink}>Đăng ký</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.switchProfile}>
              <Text style={styles.switchProfileText}>Bạn là hành khách?</Text>
              <TouchableOpacity onPress={() => navigation.replace('Login')}>
                <Text style={styles.switchProfileLink}>Đăng nhập với tư cách Rider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  kav: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  illustration: {
    width: '70%',
    height: 200,
    marginBottom: 12,
  },
  welcome: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    marginTop: 8,
  },
  formContent: {
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassLight,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    height: 54,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  eye: { padding: 6 },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 18,
  },
  forgotPasswordText: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  signInButton: {
    marginTop: 8,
  },
  footer: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { 
    color: colors.textSecondary, 
    fontSize: 14, 
    fontFamily: 'Inter_400Regular' 
  },
  registerLink: { 
    color: colors.accent, 
    fontSize: 14, 
    fontFamily: 'Inter_700Bold', 
    marginLeft: 6 
  },
  switchProfile: {
    marginTop: 24,
    alignItems: 'center',
    gap: 8,
  },
  switchProfileText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  switchProfileLink: {
    color: colors.accent,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
  },
});

export default DriverLoginScreen;

