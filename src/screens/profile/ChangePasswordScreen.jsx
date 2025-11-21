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

const ChangePasswordScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));
  const toggleVisibility = (field) => setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));

  const validation = validatePassword(formData.newPassword);
  const match = formData.confirmPassword && formData.newPassword === formData.confirmPassword;

  const handleSubmit = async () => {
    if (!formData.currentPassword.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!validation.isValid) {
      Alert.alert('Lỗi', 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.');
      return;
    }
    if (!match) {
      Alert.alert('Lỗi', 'Xác nhận mật khẩu không khớp.');
      return;
    }

    try {
      setLoading(true);
      await authService.changePassword(formData.currentPassword, formData.newPassword);
      Alert.alert('Thành công', 'Mật khẩu đã được cập nhật.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      let message = 'Không thể đổi mật khẩu';
      if (error instanceof ApiError) {
        message = error.message || message;
      }
      Alert.alert('Lỗi', message);
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
              />
            </CleanCard>

            <CleanCard contentStyle={styles.requirementsCard}>
              <Text style={styles.sectionTitle}>Yêu cầu mật khẩu</Text>
              <RequirementRow label="Ít nhất 8 ký tự" checked={validation.minLength} />
              <RequirementRow label="Chữ hoa và chữ thường" checked={validation.hasUpperCase && validation.hasLowerCase} />
              <RequirementRow label="Ít nhất 1 chữ số" checked={validation.hasNumbers} />
              <RequirementRow label="Ký tự đặc biệt" checked={validation.hasSpecialChar} />
            </CleanCard>

            {formData.confirmPassword.length > 0 && (
              <CleanCard contentStyle={styles.matchCard}>
                <Feather name={match ? 'check-circle' : 'x-circle'} size={18} color={match ? '#22C55E' : '#EF4444'} />
                <Text style={[styles.matchText, { color: match ? '#22C55E' : '#EF4444' }]}> 
                  {match ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                </Text>
              </CleanCard>
            )}

            <ModernButton
              title={loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
              onPress={handleSubmit}
              disabled={loading || !validation.isValid || !match}
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

const InputRow = ({ icon, trailing, style, ...props }) => (
  <View style={[styles.inputRow, style]}>
    <Feather name={icon} size={18} color="#8E8E93" style={{ marginRight: 12 }} />
    <TextInput
      placeholderTextColor="#B0B0B3"
      style={styles.input}
      {...props}
    />
    {trailing}
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
    isValid: minLength && hasUpperCase && hasLowerCase && hasNumbers,
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
  link: {
    alignSelf: 'center',
  },
  linkText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
});

export default ChangePasswordScreen;
