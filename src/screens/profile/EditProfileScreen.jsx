import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import profileService from '../../services/profileService.js';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const EditProfileScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 36 });
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
      setFormData({
        fullName: profile?.user?.full_name || '',
        email: profile?.user?.email || '',
        phone: profile?.user?.phone || '',
        studentId: profile?.user?.student_id || '',
        emergencyContact: profile?.rider_profile?.emergency_contact || '',
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
    if (!selectedAvatar) {
      Alert.alert('Lỗi', 'Vui lòng chọn ảnh đại diện');
      return;
    }

    setUploadingAvatar(true);
    try {
      console.log('Starting avatar upload...', {
        uri: selectedAvatar.uri,
        width: selectedAvatar.width,
        height: selectedAvatar.height,
        type: selectedAvatar.type,
        mimeType: selectedAvatar.mimeType,
        fileName: selectedAvatar.fileName,
      });

      // Determine MIME type from file extension or mimeType
      let mimeType = 'image/jpeg'; // default
      if (selectedAvatar.mimeType) {
        mimeType = selectedAvatar.mimeType;
      } else if (selectedAvatar.uri) {
        const uri = selectedAvatar.uri.toLowerCase();
        if (uri.endsWith('.png')) {
          mimeType = 'image/png';
        } else if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
          mimeType = 'image/jpeg';
        } else if (uri.endsWith('.webp')) {
          mimeType = 'image/webp';
        }
      }

      // Generate file name
      const fileName = selectedAvatar.fileName || 
                      selectedAvatar.uri.split('/').pop() || 
                      `avatar_${Date.now()}.${mimeType.split('/')[1]}`;

      const avatarFile = {
        uri: selectedAvatar.uri,
        type: mimeType,
        name: fileName,
      };

      console.log('Avatar file prepared:', avatarFile);

      const response = await profileService.updateAvatar(avatarFile);
      console.log('Avatar upload response:', response);

      // Refresh profile to get updated avatar URL
      try {
        const freshProfile = await profileService.getCurrentUserProfile();
        if (freshProfile) {
          setUser(freshProfile);
          setFormData({
            fullName: freshProfile.user?.full_name || '',
            email: freshProfile.user?.email || '',
            phone: freshProfile.user?.phone || '',
            studentId: freshProfile.user?.student_id || '',
            emergencyContact: freshProfile.rider_profile?.emergency_contact || '',
          });

          // Also update authService user data
          try {
            if (authService.saveUserToStorage) {
              await authService.saveUserToStorage(freshProfile);
            }
          } catch (authError) {
            console.warn('Could not update authService user data:', authError);
          }
        }
      } catch (refreshError) {
        console.warn('Could not refresh profile after avatar update:', refreshError);
      }

      setSelectedAvatar(null);
      Alert.alert('Thành công', 'Ảnh đại diện đã được cập nhật.');
    } catch (error) {
      console.error('Upload avatar error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data,
        stack: error.stack,
      });

      let errorMessage = 'Không thể cập nhật ảnh đại diện';
      
      if (error instanceof ApiError) {
        if (error.status === 400) {
          errorMessage = error.message || 'File ảnh không hợp lệ. Vui lòng chọn ảnh khác.';
        } else if (error.status === 401) {
          errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else if (error.status >= 500) {
          errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Lỗi', errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    // Validation
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
      // Prepare payload with camelCase format (backend expects camelCase)
      // Backend UpdateProfileRequest uses camelCase: fullName, phone, studentId, emergencyContact
      const payload = {
        fullName: formData.fullName.trim(),
      };

      // Email is typically not updatable via profile endpoint, but include if backend needs it
      // Note: Email updates usually require separate verification flow
      
      // Add optional fields only if they have values (backend handles null/empty)
      if (formData.phone && formData.phone.trim()) {
        payload.phone = formData.phone.trim();
      }

      if (formData.studentId && formData.studentId.trim()) {
        payload.studentId = formData.studentId.trim();
      }

      if (formData.emergencyContact && formData.emergencyContact.trim()) {
        payload.emergencyContact = formData.emergencyContact.trim();
      }

      console.log('Updating profile with payload:', JSON.stringify(payload, null, 2));
      
      const response = await profileService.updateProfile(payload);
      console.log('Profile update response:', response);

      // Refresh profile to get latest data and sync with authService
      try {
        const freshProfile = await profileService.getCurrentUserProfile();
        if (freshProfile) {
          setUser(freshProfile);
          setFormData({
            fullName: freshProfile.user?.full_name || '',
            email: freshProfile.user?.email || '',
            phone: freshProfile.user?.phone || '',
            studentId: freshProfile.user?.student_id || '',
            emergencyContact: freshProfile.rider_profile?.emergency_contact || '',
          });
          
          // Also update authService currentUser if available
          try {
            if (authService.saveUserToStorage) {
              await authService.saveUserToStorage(freshProfile);
            }
          } catch (authError) {
            console.warn('Could not update authService user data:', authError);
          }
        }
      } catch (refreshError) {
        console.warn('Could not refresh profile after update:', refreshError);
      }

      Alert.alert('Thành công', 'Thông tin hồ sơ đã được cập nhật.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Save profile error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        data: error.data,
        stack: error.stack,
      });
      
      let message = 'Không thể cập nhật hồ sơ';
      
      if (error instanceof ApiError) {
        // Handle specific error cases
        if (error.status === 400) {
          // Check for specific validation errors
          if (error.data?.message) {
            message = error.data.message;
          } else if (error.message) {
            message = error.message;
          } else {
            message = 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.';
          }
        } else if (error.status === 401) {
          message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        } else if (error.status === 403) {
          message = 'Bạn không có quyền thực hiện thao tác này.';
        } else if (error.status === 404) {
          message = 'Không tìm thấy tài khoản.';
        } else if (error.status === 409) {
          // Conflict - phone or student ID already exists
          if (error.data?.message) {
            message = error.data.message;
          } else if (error.message) {
            message = error.message;
          } else {
            message = 'Số điện thoại hoặc mã sinh viên đã được sử dụng bởi tài khoản khác.';
          }
        } else if (error.status >= 500) {
          message = 'Lỗi máy chủ. Vui lòng thử lại sau.';
        } else {
          message = error.message || message;
        }
      } else if (error.message) {
        message = error.message;
      }
      
      Alert.alert('Lỗi', message);
    } finally {
      setSaving(false);
    }
  };

  const avatarUri = selectedAvatar?.uri || user?.user?.profile_photo_url;

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Chỉnh sửa hồ sơ"
          subtitle="Cập nhật thông tin của bạn"
          onBackPress={() => navigation.goBack()}
          rightIcon="check"
          rightIconColor={colors.accent}
          rightLoading={saving}
          onRightPress={saveProfile}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
          >
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
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
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
