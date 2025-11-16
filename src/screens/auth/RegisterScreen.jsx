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
import { colors } from '../../theme/designTokens';
import ModernButton from '../../components/ModernButton.jsx';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const RegisterScreen = (props) => {
  const { navigation, onRequestClose, onSuccess } = props || {};
  const isEmbedded = typeof onRequestClose === 'function';
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const safeGoBack = () => {
    if (isEmbedded) {
      onRequestClose?.();
      return;
    }
    navigation?.goBack?.();
  };
  const navigateToLogin = () => {
    if (isEmbedded) {
      onRequestClose?.();
      return;
    }
    navigation?.navigate?.('Login');
  };
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

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    if (!name || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin bắt buộc.');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp.');
      return false;
    }
    if (passwordStrength < 4) {
      Alert.alert('Lỗi', 'Mật khẩu chưa đủ mạnh. Vui lòng đáp ứng tất cả điều kiện.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert('Lỗi', 'Email không hợp lệ.');
      return false;
    }
    if (!/^[0-9]{9,11}$/.test(phone)) {
      Alert.alert('Lỗi', 'Số điện thoại không hợp lệ (9-11 chữ số).');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await authService.register({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      // After registration success, navigate to Login screen with pre-filled email
      Alert.alert(
        'Đăng ký thành công!', 
        'Vui lòng đăng nhập bằng tài khoản vừa tạo. Bạn sẽ cần xác minh email trước khi có thể sử dụng ứng dụng.',
        [
          { 
            text: 'Đăng nhập ngay', 
            onPress: () => {
              // Navigate to Login and pass email to pre-fill
              if (isEmbedded) {
                onSuccess?.(formData.email);
                onRequestClose?.();
                return;
              }
              navigation?.navigate?.('Login', { prefillEmail: formData.email });
            }
          }
        ]
      );
    } catch (err) {
      Alert.alert('Đăng ký thất bại', err?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
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
                <Text style={styles.heroSubtitle}>
                  Điền thông tin dưới đây để tạo tài khoản Campus Ride. Một vài bước ngắn để bắt đầu.
                </Text>
              </View>
            </CleanCard>

            <View style={styles.form}>
              <InputCard
                icon="user"
                placeholder="Họ và tên"
                value={formData.name}
                onChangeText={(v) => handleInputChange('name', v)}
              />
              <InputCard
                icon="mail"
                placeholder="Email sinh viên"
                value={formData.email}
                onChangeText={(v) => handleInputChange('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <InputCard
                icon="phone"
                placeholder="Số điện thoại"
                value={formData.phone}
                onChangeText={(v) => handleInputChange('phone', v)}
                keyboardType="phone-pad"
              />
              <InputCard
                icon="lock"
                placeholder="Mật khẩu"
                value={formData.password}
                onChangeText={(v) => handleInputChange('password', v)}
                secureTextEntry={!showPassword}
                trailing={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.toggleIcon}>
                    <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color="#8E8E93" />
                  </TouchableOpacity>
                }
              />
              <InputCard
                icon="lock"
                placeholder="Xác nhận mật khẩu"
                value={formData.confirmPassword}
                onChangeText={(v) => handleInputChange('confirmPassword', v)}
                secureTextEntry={!showConfirmPassword}
                trailing={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.toggleIcon}>
                    <Feather name={showConfirmPassword ? 'eye' : 'eye-off'} size={18} color="#8E8E93" />
                  </TouchableOpacity>
                }
              />
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>Đã có tài khoản?</Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.footerLink}> Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
};

const InputCard = ({ icon, trailing, ...props }) => (
  <View style={styles.inputCard}>
    <Feather name={icon} size={20} color="#8E8E93" style={{ marginRight: 14 }} />
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
    gap: 12,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
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
