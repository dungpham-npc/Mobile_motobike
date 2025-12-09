import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';
import ModernButton from '../../components/ModernButton.jsx';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

// Helper function to translate English error messages to Vietnamese
const translateErrorMessage = (message) => {
  if (!message) return message;
  
  const msg = message.toLowerCase();
  
  // Password validation errors - check most specific first
  // Match: "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character"
  if ((msg.includes('password must contain') && msg.includes('uppercase') && msg.includes('lowercase') && msg.includes('digit') && msg.includes('special')) ||
      msg.includes('password must contain at least one uppercase letter')) {
    return 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt';
  }
  // Match any password validation that mentions uppercase, lowercase, digit, special
  if (msg.includes('password') && msg.includes('uppercase') && msg.includes('lowercase') && msg.includes('digit') && msg.includes('special')) {
    return 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt';
  }
  if (msg.includes('password must be between 8 and 100')) {
    return 'Mật khẩu phải từ 8 đến 100 ký tự';
  }
  if (msg.includes('password must contain')) {
    return 'Mật khẩu phải chứa ít nhất một chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt';
  }
  if (msg.includes('password') && (msg.includes('required') || msg.includes('invalid'))) {
    return 'Mật khẩu không hợp lệ';
  }
  
  // Full name validation errors
  if (msg.includes('full name is required')) {
    return 'Vui lòng nhập họ và tên';
  }
  if (msg.includes('full name must be between 2 and 100')) {
    return 'Họ và tên phải từ 2 đến 100 ký tự';
  }
  if (msg.includes('full name can only contain')) {
    return 'Họ và tên chỉ được chứa chữ cái, khoảng trắng, dấu gạch ngang và ký tự tiếng Việt';
  }
  if (msg.includes('full name')) {
    return message.replace(/full name/gi, 'Họ và tên').replace(/is required/gi, 'là bắt buộc');
  }
  
  // Email validation errors
  if (msg.includes('email is required')) {
    return 'Vui lòng nhập email';
  }
  if (msg.includes('email must be valid') || (msg.includes('email') && msg.includes('valid'))) {
    return 'Email không hợp lệ';
  }
  if (msg.includes('email already exists') || msg.includes('email đã tồn tại')) {
    return 'Email đã được sử dụng';
  }
  
  // Phone validation errors
  if (msg.includes('phone is required')) {
    return 'Vui lòng nhập số điện thoại';
  }
  if (msg.includes('phone number must be valid') || (msg.includes('phone') && msg.includes('valid'))) {
    return 'Số điện thoại không hợp lệ (định dạng Việt Nam)';
  }
  if (msg.includes('phone already exists') || msg.includes('số điện thoại đã tồn tại')) {
    return 'Số điện thoại đã được sử dụng';
  }
  
  // Generic validation errors - more patterns
  if (msg.includes('validation failed')) {
    return 'Thông tin không hợp lệ. Vui lòng kiểm tra lại các trường đã nhập';
  }
  if (msg.includes('is required')) {
    const field = message.match(/^(.+?)\s+is required/i)?.[1] || '';
    if (field) {
      return `${field} là bắt buộc`;
    }
    return message.replace(/is required/gi, 'là bắt buộc');
  }
  if (msg.includes('must be between')) {
    const match = message.match(/must be between (\d+) and (\d+) characters?/i);
    if (match) {
      return `Phải từ ${match[1]} đến ${match[2]} ký tự`;
    }
    return message.replace(/must be between/gi, 'phải từ').replace(/and/gi, 'đến').replace(/characters?/gi, 'ký tự');
  }
  if (msg.includes('must be valid')) {
    return message.replace(/must be valid/gi, 'không hợp lệ');
  }
  if (msg.includes('must contain')) {
    return message.replace(/must contain/gi, 'phải chứa');
  }
  
  return message;
};

