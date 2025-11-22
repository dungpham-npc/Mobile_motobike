import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import profileService from '../../services/profileService.js';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    studentId: '',
    emergencyContact: '',
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      const profile = currentUser || (await profileService.getCurrentUserProfile());
      setUser(profile);
      const primaryEmergencyContact = profile?.emergencyContacts?.find(ec => ec.primary);
      setFormData({
        fullName: profile?.user?.full_name || '',
        email: profile?.user?.email || '',
        phone: profile?.user?.phone || '',
        studentId: profile?.user?.student_id || '',
        emergencyContact: primaryEmergencyContact?.phone || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedAvatar(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chọn ảnh');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập camera');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedAvatar(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  const promptAvatarOptions = () => {
    Alert.alert('Cập nhật ảnh đại diện', 'Chọn cách thức cập nhật ảnh đại diện', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Chụp ảnh', onPress: takePhoto },
      { text: 'Chọn từ thư viện', onPress: pickAvatar },
    ]);
  };

  const uploadAvatar = async () => {
    if (!selectedAvatar) return;
    setUploadingAvatar(true);
    try {
      const avatarFile = {
        uri: selectedAvatar.uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      };
      await profileService.updateAvatar(avatarFile);
      // Refresh profile after avatar update
      try {
      const freshProfile = await profileService.getCurrentUserProfile();
      if (freshProfile) {
        setUser(freshProfile);
          const primaryEmergencyContact = freshProfile?.emergencyContacts?.find(ec => ec.primary);
        setFormData({
          fullName: freshProfile.user?.full_name || '',
          email: freshProfile.user?.email || '',
          phone: freshProfile.user?.phone || '',
          studentId: freshProfile.user?.student_id || '',
            emergencyContact: primaryEmergencyContact?.phone || '',
        });
        }
      } catch (refreshError) {
        console.error('Error refreshing profile after avatar update:', refreshError);
        // Continue even if refresh fails
      }
      setSelectedAvatar(null);
      Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật.');
    } catch (error) {
      console.error('Upload avatar error:', error);
      let errorMessage = 'Không thể cập nhật ảnh đại diện';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!formData.fullName.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập họ và tên');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập email');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      Alert.alert('Lỗi', 'Email không hợp lệ');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: formData.fullName,
        phone: formData.phone,
        studentId: formData.studentId || null,
        emergencyContact: formData.emergencyContact || null,
      };
      await profileService.updateProfile(payload);
      Alert.alert('Thành công', 'Thông tin hồ sơ đã được cập nhật.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      let message = 'Không thể cập nhật hồ sơ';
      if (error instanceof ApiError) {
        message = error.message || message;
      }
      Alert.alert('Lỗi', message);
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = selectedAvatar?.uri || user?.user?.profile_photo_url;

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        {/* Floating back button */}
        <TouchableOpacity 
          style={[styles.floatingBackButton, { top: insets.top + 12 }]} 
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header text as part of content */}
            <View style={styles.headerTextSection}>
              <Text style={styles.headerSubtitle}>Cập nhật thông tin của bạn</Text>
              <Text style={styles.headerTitle}>Chỉnh sửa hồ sơ</Text>
            </View>
            <CleanCard contentStyle={styles.avatarCard}>
              <TouchableOpacity style={styles.avatarWrapper} onPress={promptAvatarOptions}>
                {avatarUri ? (
                  <Image source={{ uri: `${avatarUri}?t=${Date.now()}` }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Feather name="user" size={34} color="#B0B0B3" />
                  </View>
                )}
                <View style={styles.avatarAction}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="camera" size={16} color="#FFFFFF" />
                  )}
                </View>
              </TouchableOpacity>
              {selectedAvatar && (
                <ModernButton
                  title={uploadingAvatar ? 'Đang cập nhật...' : 'Lưu ảnh đại diện'}
                  onPress={uploadAvatar}
                  disabled={uploadingAvatar}
                />
              )}
            </CleanCard>

            <CleanCard contentStyle={styles.formCard}>
              <Text style={styles.sectionHeading}>Thông tin cơ bản</Text>
              <InputRow
                icon="user"
                placeholder="Họ và tên"
                value={formData.fullName}
                onChangeText={(v) => updateFormData('fullName', v)}
              />
              <InputRow
                icon="mail"
                placeholder="Email"
                value={formData.email}
                editable={false}
              />
              <InputRow
                icon="phone"
                placeholder="Số điện thoại"
                value={formData.phone}
                onChangeText={(v) => updateFormData('phone', v)}
                keyboardType="phone-pad"
              />
              <InputRow
                icon="id-card"
                placeholder="Mã số sinh viên"
                value={formData.studentId}
                onChangeText={(v) => updateFormData('studentId', v)}
              />
            </CleanCard>

            <CleanCard contentStyle={styles.formCard}>
              <Text style={styles.sectionHeading}>Liên hệ khẩn cấp</Text>
              <InputRow
                icon="phone-call"
                placeholder="Số điện thoại khẩn cấp"
                value={formData.emergencyContact}
                onChangeText={(v) => updateFormData('emergencyContact', v)}
                keyboardType="phone-pad"
              />
              <Text style={styles.helperText}>
                Thông tin này sẽ được sử dụng trong trường hợp khẩn cấp.
              </Text>
            </CleanCard>

            <ModernButton
              title={saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              onPress={saveProfile}
              disabled={saving}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </AppBackground>
  );
};

const InputRow = (props) => {
  const { icon, editable = true, style, ...rest } = props;
  return (
    <View style={[styles.inputRow, style]}>
      <Feather name={icon} size={18} color="#8E8E93" style={{ marginRight: 12 }} />
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        placeholderTextColor="#B0B0B3"
        editable={editable}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(15,23,42,0.12)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTextSection: {
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: colors.textPrimary,
  },
  avatarCard: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 28,
  },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#F4F5F7',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#F4F5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarAction: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formCard: {
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E6E6EA',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  inputDisabled: {
    color: '#9CA3AF',
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});

export default EditProfileScreen;
