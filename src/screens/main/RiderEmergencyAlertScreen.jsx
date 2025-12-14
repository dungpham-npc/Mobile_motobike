import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import GlassHeader from '../../components/ui/GlassHeader';
import CleanCard from '../../components/ui/CleanCard';
import sosService from '../../services/sosService';
import locationService from '../../services/LocationService';

const { width, height } = Dimensions.get('window');

const RiderEmergencyAlertScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [description, setDescription] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  const holdTimer = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const defaultContacts = [
    { name: 'Cảnh sát', nameEn: 'Police', phone: '113', icon: 'police-badge', color: '#007AFF' },
    { name: 'Cứu thương', nameEn: 'Ambulance', phone: '115', icon: 'ambulance', color: '#FF3B30' },
    { name: 'Cứu hỏa', nameEn: 'Fire Department', phone: '114', icon: 'fire-truck', color: '#FF9500' },
    { name: 'Hỗ trợ MSSUS', nameEn: 'MSSUS Support', phone: '1900-1234', icon: 'headset', color: '#34C759' },
  ];

  useEffect(() => {
    if (isHolding) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Start progress animation
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 5000,
        useNativeDriver: false,
      }).start();

      // Countdown timer
      let progress = 0;
      holdTimer.current = setInterval(() => {
        progress += 0.2; // Update every 200ms for 5 seconds
        setHoldProgress(progress);
        
        if (progress >= 5) {
          handleHoldComplete();
        }
      }, 200);
    } else {
      // Stop animations and reset
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
      
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
      }
      setHoldProgress(0);
    }

    return () => {
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
      }
    };
  }, [isHolding]);

  const handlePressIn = () => {
    setIsHolding(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setIsHolding(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleHoldComplete = async () => {
    setIsHolding(false);
    
    // Get current location
    try {
      const location = await locationService.getCurrentLocation();
      setCurrentLocation(location);
    } catch (error) {
      const cachedLocation = locationService.getCachedLocation();
      if (cachedLocation) {
        setCurrentLocation(cachedLocation);
      } else {
        Alert.alert(
          'Lỗi vị trí',
          'Không thể lấy vị trí hiện tại. Vui lòng bật định vị.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    setShowConfirmModal(true);
  };

  const handleConfirmSOS = async () => {
    if (!currentLocation) {
      Alert.alert('Lỗi', 'Không có thông tin vị trí');
      return;
    }

    setIsSending(true);

    try {
      const sosData = {
        role: 'rider',
        description: description || 'SOS được kích hoạt bởi rider',
      };

      await sosService.triggerAlert(sosData);
      
      setIsSending(false);
      setShowConfirmModal(false);
      setDescription('');
      
      Alert.alert(
        'Đã gửi cảnh báo SOS!',
        'Liên hệ khẩn cấp và quản trị viên đã được thông báo.\n\n✓ SMS đã gửi đến liên hệ khẩn cấp\n✓ Quản trị viên đã nhận thông báo\n✓ Vị trí hiện tại đã được chia sẻ',
        [
          {
            text: 'Xem chi tiết',
            onPress: () => navigation.navigate('MySOSAlerts'),
          },
        ]
      );
    } catch (error) {
      setIsSending(false);
      Alert.alert('Lỗi', error.message || 'Không thể gửi cảnh báo SOS');
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setDescription('');
    setCurrentLocation(null);
  };

  const handleCall = (contact) => {
    Alert.alert(
      'Gọi khẩn cấp',
      `Bạn có muốn gọi cho ${contact.name}?`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Gọi ngay',
          onPress: () => {
            const phoneNumber = `tel:${contact.phone}`;
            Linking.openURL(phoneNumber).catch(() => {
              Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi');
            });
          },
        },
      ]
    );
  };

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 59, 48, 0.3)', 'rgba(255, 59, 48, 1)'],
  });

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <GlassHeader
          title="Cảnh báo khẩn cấp"
          onBack={() => navigation.goBack()}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Warning Card */}
          <CleanCard style={styles.warningCard}>
            <View style={styles.warningIconContainer}>
              <Icon name="alert" size={32} color="#FF3B30" />
            </View>
            <Text style={styles.warningTitle}>Cảnh báo khẩn cấp</Text>
            <Text style={styles.warningText}>
              Chỉ sử dụng trong trường hợp thực sự khẩn cấp.
              Giữ nút SOS trong 5 giây để kích hoạt.
            </Text>
          </CleanCard>

          {/* SOS Trigger Button */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kích hoạt SOS</Text>
            <Text style={styles.sectionSubtitle}>
              Giữ nút trong 5 giây để gửi cảnh báo khẩn cấp
            </Text>
            
            <View style={styles.sosButtonContainer}>
              <Animated.View
                style={[
                  styles.sosButtonWrapper,
                  {
                    transform: [{ scale: scaleAnim }],
                  },
                ]}
              >
                {isHolding && (
                  <Animated.View
                    style={[
                      styles.pulseCircle,
                      {
                        transform: [{ scale: pulseAnim }],
                      },
                    ]}
                  />
                )}
                
                <Animated.View style={styles.progressCircle}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: progressColor,
                        opacity: progressAnim,
                      },
                    ]}
                  />
                </Animated.View>

                <TouchableOpacity
                  activeOpacity={0.9}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  style={styles.sosButton}
                >
                  <LinearGradient
                    colors={['#FF3B30', '#FF6B6B']}
                    style={styles.sosButtonGradient}
                  >
                    <Icon name="alert-octagon" size={80} color="#FFFFFF" />
                    <Text style={styles.sosButtonText}>SOS</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              {isHolding && (
                <Animatable.View
                  animation="fadeIn"
                  style={styles.holdingTextContainer}
                >
                  <Text style={styles.holdingText}>Đang giữ...</Text>
                  <Text style={styles.countdownText}>
                    Giữ trong {Math.ceil(5 - holdProgress)}s
                  </Text>
                </Animatable.View>
              )}

              {!isHolding && (
                <View style={styles.instructionContainer}>
                  <Text style={styles.instructionText}>
                    Giữ nút trong 5 giây để kích hoạt cảnh báo khẩn cấp
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.helperText}>
              💡 Sau khi xác nhận, hệ thống sẽ tự động:
              {'\n'}• Gửi SMS cho liên hệ khẩn cấp
              {'\n'}• Thông báo quản trị viên
              {'\n'}• Chia sẻ vị trí hiện tại
            </Text>
          </View>

          {/* Emergency Contacts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gọi điện khẩn cấp</Text>
            <Text style={styles.sectionSubtitle}>
              Số điện thoại khẩn cấp để gọi trực tiếp
            </Text>
            {defaultContacts.map((contact, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleCall(contact)}
                activeOpacity={0.7}
              >
                <CleanCard style={styles.contactCard}>
                  <View style={[styles.contactIconContainer, { backgroundColor: contact.color + '20' }]}>
                    <Icon name={contact.icon} size={28} color={contact.color} />
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  </View>
                  <View style={[styles.callButton, { backgroundColor: contact.color }]}>
                    <Icon name="phone" size={20} color="#FFFFFF" />
                  </View>
                </CleanCard>
              </TouchableOpacity>
            ))}
          </View>

          {/* Safety Tips */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lưu ý quan trọng</Text>
            <CleanCard style={styles.tipsCard}>
              <View style={styles.tip}>
                <Icon name="shield-alert" size={20} color="#FF9500" />
                <Text style={styles.tipText}>
                  <Text style={styles.tipTextBold}>Thêm liên hệ khẩn cấp</Text> trong hồ sơ để nhận hỗ trợ nhanh hơn
                </Text>
              </View>
              <View style={styles.tip}>
                <Icon name="shield-check" size={20} color="#34C759" />
                <Text style={styles.tipText}>
                  Hệ thống tự động gửi SMS + vị trí đến liên hệ khẩn cấp
                </Text>
              </View>
              <View style={styles.tip}>
                <Icon name="shield-check" size={20} color="#34C759" />
                <Text style={styles.tipText}>
                  Nếu không có liên hệ, hệ thống sẽ gọi 113 tự động
                </Text>
              </View>
              <View style={styles.tip}>
                <Icon name="clock-alert" size={20} color="#5856d6" />
                <Text style={styles.tipText}>
                  Cảnh báo sẽ tự động escalate nếu không được xử lý sau 2 phút
                </Text>
              </View>
            </CleanCard>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View
            animation="zoomIn"
            duration={300}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Icon name="alert-octagon" size={60} color="#FF3B30" />
              <Text style={styles.modalTitle}>Xác nhận SOS</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalWarning}>
                Bạn sắp kích hoạt cảnh báo SOS. Liên hệ khẩn cấp và quản trị viên sẽ được thông báo ngay lập tức.
              </Text>

              {currentLocation && (
                <View style={styles.locationInfo}>
                  <Icon name="map-marker" size={20} color="#666" />
                  <Text style={styles.locationText}>
                    Vị trí: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                </View>
              )}

              <View style={styles.notificationInfo}>
                <Icon name="bell-ring" size={20} color="#FF9500" />
                <Text style={styles.notificationText}>
                  Liên hệ khẩn cấp sẽ nhận được SMS với thông tin vị trí của bạn
                </Text>
              </View>

              <Text style={styles.descriptionLabel}>Mô tả (không bắt buộc):</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Ví dụ: Tôi cần giúp đỡ khẩn cấp..."
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelConfirm}
                disabled={isSending}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSOS}
                disabled={isSending}
              >
                <LinearGradient
                  colors={['#FF3B30', '#FF6B6B']}
                  style={styles.confirmButtonGradient}
                >
                  {isSending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Icon name="alert-octagon" size={20} color="#FFFFFF" />
                      <Text style={styles.confirmButtonText}>Xác nhận SOS</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  warningCard: {
    alignItems: 'center',
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  warningIconContainer: {
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    lineHeight: 20,
  },
  sosButtonContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  sosButtonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
  },
  progressCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  sosButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosButtonText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: 2,
  },
  holdingTextContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  holdingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  countdownText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FF3B30',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  contactIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipsCard: {
    padding: 16,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  tipTextBold: {
    fontWeight: '700',
    color: '#1a1a1a',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFF5F5',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FF3B30',
    marginTop: 12,
  },
  modalBody: {
    padding: 24,
  },
  modalWarning: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5E6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  notificationText: {
    fontSize: 13,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default RiderEmergencyAlertScreen;