const RegisterScreen = (props) => {
  const navigation = props?.navigation;
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const safeGoBack = () => navigation?.goBack?.();
  const navigateToLogin = () => navigation?.navigate?.('Login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    
    if (field === 'password') {
      const checks = {
        length: value.length >= 8,
        lowercase: /[a-z]/.test(value),
        uppercase: /[A-Z]/.test(value),
        number: /\d/.test(value),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      };
      setPasswordChecks(checks);
      setPasswordStrength(Object.values(checks).filter(Boolean).length);
    }
  };

  const validate = () => {
    const { name, email, phone, password, confirmPassword } = formData;
    const newErrors = {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    };
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập họ và tên';
      isValid = false;
    }
    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
      isValid = false;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Email không hợp lệ';
      isValid = false;
    }
    if (!phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
      isValid = false;
    } else if (!/^[0-9]{9,11}$/.test(phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ (9-11 chữ số)';
      isValid = false;
    }
    if (!password.trim()) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
      isValid = false;
    } else if (passwordStrength < 5) {
      newErrors.password = 'Mật khẩu chưa đủ mạnh. Vui lòng đáp ứng tất cả điều kiện';
      isValid = false;
    }
    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    // Clear previous errors
    const frontendErrors = {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    };

    // Run frontend validation first
    const { name, email, phone, password, confirmPassword } = formData;
    let hasFrontendErrors = false;

    if (!name.trim()) {
      frontendErrors.name = 'Vui lòng nhập họ và tên';
      hasFrontendErrors = true;
    } else {
      const trimmedName = name.trim();
      if (trimmedName.length < 2) {
        frontendErrors.name = 'Họ và tên phải có ít nhất 2 ký tự';
        hasFrontendErrors = true;
      } else if (trimmedName.length > 100) {
        frontendErrors.name = 'Họ và tên không được vượt quá 100 ký tự';
        hasFrontendErrors = true;
      } else if (!/^[a-zA-ZàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ\s'-]+$/.test(trimmedName)) {
        frontendErrors.name = 'Họ và tên chỉ được chứa chữ cái, khoảng trắng, dấu gạch ngang và ký tự tiếng Việt';
        hasFrontendErrors = true;
      }
    }
    if (!email.trim()) {
      frontendErrors.email = 'Vui lòng nhập email';
      hasFrontendErrors = true;
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      frontendErrors.email = 'Email không hợp lệ';
      hasFrontendErrors = true;
    }
    if (!phone.trim()) {
      frontendErrors.phone = 'Vui lòng nhập số điện thoại';
      hasFrontendErrors = true;
    } else if (!/^[0-9]{9,11}$/.test(phone)) {
      frontendErrors.phone = 'Số điện thoại không hợp lệ (9-11 chữ số)';
      hasFrontendErrors = true;
    }
    if (!password.trim()) {
      frontendErrors.password = 'Vui lòng nhập mật khẩu';
      hasFrontendErrors = true;
    } else if (passwordStrength < 5) {
      frontendErrors.password = 'Mật khẩu chưa đủ mạnh. Vui lòng đáp ứng tất cả điều kiện';
      hasFrontendErrors = true;
    }
    if (!confirmPassword.trim()) {
      frontendErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
      hasFrontendErrors = true;
    } else if (password !== confirmPassword) {
      frontendErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      hasFrontendErrors = true;
    }

    // Set frontend errors first
    setErrors(frontendErrors);

    // If there are critical frontend errors (empty or format), don't call API
    // But if only password-related errors, still call API to get email/phone conflicts
    const hasCriticalErrors = !name.trim() || !email.trim() || !phone.trim() || 
                              !/^\S+@\S+\.\S+$/.test(email) || !/^[0-9]{9,11}$/.test(phone);
    
    if (hasCriticalErrors) {
      return;
    }

    // Call API even if there are password errors, to get all backend errors
    try {
      setLoading(true);
      await authService.register({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      // After registration success, direct user to email OTP first, then verification
      Alert.alert(
        'Đăng ký thành công!',
        'Vui lòng xác minh email trước, sau đó gửi giấy tờ sinh viên để dùng ứng dụng.',
        [
          {
            text: 'Xác minh email',
            onPress: () => navigation.replace('OTPVerification', {
              email: formData.email,
              purpose: 'VERIFY_EMAIL',
              fromLogin: false,
            })
          }
        ]
      );
    } catch (err) {
      console.error('Register error:', err);
      
      // Merge backend errors with frontend errors (don't replace)
      const mergedErrors = { ...frontendErrors };
      
      if (err instanceof ApiError) {
        // Check error.id from backend (structured error response)
        const errorId = err.data?.error?.id || '';
        const rawErrorMessage = err.data?.error?.message || err.message || '';
        // Translate error message to Vietnamese
        const errorMessage = translateErrorMessage(rawErrorMessage);
        const messageText = errorMessage.toLowerCase();
        const fieldErrors = err.data?.field_errors || err.data?.fieldErrors || {};
        
        console.log('API Error details:', { errorId, rawErrorMessage, translatedMessage: errorMessage, status: err.status, data: err.data, fieldErrors });
        
        // Handle field-specific errors from backend (field_errors)
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          if (fieldErrors.fullName || fieldErrors.full_name) {
            mergedErrors.name = translateErrorMessage(fieldErrors.fullName || fieldErrors.full_name);
          }
          if (fieldErrors.email) {
            mergedErrors.email = translateErrorMessage(fieldErrors.email);
          }
          if (fieldErrors.phone) {
            mergedErrors.phone = translateErrorMessage(fieldErrors.phone);
          }
          if (fieldErrors.password) {
            mergedErrors.password = translateErrorMessage(fieldErrors.password);
          }
        }
        
        // Check if it's phone conflict error FIRST (priority)
        if (errorId === 'user.conflict.phone-exists') {
          mergedErrors.phone = errorMessage || 'Số điện thoại đã được sử dụng';
        } else if (err.status === 409 && (
            messageText.includes('số điện thoại đã tồn tại') ||
            messageText.includes('số điện thoại đã được đăng ký') ||
            messageText.includes('phone already exists') ||
            messageText.includes('phone đã tồn tại') ||
            messageText.includes('số điện thoại'))) {
          mergedErrors.phone = errorMessage || 'Số điện thoại đã được sử dụng';
        }
        
        // Check if it's email conflict error
        if (errorId === 'user.conflict.email-exists') {
          mergedErrors.email = errorMessage || 'Email đã được sử dụng';
        } else if (err.status === 409 && !mergedErrors.phone && (
            messageText.includes('email đã tồn tại') || 
            messageText.includes('email already exists') ||
            messageText.includes('email đã được sử dụng') ||
            messageText.includes('email đã được đăng ký') ||
            messageText.includes('email đang chờ xác thực'))) {
          mergedErrors.email = errorMessage || 'Email đã được sử dụng';
        }
        
        // Handle other API errors
        if (err.status === 400) {
          // Bad request - might be validation error from backend
          const backendMessage = translateErrorMessage(errorMessage);
          const backendMsgLower = backendMessage.toLowerCase();
          
          if (backendMsgLower.includes('full name') || backendMsgLower.includes('họ và tên') ||
              (backendMsgLower.includes('name') && (backendMsgLower.includes('required') || backendMsgLower.includes('between') || backendMsgLower.includes('contain')))) {
            mergedErrors.name = backendMessage;
          } else if (backendMsgLower.includes('email')) {
            mergedErrors.email = backendMessage;
          } else if (backendMsgLower.includes('phone') || backendMsgLower.includes('số điện thoại')) {
            mergedErrors.phone = backendMessage;
          } else if (backendMsgLower.includes('password') || backendMsgLower.includes('mật khẩu')) {
            mergedErrors.password = backendMessage;
          } else {
            // Only show alert if no field-specific error
            if (!mergedErrors.name && !mergedErrors.email && !mergedErrors.phone && !mergedErrors.password) {
              Alert.alert('Đăng ký thất bại', backendMessage || 'Thông tin không hợp lệ');
            }
          }
        } else if (err.status === 409) {
          // Handle 409 conflict errors - only if not already set above
          if (!mergedErrors.phone && (messageText.includes('phone') || messageText.includes('số điện thoại'))) {
            mergedErrors.phone = errorMessage || 'Số điện thoại đã được sử dụng';
          } else if (!mergedErrors.email && messageText.includes('email')) {
            mergedErrors.email = errorMessage || 'Email đã được sử dụng';
          } else if (!mergedErrors.phone && !mergedErrors.email) {
            // Only show alert if no field-specific error was set
            Alert.alert('Đăng ký thất bại', errorMessage || 'Thông tin đã tồn tại');
          }
        } else if (err.status === 0) {
          // Network error - translate message
          if (!mergedErrors.email && !mergedErrors.phone && !mergedErrors.password) {
            const networkErrorMsg = translateErrorMessage(errorMessage) || 'Lỗi kết nối mạng hoặc máy chủ không khả dụng';
            Alert.alert('Đăng ký thất bại', networkErrorMsg);
          }
        } else {
          // For other errors, only show alert if no field-specific errors
          if (!mergedErrors.email && !mergedErrors.phone && !mergedErrors.password) {
            const errorMsg = translateErrorMessage(errorMessage) || 'Có lỗi xảy ra, vui lòng thử lại.';
            Alert.alert('Đăng ký thất bại', errorMsg);
          }
        }
      } else {
        // Network or other errors - translate message
        if (!mergedErrors.email && !mergedErrors.phone && !mergedErrors.password) {
          const errorMsg = translateErrorMessage(err?.message) || 'Có lỗi xảy ra, vui lòng thử lại.';
          Alert.alert('Đăng ký thất bại', errorMsg);
        }
      }
      
      // Set all merged errors at once
      setErrors(mergedErrors);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrengthColor = () => {
    if (passwordStrength <= 1) return '#F55E5E';
    if (passwordStrength === 2) return '#F2994A';
    if (passwordStrength === 3) return '#F2C94C';
    if (passwordStrength === 4) return '#6FCF97';
    return '#2F80ED';
  };

  const passwordStrengthText = () => {
    if (passwordStrength <= 1) return 'Rất yếu';
    if (passwordStrength === 2) return 'Yếu';
    if (passwordStrength === 3) return 'Trung bình';
    if (passwordStrength === 4) return 'Mạnh';
    return 'Rất mạnh';
  };

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

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
          >
            <CleanCard contentStyle={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Feather name="user-plus" size={22} color={colors.accent} />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={styles.heroTitle}>Đăng ký tài khoản</Text>
              </View>
            </CleanCard>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <InputCard
                  icon="user"
                  placeholder="Họ và tên"
                  value={formData.name}
                  onChangeText={(v) => handleInputChange('name', v)}
                  error={errors.name}
                />
                <Text style={[styles.errorText, !errors.name && styles.errorTextHidden]}>
                  {errors.name || 'placeholder'}
                </Text>
              </View>
              <View style={styles.fieldGroup}>
                <InputCard
                  icon="mail"
                  placeholder="Email"
                  value={formData.email}
                  onChangeText={(v) => handleInputChange('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                />
                <Text style={[styles.errorText, !errors.email && styles.errorTextHidden]}>
                  {errors.email || 'placeholder'}
                </Text>
              </View>
              <View style={styles.fieldGroup}>
                <InputCard
                  icon="phone"
                  placeholder="Số điện thoại"
                  value={formData.phone}
                  onChangeText={(v) => handleInputChange('phone', v)}
                  keyboardType="phone-pad"
                  error={errors.phone}
                />
                <Text style={[styles.errorText, !errors.phone && styles.errorTextHidden]}>
                  {errors.phone || 'placeholder'}
                </Text>
              </View>
              <View style={styles.fieldGroup}>
                <InputCard
                  icon="lock"
                  placeholder="Mật khẩu"
                  value={formData.password}
                  onChangeText={(v) => handleInputChange('password', v)}
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  trailing={
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggleIcon}>
                      <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color={errors.password ? '#EF4444' : '#8E8E93'} />
                    </TouchableOpacity>
                  }
                />
                <Text style={[styles.errorText, !errors.password && styles.errorTextHidden]}>
                  {errors.password || 'placeholder'}
                </Text>
              </View>
              <View style={styles.fieldGroup}>
                <InputCard
                  icon="lock"
                  placeholder="Xác nhận mật khẩu"
                  value={formData.confirmPassword}
                  onChangeText={(v) => handleInputChange('confirmPassword', v)}
                  secureTextEntry={!showConfirmPassword}
                  error={errors.confirmPassword}
                  trailing={
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.toggleIcon}>
                      <Feather name={showConfirmPassword ? 'eye' : 'eye-off'} size={18} color={errors.confirmPassword ? '#EF4444' : '#8E8E93'} />
                    </TouchableOpacity>
                  }
                />
                <Text style={[styles.errorText, !errors.confirmPassword && styles.errorTextHidden]}>
                  {errors.confirmPassword || 'placeholder'}
                </Text>
              </View>
            </View>

            {formData.password.length > 0 && (
              <CleanCard contentStyle={styles.strengthCard}>
                <View style={styles.strengthBarContainer}>
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: `${(passwordStrength / 5) * 100}%`,
                        backgroundColor: passwordStrengthColor(),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.strengthText}>{passwordStrengthText()}</Text>
              </CleanCard>
            )}

            <CleanCard contentStyle={styles.requirementsCard}>
              <Text style={styles.sectionTitle}>Yêu cầu mật khẩu</Text>
              <RequirementRow label="Ít nhất 8 ký tự" checked={passwordChecks.length} />
              <RequirementRow label="Chữ hoa và chữ thường" checked={passwordChecks.lowercase && passwordChecks.uppercase} />
              <RequirementRow label="Ít nhất 1 chữ số" checked={passwordChecks.number} />
              <RequirementRow label="Ký tự đặc biệt" checked={passwordChecks.special} />
            </CleanCard>

            <ModernButton
              title={loading ? 'Đang xử lý...' : 'Đăng ký'}
              onPress={handleRegister}
              disabled={loading}
            />

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
};

const InputCard = ({ icon, trailing, error, ...props }) => (
  <View style={[styles.inputCard, error && styles.inputCardError]}>
    <Feather name={icon} size={20} color={error ? '#EF4444' : '#8E8E93'} style={{ marginRight: 14 }} />
    <TextInput
      style={styles.input}
      placeholderTextColor="#B0B0B3"
      {...props}
    />
    {trailing}
  </View>
);

const RequirementRow = ({ label, checked }) => (
  <View style={styles.requirementRow}>
    <Feather name={checked ? 'check-circle' : 'circle'} size={16} color={checked ? '#22C55E' : '#9CA3AF'} />
    <Text style={[styles.requirementLabel, checked && { color: '#22C55E', fontWeight: '600' }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 28,
    paddingHorizontal: 22,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
    lineHeight: 20,
  },
  form: {
    gap: 0,
  },
  fieldGroup: {
    marginBottom: 10,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#E7E7EA',
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  inputCardError: {
    borderColor: '#EF4444',
    borderWidth: 2,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 18,
    marginTop: 3,
    minHeight: 12,
  },
  errorTextHidden: {
    opacity: 0,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0A0A0A',
  },
  toggleIcon: {
    padding: 4,
  },
  strengthCard: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 6,
  },
  strengthBarContainer: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E6',
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6D6D73',
    textAlign: 'right',
  },
  requirementsCard: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requirementLabel: {
    fontSize: 13,
    color: '#7A7A7A',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
});

export default RegisterScreen;
