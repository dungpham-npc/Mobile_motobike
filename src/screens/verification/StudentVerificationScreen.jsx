import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import verificationService from '../../services/verificationService';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';
import { colors, spacing, typography } from '../../theme/designTokens';

const StudentVerificationScreen = ({ navigation, route }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentSide, setCurrentSide] = useState('front'); // 'front' or 'back'
  const [currentVerification, setCurrentVerification] = useState(null);
  const guardMode = route?.params?.guardMode === true;
  const verificationStatus = currentVerification?.status?.toLowerCase();
  const isPending = verificationStatus === 'pending';
  const isVerified = ['approved', 'verified', 'active'].includes(verificationStatus || '');

  const getStatusColor = (verification) => {
    const status = verification?.status?.toLowerCase();
    switch (status) {
      case 'approved':
      case 'verified':
      case 'active':
        return '#22C55E';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusText = (verification) => {
    const status = verification?.status?.toLowerCase();
    switch (status) {
      case 'approved':
      case 'verified':
      case 'active':
        return 'Đã xác minh';
      case 'pending':
        return 'Đang chờ duyệt';
      case 'rejected':
        return 'Bị từ chối';
      default:
        return 'Chưa gửi giấy tờ';
    }
  };

  // Load current verification status
  useEffect(() => {
    loadCurrentVerification();
  }, []);

  const loadCurrentVerification = async () => {
    try {
      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentVerification(verification);
      
      if (!guardMode) {
        // If user already has pending verification, show alert and go back
        if (verification && verification.status?.toLowerCase() === 'pending') {
          Alert.alert(
            'Đang chờ duyệt',
            'Bạn đã gửi yêu cầu xác minh và đang chờ quản trị viên duyệt. Vui lòng chờ kết quả.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
        
        // If user already verified, show alert and go back
        if (verification && (verification.status?.toLowerCase() === 'verified' || verification.status?.toLowerCase() === 'approved' || verification.status?.toLowerCase() === 'active')) {
          Alert.alert(
            'Đã xác minh',
            'Tài khoản của bạn đã được xác minh.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }
      }

      // If user's verification was rejected, just log it (don't show alert again)
      // The alert was already shown in ProfileSwitchScreen
      if (verification && verification.status?.toLowerCase() === 'rejected') {
        console.log('User has rejected verification, allowing resubmission');
        // Continue with the form to allow resubmission
        return;
      }
    } catch (error) {
      console.log('No current verification found or error:', error);
      setCurrentVerification(null);
    }
  };

  // Convert and compress image to JPEG format
  const compressImage = async (imageUri) => {
    try {
      console.log('Converting and compressing image:', imageUri);
      
      // Convert to JPEG and resize to reduce file size
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { resize: { width: 1200 } }, // Resize to reasonable size
        ],
        { 
          compress: 0.7, // Good quality (70%)
          format: ImageManipulator.SaveFormat.JPEG, // Force JPEG format
          base64: false // Don't include base64 to reduce memory usage
        }
      );
      
      console.log('Image converted to JPEG:', {
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
        fileSize: manipResult.fileSize
      });
      
      // If still too large, compress more aggressively
      if (manipResult.fileSize && manipResult.fileSize > 5 * 1024 * 1024) { // 5MB limit
        console.log('Still too large, compressing more aggressively...');
        const secondPass = await ImageManipulator.manipulateAsync(
          manipResult.uri,
          [{ resize: { width: 800 } }],
          { 
            compress: 0.5, // Lower quality (50%)
            format: ImageManipulator.SaveFormat.JPEG,
            base64: false
          }
        );
        console.log('Second compression result:', {
          uri: secondPass.uri,
          fileSize: secondPass.fileSize
        });
        return secondPass;
      }
      
      return manipResult;
    } catch (error) {
      console.error('Error converting image to JPEG:', error);
      throw new Error('Không thể xử lý ảnh. Vui lòng chọn ảnh khác.');
    }
  };

  const pickImage = async (side) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Only images
        allowsEditing: false,
        quality: 1, // Use full quality first, we'll convert to JPEG later
        exif: false, // Don't include EXIF data to reduce file size
      });

      if (!result.canceled && result.assets[0]) {
        const originalImage = result.assets[0];
        console.log('Original image info:', {
          uri: originalImage.uri,
          type: originalImage.type,
          fileSize: originalImage.fileSize,
          width: originalImage.width,
          height: originalImage.height
        });
        
        try {
          // Convert to JPEG format (handles HEIC, PNG, etc.)
          console.log('Converting image to JPEG format...');
          const compressedImage = await compressImage(originalImage.uri);
          
          const processedImage = {
            uri: compressedImage.uri,
            type: 'image/jpeg', // Force JPEG type
            fileName: `student_id_${side}_${Date.now()}.jpg`,
            fileSize: compressedImage.fileSize,
            width: compressedImage.width,
            height: compressedImage.height,
          };
          
          console.log('Processed image info:', processedImage);
          
          if (side === 'front') {
            setFrontImage(processedImage);
          } else {
            setBackImage(processedImage);
          }
          
        } catch (compressError) {
          console.error('Error converting image:', compressError);
          Alert.alert('Lỗi', compressError.message || 'Không thể xử lý ảnh. Vui lòng chọn ảnh khác.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn ảnh từ thư viện');
    }
  };

  const takePhoto = async (side) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Cần cấp quyền truy cập camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], // Only images
        allowsEditing: false,
        quality: 1, // Use full quality first, we'll convert to JPEG later
        exif: false, // Don't include EXIF data to reduce file size
      });

      if (!result.canceled && result.assets[0]) {
        const originalImage = result.assets[0];
        console.log('Original photo info:', {
          uri: originalImage.uri,
          type: originalImage.type,
          fileSize: originalImage.fileSize,
          width: originalImage.width,
          height: originalImage.height
        });
        
        try {
          // Convert to JPEG format
          console.log('Converting photo to JPEG format...');
          const compressedImage = await compressImage(originalImage.uri);
          
          const processedImage = {
            uri: compressedImage.uri,
            type: 'image/jpeg', // Force JPEG type
            fileName: `student_id_${side}_${Date.now()}.jpg`,
            fileSize: compressedImage.fileSize,
            width: compressedImage.width,
            height: compressedImage.height,
          };
          
          console.log('Processed photo info:', processedImage);
          
          if (side === 'front') {
            setFrontImage(processedImage);
          } else {
            setBackImage(processedImage);
          }
          
        } catch (compressError) {
          console.error('Error converting photo:', compressError);
          Alert.alert('Lỗi', compressError.message || 'Không thể xử lý ảnh. Vui lòng chụp lại.');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh');
    }
  };

  const showImagePicker = (side) => {
    setCurrentSide(side);
    Alert.alert(
      `Chọn ảnh mặt ${side === 'front' ? 'trước' : 'sau'}`,
      'Chọn cách thức để tải ảnh thẻ sinh viên',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Chụp ảnh', onPress: () => takePhoto(side) },
        { text: 'Chọn từ thư viện', onPress: () => pickImage(side) },
      ]
    );
  };

  const submitVerification = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Lỗi', 'Vui lòng chụp đầy đủ 2 mặt thẻ sinh viên');
      return;
    }

    setUploading(true);

    try {
      // Validate files first
      verificationService.validateDocumentFile(frontImage);
      verificationService.validateDocumentFile(backImage);

      // Create document files array
      const documentFiles = [
        {
          uri: frontImage.uri,
          mimeType: frontImage.mimeType || 'image/jpeg',
          fileName: frontImage.fileName || 'student_id_front.jpg',
          fileSize: frontImage.fileSize,
        },
        {
          uri: backImage.uri,
          mimeType: backImage.mimeType || 'image/jpeg',
          fileName: backImage.fileName || 'student_id_back.jpg',
          fileSize: backImage.fileSize,
        }
      ];

      const result = await verificationService.submitStudentVerification(documentFiles);

      // After successful submission, refresh verification status
      try {
        const updatedVerification = await verificationService.getCurrentStudentVerification();
        setCurrentVerification(updatedVerification);
        console.log('Updated verification status:', updatedVerification);
      } catch (error) {
        console.log('Could not refresh verification status:', error);
      }

      Alert.alert(
        'Gửi thành công!',
        result.message || 'Tài liệu đã được gửi để xác minh. Quản trị viên sẽ duyệt trong 1-2 ngày làm việc.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              if (!guardMode) {
                // Navigate to Main screen after successful submission
                navigation.replace('Main');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Student verification error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể gửi thẻ sinh viên');
    } finally {
      setUploading(false);
    }
  };

  const handleBackPress = () => {
    if (guardMode) {
      navigation.replace('Login');
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Xác minh thẻ sinh viên"
          onBackPress={handleBackPress}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
        >
          {/* Status Card (Guard Mode) */}
          {guardMode && currentVerification && (
            <Animatable.View animation="fadeInDown" duration={400} useNativeDriver>
              <CleanCard contentStyle={styles.statusCard}>
                <View style={styles.statusHeader}>
                  <View style={styles.statusIconContainer}>
                    <Feather 
                      name={isPending ? "clock" : currentVerification?.status?.toLowerCase() === 'rejected' ? "x-circle" : "check-circle"} 
                      size={20} 
                      color={getStatusColor(currentVerification)} 
                    />
                  </View>
                  <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>Trạng thái xác minh</Text>
                <Text style={[styles.statusValue, { color: getStatusColor(currentVerification) }]}>
                  {getStatusText(currentVerification)}
                </Text>
              </View>
              <TouchableOpacity onPress={loadCurrentVerification} style={styles.refreshBtn}>
                    <Feather name="refresh-cw" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {currentVerification?.status?.toLowerCase() === 'rejected' && (
                  <View style={styles.rejectionContainer}>
                    <Text style={styles.rejectionLabel}>Lý do từ chối:</Text>
              <Text style={styles.rejectionText}>
                      {currentVerification.rejection_reason || currentVerification.rejectionReason || 'Không rõ lý do'}
              </Text>
                  </View>
            )}
            {isVerified && (
              <ModernButton
                title="Tiếp tục"
                onPress={() => navigation.replace('Main')}
                style={styles.continueButton}
                icon="arrow-forward"
              />
            )}
          </CleanCard>
            </Animatable.View>
          )}

          {/* Hero Card - Only show if not verified and not pending */}
          {!isPending && !isVerified && (
            <Animatable.View animation="fadeInDown" duration={500} useNativeDriver>
              <CleanCard contentStyle={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Feather name="credit-card" size={28} color={colors.primary} />
                </View>
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle}>Xác minh tài khoản sinh viên</Text>
                  <Text style={styles.heroSubtitle}>
                    Để sử dụng dịch vụ, bạn cần xác minh là sinh viên của trường. Vui lòng chụp ảnh thẻ sinh viên rõ nét cả hai mặt.
                  </Text>
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Pending Status Card */}
          {isPending && (
            <Animatable.View animation="fadeInUp" duration={500} useNativeDriver>
              <CleanCard variant="accent" contentStyle={styles.pendingCard}>
                <View style={styles.pendingIcon}>
                  <Feather name="hourglass" size={32} color={colors.accent} />
                </View>
                <Text style={styles.pendingTitle}>Đang chờ duyệt</Text>
                <Text style={styles.pendingText}>
                  Hồ sơ của bạn đã được gửi và đang được quản trị viên kiểm tra. Vui lòng chờ 1-2 ngày làm việc. Bạn sẽ nhận thông báo khi kết quả có sẵn.
                </Text>
                <TouchableOpacity onPress={loadCurrentVerification} style={styles.refreshStatusBtn}>
                  <Feather name="refresh-cw" size={16} color={colors.accent} />
                  <Text style={styles.refreshStatusText}>Làm mới trạng thái</Text>
                </TouchableOpacity>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Requirements Card - Only show if not verified and not pending */}
          {!isPending && !isVerified && (
            <Animatable.View animation="fadeInUp" delay={100} duration={500} useNativeDriver>
              <CleanCard contentStyle={styles.requirementsCard}>
                <View style={styles.cardHeader}>
                  <Feather name="info" size={18} color={colors.primary} />
                  <Text style={styles.cardTitle}>Yêu cầu ảnh thẻ sinh viên</Text>
                </View>
                <View style={styles.requirementsList}>
                  {[
                    'Ảnh rõ nét, không bị mờ',
                    'Hiển thị đầy đủ thông tin trên thẻ',
                    'Thẻ còn hiệu lực',
                    'Định dạng JPG, PNG (tối đa 5MB)'
                  ].map((req, index) => (
                    <View key={index} style={styles.requirementItem}>
                      <Feather name="check-circle" size={16} color={colors.primary} />
                      <Text style={styles.requirementText}>{req}</Text>
                    </View>
                  ))}
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Upload Sections - Only show if not verified and not pending */}
          {!isPending && !isVerified && (
            <>
              {/* Front Image Card */}
              <Animatable.View animation="fadeInUp" delay={200} duration={500} useNativeDriver>
                <CleanCard contentStyle={styles.uploadCard}>
                  <Text style={styles.uploadCardTitle}>Mặt trước thẻ sinh viên</Text>
                  {frontImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: frontImage.uri }} style={styles.imagePreview} />
                      <TouchableOpacity 
                        style={styles.changeImageBtn}
                        onPress={() => showImagePicker('front')}
                      >
                        <Feather name="edit-2" size={16} color={colors.accent} />
                        <Text style={styles.changeImageText}>Đổi ảnh</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
            <TouchableOpacity 
                      style={styles.uploadButton}
                      onPress={() => showImagePicker('front')}
                    >
                      <View style={styles.uploadButtonContent}>
                        <Feather name="camera" size={32} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Chụp mặt trước</Text>
                        <Text style={styles.uploadButtonSubtext}>Chụp ảnh hoặc chọn từ thư viện</Text>
                      </View>
            </TouchableOpacity>
                  )}
                </CleanCard>
              </Animatable.View>

              {/* Back Image Card */}
              <Animatable.View animation="fadeInUp" delay={300} duration={500} useNativeDriver>
                <CleanCard contentStyle={styles.uploadCard}>
                  <Text style={styles.uploadCardTitle}>Mặt sau thẻ sinh viên</Text>
                  {backImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: backImage.uri }} style={styles.imagePreview} />
                      <TouchableOpacity 
                        style={styles.changeImageBtn}
                        onPress={() => showImagePicker('back')}
                      >
                        <Feather name="edit-2" size={16} color={colors.accent} />
                        <Text style={styles.changeImageText}>Đổi ảnh</Text>
                      </TouchableOpacity>
          </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.uploadButton}
                      onPress={() => showImagePicker('back')}
                    >
                      <View style={styles.uploadButtonContent}>
                        <Feather name="camera" size={32} color={colors.primary} />
                        <Text style={styles.uploadButtonText}>Chụp mặt sau</Text>
                        <Text style={styles.uploadButtonSubtext}>Chụp ảnh hoặc chọn từ thư viện</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </CleanCard>
              </Animatable.View>

              {/* Submit Button */}
              <Animatable.View animation="fadeInUp" delay={400} duration={500} useNativeDriver>
                <ModernButton
                  title={uploading ? "Đang gửi..." : "Gửi để xác minh"}
                  onPress={submitVerification}
                  disabled={!frontImage || !backImage || uploading}
                  icon={uploading ? null : "send"}
                  style={styles.submitButton}
                />
              </Animatable.View>
            </>
          )}

          {/* Info Card - Only show if not verified and not pending */}
          {!isPending && !isVerified && (
            <Animatable.View animation="fadeInUp" delay={500} duration={500} useNativeDriver>
              <CleanCard variant="accent" contentStyle={styles.infoCard}>
                <Feather name="info" size={18} color={colors.accent} />
                <Text style={styles.infoText}>
                  Quá trình xác minh có thể mất 1-2 ngày làm việc. Chúng tôi sẽ thông báo kết quả qua email.
                </Text>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Loading Overlay */}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.uploadingText}>Đang tải lên và xử lý...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  // Status Card (Guard Mode)
  statusCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(16,65,47,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
    gap: 4,
  },
  statusLabel: {
    fontSize: typography.small,
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  statusValue: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectionContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 12,
    gap: 4,
  },
  rejectionLabel: {
    fontSize: typography.small,
    color: '#EF4444',
    fontFamily: 'Inter_600SemiBold',
  },
  rejectionText: {
    fontSize: typography.small,
    color: colors.textSecondary,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  continueButton: {
    marginTop: spacing.sm,
  },
  // Hero Card
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(16,65,47,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // Pending Card
  pendingCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pendingIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  pendingText: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  refreshStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  refreshStatusText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
  },
  // Requirements Card
  requirementsCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  requirementsList: {
    gap: spacing.sm,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requirementText: {
    flex: 1,
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Upload Card
  uploadCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  uploadCardTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  uploadButton: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.glassLight,
    overflow: 'hidden',
  },
  uploadButtonContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  uploadButtonText: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  uploadButtonSubtext: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  imagePreviewContainer: {
    gap: spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    resizeMode: 'cover',
    backgroundColor: colors.glassLight,
  },
  changeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  changeImageText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
  },
  // Submit Button
  submitButton: {
    marginTop: spacing.xs,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Uploading Overlay
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadingText: {
    fontSize: typography.body,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
});

export default StudentVerificationScreen;
