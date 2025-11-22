import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Feather from 'react-native-vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Animatable from 'react-native-animatable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ModernButton from '../../components/ModernButton.jsx';
import verificationService from '../../services/verificationService';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { colors, gradients } from '../../theme/designTokens';

const DriverVerificationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // State for each document type
  const [licenseFront, setLicenseFront] = useState(null);
  const [licenseBack, setLicenseBack] = useState(null);
  const [vehicleRegistrationFront, setVehicleRegistrationFront] = useState(null);
  const [vehicleRegistrationBack, setVehicleRegistrationBack] = useState(null);
  const [vehicleAuthorizationFront, setVehicleAuthorizationFront] = useState(null);
  const [vehicleAuthorizationBack, setVehicleAuthorizationBack] = useState(null);
  
  const [uploading, setUploading] = useState(false);
  const [currentDocument, setCurrentDocument] = useState('license'); // license, vehicleRegistration, vehicleAuthorization
  const [currentSide, setCurrentSide] = useState('front'); // front, back
  const [currentVerification, setCurrentVerification] = useState(null);

  // Load current verification status
  useEffect(() => {
    loadCurrentVerification();
  }, []);

  const loadCurrentVerification = async () => {
    try {
      // First check if user has rider verification (required for driver verification)
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
      
      // If user already has pending verification, show alert and go back
      if (verification && verification.status?.toLowerCase() === 'pending') {
        Alert.alert(
          'Đang chờ duyệt',
          'Bạn đã gửi yêu cầu xác minh tài xế và đang chờ admin duyệt. Vui lòng chờ kết quả.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      
      // If user already verified, show alert and go back
      if (verification && (verification.status?.toLowerCase() === 'verified' || verification.status?.toLowerCase() === 'approved' || verification.status?.toLowerCase() === 'active')) {
        Alert.alert(
          'Đã xác minh',
          'Tài khoản tài xế của bạn đã được xác minh.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      // If user's verification was rejected, just log it (don't show alert again)
      // The alert was already shown in ProfileSwitchScreen
      if (verification && verification.status?.toLowerCase() === 'rejected') {
        console.log('User has rejected driver verification, allowing resubmission');
        // Continue with the form to allow resubmission
        return;
      }
    } catch (error) {
      console.log('No current driver verification found or error:', error);
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

  const renderDocumentSection = () => null; // legacy kept to avoid accidental usage

  const renderUploadSlot = (documentType, side, image, setImage, buttonText) => (
    <View style={styles.uploadSlot}>
      <Text style={styles.imageLabel}>{side === 'front' ? 'Mặt trước' : 'Mặt sau'}</Text>
      {image ? (
        <Animatable.View animation="fadeIn" style={styles.selectedImageContainer}>
          <Image source={{ uri: image.uri }} style={styles.selectedImage} />
          <TouchableOpacity 
            style={styles.changeImageButton}
            onPress={() => showImagePicker(documentType, side)}
          >
            <Icon name="edit" size={18} color={colors.accent} />
            <Text style={styles.changeImageText}>Đổi ảnh</Text>
          </TouchableOpacity>
        </Animatable.View>
      ) : (
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={() => showImagePicker(documentType, side)}
        >
          <LinearGradient colors={gradients.pillActive} style={styles.uploadButtonGradient}>
            <Icon name="camera-alt" size={32} color="#fff" />
            <Text style={styles.uploadButtonText}>{buttonText}</Text>
            <Text style={styles.uploadButtonSubtext}>Chụp ảnh hoặc chọn từ thư viện</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <AppBackground>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.safe}>
        {/* Floating back button */}
        <TouchableOpacity 
          style={[styles.floatingBackButton, { top: insets.top + 12 }]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.replace('Main');
            }
          }}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header text */}
          <View style={styles.headerTextSection}>
            <Text style={styles.headerSubtitle}>Gửi giấy tờ xác minh</Text>
            <Text style={styles.headerTitle}>Xác minh tài xế</Text>
          </View>

          {/* Instructions */}
          <Animatable.View animation="fadeInUp" style={styles.cardWrapper}>
            <CleanCard contentStyle={styles.instructionsCard}>
              <View style={styles.instructionsIconWrap}>
                <Icon name="two-wheeler" size={40} color={colors.primary} />
              </View>
              <Text style={styles.instructionsTitle}>Hướng dẫn gửi giấy tờ</Text>
              <Text style={styles.instructionsText}>Vui lòng chụp rõ nét các giấy tờ sau để xác minh tài khoản tài xế:</Text>
              <View style={styles.requirementsList}>
                <View style={styles.requirementItem}><Icon name="check-circle" size={20} color={colors.primary} /><Text style={styles.requirementText}>Bằng lái xe (2 mặt)</Text></View>
                <View style={styles.requirementItem}><Icon name="check-circle" size={20} color={colors.primary} /><Text style={styles.requirementText}>Giấy chứng nhận đăng ký xe (2 mặt)</Text></View>
                <View style={styles.requirementItem}><Icon name="check-circle" size={20} color={colors.primary} /><Text style={styles.requirementText}>Giấy ủy quyền phương tiện (nếu có)</Text></View>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* License Section */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.uploadSection}>
            <Text style={styles.cardTitle}>Bằng lái xe</Text>
            <Text style={styles.cardDescription}>Chụp ảnh mặt trước và mặt sau của bằng lái</Text>
            <View style={styles.rowUploads}>
              {renderUploadSlot('license', 'front', licenseFront, setLicenseFront, 'Chụp mặt trước')}
              {renderUploadSlot('license', 'back', licenseBack, setLicenseBack, 'Chụp mặt sau')}
            </View>
          </CleanCard>

          {/* Vehicle Registration Section */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.uploadSection}>
            <Text style={styles.cardTitle}>Giấy chứng nhận đăng ký xe</Text>
            <Text style={styles.cardDescription}>Chụp ảnh 2 mặt giấy đăng ký mô tô/xe gắn máy</Text>
            <View style={styles.rowUploads}>
              {renderUploadSlot('vehicleRegistration', 'front', vehicleRegistrationFront, setVehicleRegistrationFront, 'Chụp mặt trước')}
              {renderUploadSlot('vehicleRegistration', 'back', vehicleRegistrationBack, setVehicleRegistrationBack, 'Chụp mặt sau')}
            </View>
          </CleanCard>

          {/* Vehicle Authorization Section (Optional) */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.uploadSection}>
            <Text style={styles.cardTitle}>Giấy ủy quyền phương tiện (Tùy chọn)</Text>
            <Text style={styles.cardDescription}>Nếu bạn không phải chủ xe, vui lòng chụp ảnh 2 mặt giấy ủy quyền</Text>
            <View style={styles.rowUploads}>
              {renderUploadSlot('vehicleAuthorization', 'front', vehicleAuthorizationFront, setVehicleAuthorizationFront, 'Mặt trước')}
              {renderUploadSlot('vehicleAuthorization', 'back', vehicleAuthorizationBack, setVehicleAuthorizationBack, 'Mặt sau')}
            </View>
          </CleanCard>

          {/* Submit Button */}
          <ModernButton
            title={uploading ? 'Đang gửi...' : 'Gửi giấy tờ xác minh'}
            onPress={submitVerification}
            disabled={uploading || !licenseFront || !licenseBack || !vehicleRegistrationFront || !vehicleRegistrationBack}
            style={styles.submitButton}
          />

          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.uploadingText}>Đang tải lên và xử lý...</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    top: 12,
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
  scrollContent: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 140, gap: 24 },
  headerTextSection: { alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  headerTitle: { fontSize: 18, color: colors.textPrimary, fontWeight: '600' },

  cardWrapper: { },
  instructionsCard: { alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 22 },
  instructionsIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(24,78,63,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  instructionsTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  instructionsText: { fontSize: 14, color: colors.textSecondary, marginBottom: 10 },
  requirementsList: { },
  requirementItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  requirementText: { fontSize: 14, color: colors.textSecondary, marginLeft: 8 },

  uploadSection: { paddingHorizontal: 20, paddingVertical: 22 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  cardDescription: { fontSize: 14, color: colors.textSecondary, marginBottom: 14 },
  rowUploads: { flexDirection: 'row', gap: 12 },
  uploadSlot: { flex: 1 },
  imageLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, textAlign: 'center' },
  uploadButton: { borderRadius: 16, overflow: 'hidden' },
  uploadButtonGradient: { padding: 22, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 16, height: 160, justifyContent: 'center' },
  uploadButtonText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 10 },
  uploadButtonSubtext: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  selectedImageContainer: { alignItems: 'center' },
  selectedImage: { width: '100%', height: 160, borderRadius: 16, resizeMode: 'cover' },
  changeImageButton: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 8 },
  changeImageText: { fontSize: 14, color: colors.accent, marginLeft: 6, fontWeight: '600' },

  submitButton: { marginTop: 4 },
  uploadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  uploadingText: { fontSize: 14, color: colors.primary, marginLeft: 8 },
});

export default DriverVerificationScreen;