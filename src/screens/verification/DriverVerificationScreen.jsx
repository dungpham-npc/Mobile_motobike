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
import authService from '../../services/authService';
import verificationService from '../../services/verificationService';
import { ApiError } from '../../services/api';

const DriverVerificationScreen = ({ navigation }) => {
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

  const renderDocumentSection = (documentType, title, description, frontImage, backImage, setFrontImage, setBackImage) => {
    return (
      <Animatable.View animation="fadeInUp" style={styles.documentSection}>
        <Text style={styles.documentTitle}>{title}</Text>
          <Text style={styles.documentDescription}>{description}</Text>
        
        <View style={styles.imageContainer}>
          {/* Front Image */}
          <View style={styles.imageWrapper}>
            <Text style={styles.imageLabel}>Mặt trước</Text>
            <TouchableOpacity 
              style={styles.imageButton}
              onPress={() => showImagePicker(documentType, 'front')}
            >
              {frontImage ? (
                <Image source={{ uri: frontImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Icon name="add-a-photo" size={40} color="#ccc" />
                  <Text style={styles.placeholderText}>Chụp mặt trước</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Back Image */}
          <View style={styles.imageWrapper}>
            <Text style={styles.imageLabel}>Mặt sau</Text>
          <TouchableOpacity 
              style={styles.imageButton}
              onPress={() => showImagePicker(documentType, 'back')}
            >
              {backImage ? (
                <Image source={{ uri: backImage.uri }} style={styles.imagePreview} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Icon name="add-a-photo" size={40} color="#ccc" />
                  <Text style={styles.placeholderText}>Chụp mặt sau</Text>
                </View>
              )}
          </TouchableOpacity>
          </View>
      </View>
      </Animatable.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#FF9800', '#F57C00']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Xác minh tài xế</Text>
            <View style={styles.placeholder} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Instructions */}
          <Animatable.View animation="fadeInUp" style={styles.instructionsCard}>
            <Icon name="info" size={24} color="#FF9800" />
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
          </Animatable.View>

          {/* License Section */}
          {renderDocumentSection(
            'license',
            'Bằng lái xe',
            'Chụp ảnh mặt trước và mặt sau của bằng lái xe',
            licenseFront,
            licenseBack,
            setLicenseFront,
            setLicenseBack
          )}

          {/* Vehicle Registration Section */}
          {renderDocumentSection(
            'vehicleRegistration',
            'Giấy chứng nhận đăng ký xe',
            'Chụp ảnh mặt trước và mặt sau của giấy chứng nhận đăng ký xe mô tô, xe gắn máy',
            vehicleRegistrationFront,
            vehicleRegistrationBack,
            setVehicleRegistrationFront,
            setVehicleRegistrationBack
          )}

          {/* Vehicle Authorization Section (Optional) */}
          {renderDocumentSection(
            'vehicleAuthorization',
            'Giấy ủy quyền phương tiện (Tùy chọn)',
            'Nếu bạn không phải chủ xe, vui lòng chụp giấy ủy quyền phương tiện',
            vehicleAuthorizationFront,
            vehicleAuthorizationBack,
            setVehicleAuthorizationFront,
            setVehicleAuthorizationBack
          )}

          {/* Submit Button */}
          <Animatable.View animation="fadeInUp" style={styles.submitContainer}>
          <ModernButton
              title="Gửi giấy tờ xác minh"
            onPress={submitVerification}
              disabled={uploading || !licenseFront || !licenseBack || !vehicleRegistrationFront || !vehicleRegistrationBack}
              loading={uploading}
          />
          </Animatable.View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
          {uploading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FF9800" />
            <Text style={styles.loadingText}>Đang gửi giấy tờ...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsContent: {
    flex: 1,
    marginLeft: 12,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  instructionsList: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  documentSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  documentDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  imageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageWrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  imageButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  submitContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 12,
  },
});

export default DriverVerificationScreen;