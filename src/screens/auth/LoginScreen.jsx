import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, Image, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FontAwesome } from '@expo/vector-icons'; // icon cho Google/Facebook
import * as Animatable from 'react-native-animatable';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import GlassButton from '../../components/ui/GlassButton.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { colors } from '../../theme/designTokens';

const LoginScreen = ({ navigation, route }) => {
  // Pre-fill email if coming from registration
  const prefillEmail = route?.params?.prefillEmail || '';
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [targetProfile, setTargetProfile] = useState('rider'); // Default to rider
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
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

  // Clear email error when user starts typing
  const handleEmailChange = (text) => {
    setEmail(text);
    if (emailError) {
      setEmailError('');
    }
  };
  
  // Clear password error when user starts typing
  const handlePasswordChange = (text) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError('');
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    let hasError = false;

    if (!trimmedEmail) {
      setEmailError('Vui lòng nhập email');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    // Clear previous errors
    setEmailError('');
    setPasswordError('');

    setLoading(true);
    try {
      const result = await authService.login(trimmedEmail, password, targetProfile);
      if (result.success) {
        const userProfile = result.user;
        const verification = userProfile?.verification;
        const campusVerified =
          verification?.is_campus_verified === true ||
          verification?.campus_verified === true;
        const studentStatus = verification?.student?.status;
        const rejectionReason = verification?.student?.rejection_reason || verification?.student?.rejectionReason;
        const driverStatus =
          verification?.driver_profile_status ||
          verification?.driverProfileStatus ||
          result.user?.driver_profile?.status ||
          result.user?.driverProfile?.status;
        const hasDriverProfile =
          !!driverStatus ||
          (result.user?.available_profiles || []).some(p => p?.toUpperCase?.() === 'DRIVER') ||
          !!result.user?.driver_profile ||
          !!result.user?.driverProfile;
        const wantsDriver = targetProfile === 'driver';

        // Driver login: if user already has a driver profile, bypass campus guard
        if (wantsDriver && hasDriverProfile) {
          navigation.replace('DriverMain');
          return;
        }

        // If not verified yet, push to student verification guard
        if (!campusVerified) {
          navigation.replace('StudentVerification', {
            guardMode: true,
            studentStatus,
            rejectionReason,
          });
          return;
        }

        // If user selects driver login but doesn't have driver profile, block navigation
        if (targetProfile === 'driver') {
          const hasDriverProfile =
            !!userProfile?.driver_profile ||
            !!userProfile?.driverProfile ||
            Array.isArray(userProfile?.availableProfiles) &&
              userProfile.availableProfiles.includes('driver');

          if (!hasDriverProfile) {
            Alert.alert(
              'Chưa đăng ký tài khoản tài xế',
              'Tài khoản của bạn hiện chỉ có hồ sơ hành khách. Vui lòng sử dụng chế độ hành khách hoặc hoàn tất đăng ký tài khoản tài xế trước khi đăng nhập với tư cách tài xế.'
            );
            return; // Stay on Login screen
          }
        }

        // After email + campus verification and role checks, continue to main flows
        navigation.replace(targetProfile === 'driver' ? 'DriverMain' : 'Main');
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
          email: trimmedEmail,
          purpose: 'VERIFY_EMAIL',
          fromLogin: true, // Flag to indicate coming from login
        });
        return;
      }
      
      // Check if error is "user not found" - show inline error instead of Alert
      const errorMessage = error.message || '';
      const isUserNotFound = errorMessage.includes('Không tìm thấy người dùng') || 
                            errorMessage.includes('không tìm thấy người dùng') ||
                            errorMessage.includes('User not found') ||
                            errorMessage.includes('user not found') ||
                            (error instanceof ApiError && error.status === 404);
      
      if (isUserNotFound) {
        setEmailError('Tên tài khoản không tồn tại');
        setLoading(false);
        return;
      }
      
      const isWrongPassword = (error instanceof ApiError && error.status === 401) ||
                              errorMessage.includes('mật khẩu') ||
                              errorMessage.toLowerCase().includes('password');
      if (isWrongPassword) {
        setPasswordError('Mật khẩu không chính xác');
        setLoading(false);
        return;
      }
      
      // For other errors, show Alert as before
      let displayMessage = 'Đã có lỗi xảy ra';
      if (error instanceof ApiError) {
        // Handle session expired from auto token refresh
        if (error.data?.requiresLogin) {
          displayMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else {
          switch (error.status) {
            case 401:
              displayMessage = 'Email hoặc mật khẩu không chính xác'; 
              break;
            case 400:
              displayMessage = error.message || 'Thông tin không hợp lệ'; 
              break;
            case 0:
              displayMessage = 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.'; 
              break;
            default:
              displayMessage = error.message || displayMessage;
          }
        }
      }
      Alert.alert('Đăng nhập thất bại', displayMessage);
    } finally {
      setLoading(false);
    }
  };

  // Stub – chỉ UI
  const handleLoginGoogle = () => Alert.alert('Google', 'Login with Google (UI only)');
  const handleLoginFacebook = () => Alert.alert('Facebook', 'Login with Facebook (UI only)');

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
                <Text style={styles.welcome}>Chào mừng trở lại</Text>
              </View>
            </Animatable.View>

            <CleanCard style={styles.formCard} contentStyle={styles.formContent}>
              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputWrap,
                  emailError && styles.inputWrapError
                ]}>
                  <Icon 
                    name="email" 
                    size={20} 
                    color={emailError ? '#EF4444' : colors.textSecondary} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập email"
                    placeholderTextColor="rgba(148,163,184,0.9)"
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                  />
                </View>
                <Text style={[styles.errorText, !emailError && styles.errorTextHidden]}>
                  {emailError || 'placeholder'}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <View style={[
                  styles.inputWrap,
                  passwordError && styles.inputWrapError
                ]}>
                  <Icon 
                    name="lock" 
                    size={20} 
                    color={passwordError ? '#EF4444' : colors.textSecondary} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="rgba(148,163,184,0.9)"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
                    <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={passwordError ? '#EF4444' : colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.errorText, !passwordError && styles.errorTextHidden]}>
                  {passwordError || 'placeholder'}
                </Text>
              </View>

              <View style={styles.profileSelector}>
                <Text style={styles.profileLabel}>Đăng nhập với tư cách</Text>
                <View style={styles.profileButtons}>
                  <TouchableOpacity
                    style={[
                      styles.profileButton,
                      targetProfile === 'rider' && styles.profileButtonActive
                    ]}
                    onPress={() => setTargetProfile('rider')}
                  >
                    <Icon 
                      name="person" 
                      size={18} 
                      color={targetProfile === 'rider' ? '#FFFFFF' : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.profileButtonText,
                      targetProfile === 'rider' && styles.profileButtonTextActive
                    ]}>
                      Hành khách
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.profileButton,
                      styles.profileButtonLast,
                      targetProfile === 'driver' && styles.profileButtonActive
                    ]}
                    onPress={() => setTargetProfile('driver')}
                  >
                    <Icon 
                      name="two-wheeler" 
                      size={18} 
                      color={targetProfile === 'driver' ? '#FFFFFF' : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.profileButtonText,
                      targetProfile === 'driver' && styles.profileButtonTextActive
                    ]}>
                      Tài xế
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotPassword} onPress={() => navigation.navigate('ResetPassword')}>
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>

              <GlassButton title={loading ? '...' : 'Đăng nhập'} onPress={handleLogin} style={styles.signInButton} />
            </CleanCard>

          <View style={styles.footer}>
              <Text style={styles.footerText}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Đăng ký</Text>
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
  },
  subtitle: {
    marginTop: 8,
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
  fieldGroup: {
    marginBottom: 10,
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
  },
  inputWrapError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginLeft: 16,
    marginTop: 3,
    minHeight: 12,
  },
  errorTextHidden: {
    opacity: 0,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  eye: { padding: 6 },
  profileSelector: {
    marginTop: 6,
    marginBottom: 18,
  },
  profileLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  profileButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  profileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glassLight,
    marginRight: 12,
    gap: 8,
  },
  profileButtonLast: {
    marginRight: 0,
  },
  profileButtonActive: {
    backgroundColor: colors.accent,
    borderColor: 'rgba(14,165,233,0.45)',
  },
  profileButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
  profileButtonTextActive: {
    color: '#FFFFFF',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  signInButton: {
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  socialBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glassLight,
  },
  socialIcon: { marginRight: 8 },
  socialText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  socialText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    marginTop: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { color: colors.textSecondary, fontSize: 14, fontFamily: 'Inter_400Regular' },
  registerLink: { color: colors.accent, fontSize: 14, fontFamily: 'Inter_700Bold', marginLeft: 6 },
});

export default LoginScreen;
