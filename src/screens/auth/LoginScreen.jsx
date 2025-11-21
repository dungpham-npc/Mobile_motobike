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
      const result = await authService.login(email, password, targetProfile);
      if (result.success) {
        // After email verification, user should have profile and can login
        // Phone verification is separate and not required for login
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
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eye}>
                  <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
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
                      Rider
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
                      name="directions-car" 
                      size={18} 
                      color={targetProfile === 'driver' ? '#FFFFFF' : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.profileButtonText,
                      targetProfile === 'driver' && styles.profileButtonTextActive
                    ]}>
                      Driver
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
