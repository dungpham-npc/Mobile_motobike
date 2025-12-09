import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import verificationService from '../../services/verificationService';
import { ApiError } from '../../services/api';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';
import { colors, spacing, typography } from '../../theme/designTokens';

const DriverVerificationScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 24 });
  // State for each document type
  const [licenseFront, setLicenseFront] = useState(null);
  const [licenseBack, setLicenseBack] = useState(null);
  const [vehicleRegistrationFront, setVehicleRegistrationFront] = useState(null);
  const [vehicleRegistrationBack, setVehicleRegistrationBack] = useState(null);
  const [vehicleAuthorizationFront, setVehicleAuthorizationFront] = useState(null);
  const [vehicleAuthorizationBack, setVehicleAuthorizationBack] = useState(null);
  
  const [uploading, setUploading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [currentDocument, setCurrentDocument] = useState('license'); // license, vehicleRegistration, vehicleAuthorization
  const [currentSide, setCurrentSide] = useState('front'); // front, back
  const [currentVerification, setCurrentVerification] = useState(null);
  const verificationStatus = currentVerification?.status?.toLowerCase();
  const isPending = verificationStatus === 'pending';
  const isApproved = ['approved', 'verified', 'active'].includes(verificationStatus || '');
  const isInactive = verificationStatus === 'inactive';
  const isRejected = verificationStatus === 'rejected';

  // Load current verification status
  useEffect(() => {
    loadCurrentVerification();
  }, []);

  const loadCurrentVerification = async () => {
    try {
      // If a driver verification/profile already exists, use it directly
      const existingDriverVerification = await verificationService.getCurrentDriverVerification();
      if (existingDriverVerification?.status) {
        setCurrentVerification(existingDriverVerification);
        return;
      }

      // Otherwise ensure rider verification is approved before allowing submission
      const riderVerification = await verificationService.getCurrentStudentVerification();
      if (!riderVerification || riderVerification.status?.toLowerCase() !== 'approved') {
        Alert.alert(
          'Cần xác minh rider trước',
          'Bạn cần xác minh tài khoản sinh viên trước khi có thể xác minh tài xế. Vui lòng gửi thẻ sinh viên để admin duyệt.',
          [
            { text: 'Hủy', onPress: () => navigation.goBack() },
            { text: 'Xác minh sinh viên', onPress: () => navigation.navigate('StudentVerification') }
          ]
        );
        return;
      }

      const verification = await verificationService.getCurrentDriverVerification();
      setCurrentVerification(verification);
    } catch (error) {
      console.log('No current driver verification found or error:', error);
      setCurrentVerification(null);
    }
  };

  const handleSwitchToDriver = async () => {
    try {
      setSwitching(true);
      const result = await authService.switchProfile('driver');
      if (result?.active_profile?.toLowerCase?.() === 'driver' || result?.activeProfile?.toLowerCase?.() === 'driver') {
        navigation.replace('DriverMain');
      } else {
        navigation.replace('DriverMain');
      }
    } catch (error) {
      console.error('Switch to driver error:', error);
      Alert.alert('Lỗi', 'Không thể chuyển sang chế độ tài xế. Vui lòng thử lại.');
    } finally {
      setSwitching(false);
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

  const pickImage = async (documentType, side) => {
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
            fileName: `${documentType}_${side}_${Date.now()}.jpg`,
            fileSize: compressedImage.fileSize,
            width: compressedImage.width,
            height: compressedImage.height,
          };
          
          console.log('Processed image info:', processedImage);
          
          // Set the appropriate state based on document type and side
          if (documentType === 'license') {
            if (side === 'front') {
              setLicenseFront(processedImage);
            } else {
              setLicenseBack(processedImage);
            }
          } else if (documentType === 'vehicleRegistration') {
            if (side === 'front') {
              setVehicleRegistrationFront(processedImage);
            } else {
              setVehicleRegistrationBack(processedImage);
            }
          } else if (documentType === 'vehicleAuthorization') {
            if (side === 'front') {
              setVehicleAuthorizationFront(processedImage);
            } else {
              setVehicleAuthorizationBack(processedImage);
            }
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

  const takePhoto = async (documentType, side) => {
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
            fileName: `${documentType}_${side}_${Date.now()}.jpg`,
            fileSize: compressedImage.fileSize,
            width: compressedImage.width,
            height: compressedImage.height,
          };
          
          console.log('Processed photo info:', processedImage);
          
          // Set the appropriate state based on document type and side
          if (documentType === 'license') {
            if (side === 'front') {
              setLicenseFront(processedImage);
            } else {
              setLicenseBack(processedImage);
            }
          } else if (documentType === 'vehicleRegistration') {
            if (side === 'front') {
              setVehicleRegistrationFront(processedImage);
            } else {
              setVehicleRegistrationBack(processedImage);
            }
          } else if (documentType === 'vehicleAuthorization') {
            if (side === 'front') {
              setVehicleAuthorizationFront(processedImage);
            } else {
              setVehicleAuthorizationBack(processedImage);
            }
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

  const showImagePicker = (documentType, side) => {
    setCurrentDocument(documentType);
    setCurrentSide(side);
    
    const documentNames = {
      license: 'bằng lái xe',
      vehicleRegistration: 'giấy chứng nhận đăng ký xe',
      vehicleAuthorization: 'giấy ủy quyền phương tiện'
    };
    
    const sideNames = {
      front: 'mặt trước',
      back: 'mặt sau'
    };
    
    Alert.alert(
      `Chọn ảnh ${sideNames[side]} ${documentNames[documentType]}`,
      'Chọn cách thức để tải ảnh',
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Chọn từ thư viện', onPress: () => pickImage(documentType, side) },
        { text: 'Chụp ảnh mới', onPress: () => takePhoto(documentType, side) }
      ]
    );
  };

  const submitVerification = async () => {
    // Check if all required documents are uploaded
    if (!licenseFront || !licenseBack || !vehicleRegistrationFront || !vehicleRegistrationBack) {
      Alert.alert('Thiếu giấy tờ', 'Vui lòng chụp đầy đủ bằng lái xe và giấy chứng nhận đăng ký xe (cả 2 mặt)');
      return;
    }

    setUploading(true);

    try {
      // Prepare documents grouped by type for separate API calls
      const documentFiles = {
        license: [
          {
            uri: licenseFront.uri,
            mimeType: licenseFront.type || 'image/jpeg',
            fileName: licenseFront.fileName || 'license_front.jpg',
            fileSize: licenseFront.fileSize,
          },
          {
            uri: licenseBack.uri,
            mimeType: licenseBack.type || 'image/jpeg',
            fileName: licenseBack.fileName || 'license_back.jpg',
            fileSize: licenseBack.fileSize,
          }
        ],
        vehicleRegistration: [
          {
            uri: vehicleRegistrationFront.uri,
            mimeType: vehicleRegistrationFront.type || 'image/jpeg',
            fileName: vehicleRegistrationFront.fileName || 'vehicle_registration_front.jpg',
            fileSize: vehicleRegistrationFront.fileSize,
          },
          {
            uri: vehicleRegistrationBack.uri,
            mimeType: vehicleRegistrationBack.type || 'image/jpeg',
            fileName: vehicleRegistrationBack.fileName || 'vehicle_registration_back.jpg',
            fileSize: vehicleRegistrationBack.fileSize,
          }
        ]
      };

      // Add vehicle authorization if provided
      if (vehicleAuthorizationFront && vehicleAuthorizationBack) {
        documentFiles.vehicleAuthorization = [
          {
            uri: vehicleAuthorizationFront.uri,
            mimeType: vehicleAuthorizationFront.type || 'image/jpeg',
            fileName: vehicleAuthorizationFront.fileName || 'vehicle_authorization_front.jpg',
            fileSize: vehicleAuthorizationFront.fileSize,
          },
          {
            uri: vehicleAuthorizationBack.uri,
            mimeType: vehicleAuthorizationBack.type || 'image/jpeg',
            fileName: vehicleAuthorizationBack.fileName || 'vehicle_authorization_back.jpg',
            fileSize: vehicleAuthorizationBack.fileSize,
          }
        ];
      }

      const result = await verificationService.submitDriverVerification(documentFiles);

      // After successful submission, refresh verification status
      try {
        const updatedVerification = await verificationService.getCurrentDriverVerification();
        setCurrentVerification(updatedVerification);
        console.log('Updated driver verification status:', updatedVerification);
      } catch (error) {
        console.log('Could not refresh driver verification status:', error);
      }

      Alert.alert(
        'Gửi thành công!',
        result.message || 'Giấy tờ tài xế đã được gửi để xác minh. Admin sẽ duyệt trong 1-2 ngày làm việc.',
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Navigate to Main screen after successful submission
              navigation.replace('Main');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Driver verification error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể gửi giấy tờ tài xế');
    } finally {
      setUploading(false);
    }
  };

  const renderDocumentSection = (
    documentType,
    title,
    description,
    frontImage,
    backImage,
  ) => {
    return (
      <Animatable.View animation="fadeInUp" duration={500} useNativeDriver>
        <CleanCard contentStyle={styles.documentCard}>
          <View style={styles.documentHeader}>
            <Text style={styles.documentTitle}>{title}</Text>
            <Text style={styles.documentDescription}>{description}</Text>
          </View>

          <View style={styles.imageRow}>
            {/* Front Image */}
            <View style={styles.imageColumn}>
              <Text style={styles.imageLabel}>Mặt trước</Text>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={() => showImagePicker(documentType, 'front')}
              >
                {frontImage ? (
                  <Image source={{ uri: frontImage.uri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="camera" size={28} color={colors.textMuted} />
                    <Text style={styles.placeholderText}>Chụp mặt trước</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Back Image */}
            <View style={styles.imageColumn}>
              <Text style={styles.imageLabel}>Mặt sau</Text>
              <TouchableOpacity
                style={styles.imageButton}
                onPress={() => showImagePicker(documentType, 'back')}
              >
                {backImage ? (
                  <Image source={{ uri: backImage.uri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="camera" size={28} color={colors.textMuted} />
                    <Text style={styles.placeholderText}>Chụp mặt sau</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </CleanCard>
      </Animatable.View>
    );
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Xác minh tài xế"
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
        >
          {/* Status block for pending/approved/inactive/rejected */}
          {(isPending || isApproved || isInactive || isRejected) && (
            <Animatable.View animation="fadeInDown" duration={450} useNativeDriver>
              <CleanCard contentStyle={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={styles.statusIcon}>
                    <Feather
                      name={
                        isApproved || isInactive
                          ? 'check-circle'
                          : isRejected
                          ? 'x-circle'
                          : 'clock'
                      }
                      size={20}
                      color={
                        isApproved || isInactive
                          ? '#22C55E'
                          : isRejected
                          ? '#EF4444'
                          : '#F59E0B'
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>
                      {isApproved
                        ? 'Đã xác minh tài xế'
                        : isInactive
                        ? 'Đã duyệt (chưa bật chế độ tài xế)'
                        : isRejected
                        ? 'Bị từ chối'
                        : 'Đang chờ duyệt'}
                    </Text>
                    <Text style={styles.statusText}>
                      {isApproved
                        ? 'Hồ sơ tài xế đã được phê duyệt. Bạn có thể chuyển sang chế độ tài xế để bắt đầu nhận chuyến.'
                        : isInactive
                        ? 'Hồ sơ đã duyệt. Chuyển sang chế độ tài xế để bắt đầu nhận chuyến.'
                        : isRejected
                        ? 'Giấy tờ bị từ chối. Vui lòng xem lý do trong thông báo và gửi lại.'
                        : 'Bạn đã gửi giấy tờ và đang chờ admin duyệt. Vui lòng chờ 1-2 ngày làm việc.'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={loadCurrentVerification} style={styles.refreshBtn}>
                  <Feather name="refresh-cw" size={16} color={colors.textPrimary} />
                  <Text style={styles.refreshText}>Làm mới trạng thái</Text>
                </TouchableOpacity>
                {(isApproved || isInactive) && (
                  <ModernButton
                    title={switching ? 'Đang chuyển...' : 'Chuyển sang chế độ tài xế'}
                    onPress={handleSwitchToDriver}
                    disabled={switching}
                    style={styles.switchButton}
                  />
                )}
              </CleanCard>
            </Animatable.View>
          )}

          {/* Form only when not pending/approved/inactive */}
          {!isPending && !isApproved && !isInactive && (
            <>
              <Animatable.View animation="fadeInUp" duration={500} useNativeDriver>
                <CleanCard variant="accent" contentStyle={styles.instructionsCard}>
                  <Feather name="info" size={20} color={colors.accent} />
                  <View style={styles.instructionsContent}>
                    <Text style={styles.instructionsTitle}>Hướng dẫn gửi giấy tờ</Text>
                    <Text style={styles.instructionsText}>
                      Vui lòng chụp rõ nét các giấy tờ sau để xác minh tài khoản tài xế:
                    </Text>
                    <Text style={styles.instructionsList}>
                      • Bằng lái xe (2 mặt){'\n'}
                      • Giấy chứng nhận đăng ký xe (2 mặt){'\n'}
                      • Giấy ủy quyền phương tiện (2 mặt) - nếu có
                    </Text>
                  </View>
                </CleanCard>
              </Animatable.View>

              {/* License Section */}
              {renderDocumentSection(
                'license',
                'Bằng lái xe',
                'Chụp ảnh mặt trước và mặt sau của bằng lái xe',
                licenseFront,
                licenseBack,
              )}

              {/* Vehicle Registration Section */}
              {renderDocumentSection(
                'vehicleRegistration',
                'Giấy chứng nhận đăng ký xe',
                'Chụp ảnh mặt trước và mặt sau của giấy chứng nhận đăng ký xe mô tô, xe gắn máy',
                vehicleRegistrationFront,
                vehicleRegistrationBack,
              )}

              {/* Vehicle Authorization Section (Optional) */}
              {renderDocumentSection(
                'vehicleAuthorization',
                'Giấy ủy quyền phương tiện (Tùy chọn)',
                'Nếu bạn không phải chủ xe, vui lòng chụp giấy ủy quyền phương tiện',
                vehicleAuthorizationFront,
                vehicleAuthorizationBack,
              )}

              {/* Submit Button */}
              <Animatable.View
                animation="fadeInUp"
                duration={500}
                useNativeDriver
                style={styles.submitContainer}
              >
                <ModernButton
                  title="Gửi giấy tờ xác minh"
                  onPress={submitVerification}
                  disabled={
                    uploading ||
                    !licenseFront ||
                    !licenseBack ||
                    !vehicleRegistrationFront ||
                    !vehicleRegistrationBack
                  }
                  loading={uploading}
                />
              </Animatable.View>
            </>
          )}
        </ScrollView>

        {/* Loading Overlay */}
        {uploading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Đang gửi giấy tờ...</Text>
            </View>
          </View>
        )}
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
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  instructionsContent: {
    flex: 1,
    gap: spacing.xs,
  },
  instructionsTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  instructionsText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  instructionsList: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  documentCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  documentTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  documentDescription: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  imageColumn: {
    flex: 1,
  },
  imageLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  imageButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 140,
    borderRadius: 16,
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: colors.glassLight,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  submitContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.body,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statusCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.glassLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  statusText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 4,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  refreshText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  switchButton: {
    marginTop: spacing.sm,
  },
});

export default DriverVerificationScreen;
