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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import GlassHeader from '../../components/ui/GlassHeader';
import CleanCard from '../../components/ui/CleanCard';
import sosService from '../../services/sosService';

const { width } = Dimensions.get('window');

const DriverEmergencyAlertScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState(null);
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const emergencyTypes = [
    {
      id: 'TRAFFIC_ACCIDENT',
      name: 'Tai nạn giao thông',
      nameEn: 'Traffic Accident',
      icon: 'car-crash',
      color: '#FF3B30',
      priority: 'high',
      gradient: ['#FF3B30', '#FF6B6B'],
    },
    {
      id: 'VEHICLE_BREAKDOWN',
      name: 'Xe hỏng',
      nameEn: 'Vehicle Breakdown',
      icon: 'car-wrench',
      color: '#FF9500',
      priority: 'medium',
      gradient: ['#FF9500', '#FFB84D'],
    },
    {
      id: 'PERSONAL_SAFETY',
      name: 'An toàn cá nhân',
      nameEn: 'Personal Safety',
      icon: 'shield-alert',
      color: '#AF52DE',
      priority: 'high',
      gradient: ['#AF52DE', '#DA70D6'],
    },
    {
      id: 'OTHER',
      name: 'Khác',
      nameEn: 'Other',
      icon: 'alert-circle',
      color: '#8E8E93',
      priority: 'medium',
      gradient: ['#8E8E93', '#AEAEB2'],
    },
  ];

  const defaultContacts = [
    { name: 'Cảnh sát', nameEn: 'Police', phone: '113', icon: 'police-badge', color: '#007AFF' },
    { name: 'Cứu thương', nameEn: 'Ambulance', phone: '115', icon: 'ambulance', color: '#FF3B30' },
    { name: 'Cứu hỏa', nameEn: 'Fire Department', phone: '114', icon: 'fire-truck', color: '#FF9500' },
    { name: 'Hỗ trợ MSSUS', nameEn: 'MSSUS Support', phone: '1900-1234', icon: 'headset', color: '#34C759' },
  ];

  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
        
        // Animate countdown
        Animated.sequence([
          Animated.timing(countdownAnim, {
            toValue: 1.2,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(countdownAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (isCountingDown && countdown === 0) {
      handleTriggerSOS();
    }
  }, [countdown, isCountingDown]);

  useEffect(() => {
    if (isCountingDown) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [isCountingDown]);

  const handleSelectEmergencyType = (type) => {
    setSelectedType(type);
    setCountdown(5);
    setIsCountingDown(true);
  };

  const handleCancelAlert = () => {
    setIsCountingDown(false);
    setSelectedType(null);
    setCountdown(5);
    countdownAnim.setValue(1);
  };

  const handleTriggerSOS = async () => {
    setIsCountingDown(false);
    setIsSending(true);

    try {
      const sosData = {
        role: 'driver',
        description: `Cảnh báo khẩn cấp: ${selectedType?.name}`,
      };

      const response = await sosService.triggerAlert(sosData);
      
      setIsSending(false);
      
      Alert.alert(
        'Đã gửi cảnh báo',
        'Cảnh báo khẩn cấp đã được gửi!\n\n✓ Liên hệ khẩn cấp đã nhận SMS\n✓ Quản trị viên đã được thông báo\n✓ Vị trí đã được chia sẻ',
        [
          {
            text: 'Đóng',
            onPress: () => {
              setSelectedType(null);
              setCountdown(5);
              // Navigate to My SOS Alerts to see the alert
              navigation.navigate('MySOSAlerts');
            },
          },
        ]
      );
    } catch (error) {
      setIsSending(false);
      Alert.alert('Lỗi', error.message || 'Không thể gửi cảnh báo khẩn cấp');
      handleCancelAlert();
    }
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


  if (isCountingDown && selectedType) {
    return (
      <LinearGradient
        colors={selectedType.gradient}
        style={styles.countdownContainer}
      >
        <SafeAreaView style={styles.countdownContent}>
          <Animatable.View
            animation="pulse"
            iterationCount="infinite"
            style={styles.countdownIconContainer}
          >
            <Icon name="alert-octagon" size={120} color="#FFFFFF" />
          </Animatable.View>

          <Text style={styles.countdownTitle}>CẢNH BÁO KHẨN CẤP</Text>
          <Text style={styles.countdownSubtitle}>{selectedType.name}</Text>

          <Text style={styles.countdownLabel}>
            Gửi cảnh báo trong {countdown} giây
          </Text>

          <Animated.View
            style={[
              styles.countdownNumberContainer,
              {
                transform: [{ scale: countdownAnim }],
              },
            ]}
          >
            <Text style={styles.countdownNumber}>{countdown}</Text>
          </Animated.View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelAlert}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>HỦY CẢNH BÁO</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
            <Text style={styles.warningTitle}>Cảnh báo quan trọng</Text>
            <Text style={styles.warningText}>
              Chỉ sử dụng tính năng này trong trường hợp thực sự khẩn cấp.
              Việc lạm dụng có thể bị xử lý theo quy định.
            </Text>
          </CleanCard>

          {/* Emergency Types */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kích hoạt cảnh báo khẩn cấp</Text>
            <Text style={styles.sectionSubtitle}>
              Chọn loại khẩn cấp để gửi cảnh báo đến liên hệ khẩn cấp và quản trị viên
            </Text>
            <View style={styles.typesGrid}>
              {emergencyTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={styles.typeCard}
                  onPress={() => handleSelectEmergencyType(type)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={type.gradient}
                    style={styles.typeGradient}
                  >
                    <Icon name={type.icon} size={40} color="#FFFFFF" />
                    <Text style={styles.typeName}>{type.name}</Text>
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityText}>
                        {type.priority === 'high' ? 'Ưu tiên cao' : 'Ưu tiên vừa'}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              💡 Sau khi chọn, hệ thống sẽ tự động:
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
    marginBottom: 12,
    paddingHorizontal: 4,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    lineHeight: 20,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  typeCard: {
    width: (width - 44) / 2,
    margin: 6,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  typeGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 160,
    justifyContent: 'center',
  },
  typeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    textAlign: 'center',
  },
  priorityBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  priorityText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
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
    alignItems: 'center',
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
  // Countdown Screen Styles
  countdownContainer: {
    flex: 1,
  },
  countdownContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  countdownIconContainer: {
    marginBottom: 40,
  },
  countdownTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  countdownSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 60,
    opacity: 0.9,
  },
  countdownLabel: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
    opacity: 0.8,
  },
  countdownNumberContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  countdownNumber: {
    fontSize: 80,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});

export default DriverEmergencyAlertScreen;

