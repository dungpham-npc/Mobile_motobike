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
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import verificationService from '../../services/verificationService';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { colors, gradients } from '../../theme/designTokens';

const StudentVerificationScreen = ({ navigation }) => {
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentSide, setCurrentSide] = useState('front'); // 'front' or 'back'
  const [currentVerification, setCurrentVerification] = useState(null);

  // Load current verification status
  useEffect(() => {
    loadCurrentVerification();
  }, []);

  const loadCurrentVerification = async () => {
    try {
      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentVerification(verification);
      
      // If user already has pending verification, show alert and go back
      if (verification && verification.status?.toLowerCase() === 'pending') {
        Alert.alert(
          'Đang chờ duyệt',
          'Bạn đã gửi yêu cầu xác minh và đang chờ admin duyệt. Vui lòng chờ kết quả.',
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
        result.message || 'Thẻ sinh viên đã được gửi để xác minh. Admin sẽ duyệt trong 1-2 ngày làm việc.',
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
      console.error('Student verification error:', error);
      Alert.alert('Lỗi', error.message || 'Không thể gửi thẻ sinh viên');
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        {/* Header */}
        <LinearGradient
          colors={gradients.hero}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                // If user came from login, go to Main screen
                // Otherwise, go back normally
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.replace('Main');
                }
              }}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Xác minh sinh viên</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Instructions */}
          <Animatable.View animation="fadeInUp" style={styles.cardWrapper}>
            <CleanCard contentStyle={styles.instructionsCard}>
              <View style={styles.instructionsIcon}>
                <Icon name="school" size={40} color={colors.primary} />
              </View>
              <Text style={styles.instructionsTitle}>Xác minh tài khoản sinh viên</Text>
              <Text style={styles.instructionsText}>
                Để sử dụng dịch vụ, bạn cần xác minh là sinh viên của trường. 
                Vui lòng chụp ảnh thẻ sinh viên rõ nét.
              </Text>
            </CleanCard>
          </Animatable.View>

          {/* Requirements */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.requirementsCard}>
            <Text style={styles.cardTitle}>Yêu cầu ảnh thẻ sinh viên</Text>
            <View style={styles.requirementsList}>
              <View style={styles.requirementItem}>
                <Icon name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.requirementText}>Ảnh rõ nét, không bị mờ</Text>
              </View>
              <View style={styles.requirementItem}>
                <Icon name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.requirementText}>Hiển thị đầy đủ thông tin trên thẻ</Text>
              </View>
              <View style={styles.requirementItem}>
                <Icon name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.requirementText}>Thẻ còn hiệu lực</Text>
              </View>
              <View style={styles.requirementItem}>
                <Icon name="check-circle" size={20} color={colors.primary} />
                <Text style={styles.requirementText}>Định dạng JPG, PNG (tối đa 5MB)</Text>
              </View>
            </View>
          </CleanCard>

          {/* Front Image Upload Section */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.uploadSection}>
            <Text style={styles.cardTitle}>Mặt trước thẻ sinh viên</Text>
            
            {frontImage ? (
              <Animatable.View animation="fadeIn" style={styles.selectedImageContainer}>
                <Image source={{ uri: frontImage.uri }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.changeImageButton}
                  onPress={() => showImagePicker('front')}
                >
                  <Icon name="edit" size={20} color={colors.primary} />
                  <Text style={styles.changeImageText}>Đổi ảnh</Text>
                </TouchableOpacity>
              </Animatable.View>
            ) : (
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={() => showImagePicker('front')}
              >
                <LinearGradient
                  colors={gradients.pillActive}
                  style={styles.uploadButtonGradient}
                >
                  <Icon name="camera-alt" size={48} color="#fff" />
                  <Text style={styles.uploadButtonText}>Chụp mặt trước</Text>
                  <Text style={styles.uploadButtonSubtext}>Chụp ảnh hoặc chọn từ thư viện</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </CleanCard>

          {/* Back Image Upload Section */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.uploadSection}>
            <Text style={styles.cardTitle}>Mặt sau thẻ sinh viên</Text>
            
            {backImage ? (
              <Animatable.View animation="fadeIn" style={styles.selectedImageContainer}>
                <Image source={{ uri: backImage.uri }} style={styles.selectedImage} />
                <TouchableOpacity 
                  style={styles.changeImageButton}
                  onPress={() => showImagePicker('back')}
                >
                  <Icon name="edit" size={20} color={colors.primary} />
                  <Text style={styles.changeImageText}>Đổi ảnh</Text>
                </TouchableOpacity>
              </Animatable.View>
            ) : (
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={() => showImagePicker('back')}
              >
                <LinearGradient
                  colors={gradients.pillActive}
                  style={styles.uploadButtonGradient}
                >
                  <Icon name="camera-alt" size={48} color="#fff" />
                  <Text style={styles.uploadButtonText}>Chụp mặt sau</Text>
                  <Text style={styles.uploadButtonSubtext}>Chụp ảnh hoặc chọn từ thư viện</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </CleanCard>

          {/* Sample Image */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.sampleSection}>
            <Text style={styles.cardTitle}>Ảnh mẫu</Text>
              <View style={styles.sampleImageContainer}>
              <View style={styles.sampleImagePlaceholder}>
                <Icon name="credit-card" size={64} color="rgba(148,163,184,0.6)" />
                <Text style={styles.sampleImageText}>Mẫu thẻ sinh viên</Text>
              </View>
              <Text style={styles.sampleDescription}>
                Chụp ảnh thẻ sinh viên như mẫu trên, đảm bảo thông tin rõ ràng và đầy đủ
              </Text>
            </View>
          </CleanCard>

          {/* Submit Button */}
          <ModernButton
            title={uploading ? "Đang gửi..." : "Gửi để xác minh"}
            onPress={submitVerification}
            disabled={!frontImage || !backImage || uploading}
            icon={uploading ? null : "send"}
            style={styles.submitButton}
          />

          {/* Skip Button for Testing */}
          {__DEV__ && (
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={() => {
                Alert.alert(
                  'Bỏ qua xác minh',
                  'Bạn có chắc chắn muốn bỏ qua xác minh? (Chỉ để test)',
                  [
                    { text: 'Hủy', style: 'cancel' },
                    { 
                      text: 'Bỏ qua', 
                      onPress: () => navigation.replace('Main')
                    }
                  ]
                );
              }}
            >
              <Text style={styles.skipButtonText}>Bỏ qua tạm thời (Test)</Text>
            </TouchableOpacity>
          )}

          {uploading && (
            <View style={styles.uploadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.uploadingText}>Đang tải lên và xử lý...</Text>
            </View>
          )}

          {/* Info */}
          <CleanCard style={styles.cardWrapper} contentStyle={styles.infoCard}>
            <Icon name="info" size={20} color="#F59E0B" />
            <Text style={styles.infoText}>
              Quá trình xác minh có thể mất 1-2 ngày làm việc. 
              Chúng tôi sẽ thông báo kết quả qua email.
            </Text>
          </CleanCard>
        </View>
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
    paddingTop: 12,
    paddingBottom: 140,
  },
  header: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 28,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    backgroundColor: colors.glassLight,
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardWrapper: {
    marginBottom: 20,
  },
  instructionsCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  instructionsIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(24,78,63,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  instructionsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  requirementsCard: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 18,
  },
  requirementsList: {},
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  requirementText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  uploadSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  uploadButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 18,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 14,
  },
  uploadButtonSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  selectedImageContainer: {
    alignItems: 'center',
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    resizeMode: 'cover',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  changeImageText: {
    fontSize: 15,
    color: colors.accent,
    marginLeft: 8,
    fontWeight: '600',
  },
  sampleSection: {
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  sampleImageContainer: {
    alignItems: 'center',
  },
  sampleImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: colors.glassLight,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  sampleImageText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  sampleDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  submitButton: {
    marginBottom: 16,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadingText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    lineHeight: 20,
  },
  skipButton: {
    backgroundColor: colors.glassLight,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  skipButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default StudentVerificationScreen;
