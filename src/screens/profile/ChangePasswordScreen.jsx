import React, { useState } from 'react';
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

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

// Helper to translate backend error messages to Vietnamese
const translateErrorMessage = (message) => {
  if (!message) return '';
  const msg = message.toLowerCase();

  if (msg.includes('current password') && msg.includes('incorrect')) {
    return 'Mật khẩu hiện tại không chính xác';
  }
  if (msg.includes('new password') && msg.includes('same')) {
    return 'Mật khẩu mới phải khác mật khẩu hiện tại';
  }
  if (msg.includes('new password') && msg.includes('invalid')) {
    return 'Mật khẩu mới không hợp lệ';
  }
  if (msg.includes('password must contain')) {
    return 'Mật khẩu phải chứa chữ hoa, chữ thường, chữ số và ký tự đặc biệt';
  }
  if (msg.includes('password must be between')) {
    return 'Mật khẩu phải từ 8 đến 100 ký tự';
  }
  if (msg.includes('network error') || msg.includes('server unavailable')) {
    return 'Lỗi kết nối mạng hoặc máy chủ không khả dụng';
  }

  return message;
};

const ChangePasswordScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    current: '',
    new: '',
    confirm: '',
    general: '',
  });

  const fieldErrorMap = {
    currentPassword: 'current',
    newPassword: 'new',
    confirmPassword: 'confirm',
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    const mappedField = fieldErrorMap[field];
    if (mappedField) {
      setErrors((prev) => ({ ...prev, [mappedField]: '', general: '' }));
    }
  };
  const toggleVisibility = (field) => setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));

  const validation = validatePassword(formData.newPassword);
  const match = formData.confirmPassword && formData.newPassword === formData.confirmPassword;
  const isSameAsCurrent =
    formData.currentPassword.length > 0 &&
    formData.newPassword.length > 0 &&
    formData.currentPassword === formData.newPassword;

  const handleSubmit = async () => {
    const newErrors = { current: '', new: '', confirm: '', general: '' };
    let hasError = false;

    if (!formData.currentPassword.trim()) {
      newErrors.current = 'Vui lòng nhập mật khẩu hiện tại';
      hasError = true;
    }
    if (!formData.newPassword.trim()) {
      newErrors.new = 'Vui lòng nhập mật khẩu mới';
      hasError = true;
    } else if (!validation.isValid) {
      newErrors.new = 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt';
      hasError = true;
    } else if (formData.currentPassword && formData.currentPassword === formData.newPassword) {
      newErrors.new = 'Mật khẩu mới phải khác mật khẩu hiện tại';
      hasError = true;
    }
    if (!formData.confirmPassword.trim()) {
      newErrors.confirm = 'Vui lòng nhập lại mật khẩu';
      hasError = true;
    } else if (!match) {
      newErrors.confirm = 'Mật khẩu xác nhận không khớp';
      hasError = true;
    }

    setErrors(newErrors);
    if (hasError) {
      return;
    }

    // Clear previous errors before calling API
    setErrors({ current: '', new: '', confirm: '', general: '' });

    try {
      setLoading(true);
      await authService.updatePassword(formData.currentPassword, formData.newPassword);
      setErrors({ current: '', new: '', confirm: '', general: '' });
      Alert.alert('Thành công', 'Mật khẩu đã được cập nhật.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      console.error('Change password error:', error);
      let message = translateErrorMessage(error?.message || 'Không thể đổi mật khẩu');

      if (error instanceof ApiError) {
        const matchesKeywords = (text, keywords = []) => {
          if (!text) return false;
          return keywords.some((keyword) => text.includes(keyword));
        };

        const keywordSets = {
          current: ['current password', 'old password', 'mật khẩu cũ', 'mat khau cu', 'mật khẩu hiện tại', 'mat khau hien tai'],
          new: ['new password', 'mật khẩu mới', 'mat khau moi'],
          confirm: ['confirm password', 'confirmation password', 'mật khẩu xác nhận', 'mat khau xac nhan'],
        };

        const fieldErrors =
          error?.data?.field_errors ||
          error?.data?.fieldErrors ||
          error?.data?.error?.fieldErrors;

        const mapFieldKey = (key) => {
          if (!key) return null;
          const normalized = key.toLowerCase();
          if (
            normalized.includes('current') ||
            normalized.includes('old') ||
            matchesKeywords(normalized, keywordSets.current)
          ) {
            return 'current';
          }
          if (
            normalized.includes('confirm') ||
            matchesKeywords(normalized, keywordSets.confirm)
          ) {
            return 'confirm';
          }
          if (
            normalized.includes('new') ||
            matchesKeywords(normalized, keywordSets.new)
          ) {
            return 'new';
          }
          return null;
        };

        if (fieldErrors && typeof fieldErrors === 'object') {
          const nextErrors = { current: '', new: '', confirm: '', general: '' };
          Object.entries(fieldErrors).forEach(([field, fieldMessage]) => {
            const translated = translateErrorMessage(fieldMessage);
            const mappedKey = mapFieldKey(field);
            if (mappedKey === 'current') {
              nextErrors.current =
                translated || 'Mật khẩu hiện tại không chính xác';
            } else if (mappedKey === 'new') {
              nextErrors.new =
                translated ||
                'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt';
            } else if (mappedKey === 'confirm') {
              nextErrors.confirm = translated || 'Mật khẩu xác nhận không khớp';
            } else {
              nextErrors.general = translated || error.message;
            }
          });
          setErrors((prev) => ({ ...prev, ...nextErrors }));
          return;
        }

        const backendMessage =
          translateErrorMessage(error?.data?.error?.message || error.message) ||
          '';
        const backendMessageRaw = (
          error?.data?.error?.message ||
          error?.data?.message ||
          error.message ||
          ''
        ).toLowerCase();

        const shouldShowOnCurrent = matchesKeywords(
          backendMessageRaw,
          keywordSets.current
        );
        const shouldShowOnNew = matchesKeywords(
          backendMessageRaw,
          keywordSets.new
        );
        const shouldShowOnConfirm = matchesKeywords(
          backendMessageRaw,
          keywordSets.confirm
        );

        switch (error.status) {
          case 400:
            if (shouldShowOnCurrent) {
              setErrors((prev) => ({
                ...prev,
                current:
                  backendMessage || 'Mật khẩu hiện tại không chính xác',
              }));
            } else if (shouldShowOnConfirm) {
              setErrors((prev) => ({
                ...prev,
                confirm:
                  backendMessage ||
                  'Mật khẩu xác nhận không khớp với mật khẩu mới',
              }));
            } else if (shouldShowOnNew) {
              setErrors((prev) => ({
                ...prev,
                new:
                  backendMessage ||
                  'Mật khẩu mới không hợp lệ. Vui lòng kiểm tra lại.',
              }));
            } else {
              setErrors((prev) => ({
                ...prev,
                general: backendMessage || 'Không thể đổi mật khẩu lúc này',
              }));
            }
            break;
          case 401:
          case 403:
            setErrors((prev) => ({
              ...prev,
              current: backendMessage || 'Mật khẩu hiện tại không chính xác',
            }));
            break;
          case 0:
            setErrors((prev) => ({
              ...prev,
              general:
                backendMessage ||
                'Lỗi kết nối mạng hoặc máy chủ không khả dụng. Vui lòng thử lại.',
            }));
            break;
          default:
            setErrors((prev) => ({
              ...prev,
              general: backendMessage || 'Không thể đổi mật khẩu lúc này',
            }));
        }
        return;
      }

      setErrors((prev) => ({ ...prev, general: message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title=""
          subtitle=""
          onBackPress={() => navigation.goBack()}
        />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
            keyboardShouldPersistTaps="handled"
          >
            <CleanCard contentStyle={styles.infoCard}>
              <View style={styles.heroIconWrap}>
                <Feather name="shield" size={26} color={colors.primary} />
              </View>
              <Text style={styles.infoTitle}>Bảo mật tài khoản</Text>
              <Text style={styles.infoSubtitle}>
                Để bảo vệ tài khoản của bạn, hãy sử dụng mật khẩu mạnh và không chia sẻ với người khác.
              </Text>
            </CleanCard>

            <CleanCard contentStyle={styles.formCard}>
              <InputRow
                placeholder="Mật khẩu hiện tại"
                value={formData.currentPassword}
                onChangeText={(v) => updateField('currentPassword', v)}
                secureTextEntry={!showPasswords.current}
                icon="lock"
                trailing={
                  <IconToggle
                    name={showPasswords.current ? 'eye' : 'eye-off'}
                    onPress={() => toggleVisibility('current')}
                  />
                }
                error={errors.current}
              />
              <InputRow
                placeholder="Mật khẩu mới"
                value={formData.newPassword}
                onChangeText={(v) => updateField('newPassword', v)}
                secureTextEntry={!showPasswords.new}
                icon="lock"
                trailing={
                  <IconToggle
                    name={showPasswords.new ? 'eye' : 'eye-off'}
                    onPress={() => toggleVisibility('new')}
                  />
                }
                error={errors.new}
              />
              <InputRow
                placeholder="Xác nhận mật khẩu mới"
                value={formData.confirmPassword}
                onChangeText={(v) => updateField('confirmPassword', v)}
                secureTextEntry={!showPasswords.confirm}
                icon="lock"
                trailing={
                  <IconToggle
                    name={showPasswords.confirm ? 'eye' : 'eye-off'}
                    onPress={() => toggleVisibility('confirm')}
                  />
                }
                error={errors.confirm}
              />
            </CleanCard>

            <CleanCard contentStyle={styles.requirementsCard}>
              <Text style={styles.sectionTitle}>Yêu cầu mật khẩu</Text>
              <RequirementRow label="Ít nhất 8 ký tự" checked={validation.minLength} />
              <RequirementRow label="Chữ hoa và chữ thường" checked={validation.hasUpperCase && validation.hasLowerCase} />
              <RequirementRow label="Ít nhất 1 chữ số" checked={validation.hasNumbers} />
              <RequirementRow label="Ký tự đặc biệt" checked={validation.hasSpecialChar} />
              {formData.currentPassword.length > 0 && formData.newPassword.length > 0 && (
                <RequirementRow
                  label="Khác mật khẩu hiện tại"
                  checked={!isSameAsCurrent}
                />
              )}
            </CleanCard>

            {formData.confirmPassword.length > 0 && (
              <CleanCard contentStyle={styles.matchCard}>
                <Feather name={match ? 'check-circle' : 'x-circle'} size={18} color={match ? '#22C55E' : '#EF4444'} />
                <Text style={[styles.matchText, { color: match ? '#22C55E' : '#EF4444' }]}> 
                  {match ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                </Text>
              </CleanCard>
            )}

            {!!errors.general && (
              <Text style={styles.generalError}>{errors.general}</Text>
            )}

            <ModernButton
              title={loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              onPress={handleSubmit}
              disabled={loading || !validation.isValid || !match || isSameAsCurrent}
            />

            <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('ResetPassword')}>
              <Text style={styles.linkText}>Quên mật khẩu hiện tại?</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
};

const InputRow = ({ icon, trailing, error, style, ...props }) => (
  <View style={{ gap: 6 }}>
    <View style={[styles.inputRow, error && styles.inputRowError, style]}>
      <Feather name={icon} size={18} color={error ? '#EF4444' : '#8E8E93'} style={{ marginRight: 12 }} />
      <TextInput
        placeholderTextColor="#B0B0B3"
        style={[styles.input, { color: colors.textPrimary }]}
        {...props}
      />
      {trailing}
    </View>
    {error ? <Text style={styles.inputErrorText}>{error}</Text> : null}
  </View>
);

const IconToggle = ({ name, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.toggleIcon}>
    <Feather name={name} size={18} color="#8E8E93" />
  </TouchableOpacity>
);

const RequirementRow = ({ label, checked }) => (
  <View style={styles.requirementRow}>
    <Feather name={checked ? 'check-circle' : 'circle'} size={16} color={checked ? '#22C55E' : '#9CA3AF'} />
    <Text style={[styles.requirementText, checked && { color: '#22C55E', fontWeight: '600' }]}>{label}</Text>
  </View>
);

const validatePassword = (password) => {
  if (!password) {
    return {
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumbers: false,
      hasSpecialChar: false,
      isValid: false,
    };
  }

  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
    isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
  };
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#E6F6EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  formCard: {
    gap: 12,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputRowError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  toggleIcon: {
    padding: 4,
  },
  requirementsCard: {
    paddingVertical: 22,
    paddingHorizontal: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requirementText: {
    fontSize: 13,
    color: '#6B7280',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginLeft: 6,
  },
  link: {
    alignSelf: 'center',
  },
  linkText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  generalError: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8,
  },
});

export default ChangePasswordScreen;
