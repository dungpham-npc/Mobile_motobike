import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import mockData from '../../data/mockData.json';

const SOSAlertScreen = ({ navigation }) => {
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [emergencyType, setEmergencyType] = useState(null);

  const user = mockData.users[1]; // Driver user
  const emergencyContacts = user.emergencyContacts || [
    { name: 'Cảnh sát', phone: '113' },
    { name: 'Cứu thương', phone: '115' },
    { name: 'Cứu hỏa', phone: '114' },
    { name: 'Hỗ trợ MSSUS', phone: '1900-1234' }
  ];

  const emergencyTypes = [
    {
      id: 'accident',
      title: 'Tai nạn giao thông',
      description: 'Gặp tai nạn, cần hỗ trợ y tế',
      icon: 'local-hospital',
      color: '#F44336',
      priority: 'high'
    },
    {
      id: 'breakdown',
      title: 'Xe hỏng',
      description: 'Xe gặp sự cố, không thể di chuyển',
      icon: 'build',
      color: '#FF9800',
      priority: 'medium'
    },
    {
      id: 'safety',
      title: 'An toàn cá nhân',
      description: 'Cảm thấy không an toàn, cần hỗ trợ',
      icon: 'security',
      color: '#9C27B0',
      priority: 'high'
    },
    {
      id: 'other',
      title: 'Khác',
      description: 'Tình huống khẩn cấp khác',
      icon: 'warning',
      color: '#607D8B',
      priority: 'medium'
    }
  ];

  useEffect(() => {
    let interval;
    if (isEmergencyActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      triggerEmergency();
    }
    return () => clearInterval(interval);
  }, [isEmergencyActive, countdown]);

  const startEmergency = (type) => {
    setEmergencyType(type);
    setIsEmergencyActive(true);
    setCountdown(5);
  };

  const cancelEmergency = () => {
    setIsEmergencyActive(false);
    setCountdown(5);
    setEmergencyType(null);
  };

  const triggerEmergency = () => {
    // Send emergency alert
    Alert.alert(
      'Cảnh báo khẩn cấp đã được gửi!',
      `Thông tin của bạn đã được gửi đến:\n• Trung tâm hỗ trợ MSSUS\n• Liên hệ khẩn cấp\n• Cơ quan chức năng (nếu cần)\n\nVị trí hiện tại đã được chia sẻ.`,
      [
        { text: 'OK', onPress: () => {
          setIsEmergencyActive(false);
          setCountdown(5);
          setEmergencyType(null);
        }}
      ]
    );
  };

  const callEmergencyContact = (contact) => {
    Alert.alert(
      'Gọi khẩn cấp',
      `Bạn có muốn gọi cho ${contact.name}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gọi ngay', onPress: () => Linking.openURL(`tel:${contact.phone}`) }
      ]
    );
  };

  const shareLocation = () => {
    Alert.alert(
      'Chia sẻ vị trí',
      'Vị trí của bạn đã được gửi đến các liên hệ khẩn cấp và trung tâm hỗ trợ.',
      [{ text: 'OK' }]
    );
  };

  if (isEmergencyActive) {
    return (
      <SafeAreaView style={styles.emergencyContainer}>
        <LinearGradient
          colors={['#F44336', '#D32F2F']}
          style={styles.emergencyBackground}
        >
          <Animatable.View 
            animation="pulse" 
            iterationCount="infinite" 
            style={styles.emergencyContent}
          >
            <Icon name="warning" size={120} color="#fff" />
            <Text style={styles.emergencyTitle}>CẢNH BÁO KHẨN CẤP</Text>
            <Text style={styles.emergencySubtitle}>
              {emergencyType?.title}
            </Text>
            
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>
                Gửi cảnh báo trong
              </Text>
              <Animatable.Text 
                animation="bounceIn" 
                style={styles.countdownNumber}
                key={countdown}
              >
                {countdown}
              </Animatable.Text>
              <Text style={styles.countdownText}>giây</Text>
            </View>

            <ModernButton
              title="HỦY CẢNH BÁO"
              variant="secondary"
              size="large"
              onPress={cancelEmergency}
              style={styles.cancelButton}
            />
          </Animatable.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cảnh báo khẩn cấp</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        {/* Warning Message */}
        <Animatable.View animation="fadeInUp" style={styles.warningCard}>
          <Icon name="info" size={24} color="#FF9800" />
          <Text style={styles.warningText}>
            Chỉ sử dụng tính năng này trong trường hợp thực sự khẩn cấp. 
            Thông tin của bạn sẽ được chia sẻ với cơ quan chức năng và liên hệ khẩn cấp.
          </Text>
        </Animatable.View>

        {/* Emergency Types */}
        <View style={styles.emergencySection}>
          <Text style={styles.sectionTitle}>Chọn loại khẩn cấp</Text>
          {emergencyTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={styles.emergencyTypeCard}
              onPress={() => startEmergency(type)}
            >
              <LinearGradient
                colors={[type.color, type.color + 'DD']}
                style={styles.emergencyIcon}
              >
                <Icon name={type.icon} size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.emergencyTypeInfo}>
                <Text style={styles.emergencyTypeTitle}>{type.title}</Text>
                <Text style={styles.emergencyTypeDescription}>{type.description}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: type.priority === 'high' ? '#F44336' : '#FF9800' }]}>
                <Text style={styles.priorityText}>
                  {type.priority === 'high' ? 'Cao' : 'TB'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Thao tác nhanh</Text>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionItem} onPress={shareLocation}>
              <LinearGradient
                colors={['#2196F3', '#1976D2']}
                style={styles.quickActionIcon}
              >
                <Icon name="my-location" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionText}>Chia sẻ vị trí</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionItem}
              onPress={() => Alert.alert('Thông báo', 'Đã gửi tin nhắn khẩn cấp')}
            >
              <LinearGradient
                colors={['#34D399', '#059669']}
                style={styles.quickActionIcon}
              >
                <Icon name="message" size={20} color="#fff" />
              </LinearGradient>
              <Text style={styles.quickActionText}>Tin nhắn SOS</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.contactsSection}>
          <Text style={styles.sectionTitle}>Liên hệ khẩn cấp</Text>
          {emergencyContacts.map((contact, index) => (
            <TouchableOpacity
              key={index}
              style={styles.contactItem}
              onPress={() => callEmergencyContact(contact)}
            >
              <View style={styles.contactIcon}>
                <Icon name="phone" size={20} color="#4CAF50" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
              <Icon name="call" size={20} color="#4CAF50" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Lời khuyên an toàn</Text>
          <View style={styles.tip}>
            <Icon name="lightbulb" size={16} color="#FF9800" />
            <Text style={styles.tipText}>
              Luôn đội mũ bảo hiểm và tuân thủ luật giao thông
            </Text>
          </View>
          <View style={styles.tip}>
            <Icon name="lightbulb" size={16} color="#FF9800" />
            <Text style={styles.tipText}>
              Kiểm tra xe thường xuyên trước khi bắt đầu chuyến đi
            </Text>
          </View>
          <View style={styles.tip}>
            <Icon name="lightbulb" size={16} color="#FF9800" />
            <Text style={styles.tipText}>
              Tránh lái xe khi mệt mỏi hoặc trong điều kiện thời tiết xấu
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  emergencyContainer: {
    flex: 1,
  },
  emergencyBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emergencyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emergencySubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 40,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  countdownText: {
    fontSize: 18,
    color: '#fff',
  },
  countdownNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 10,
  },
  cancelButton: {
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    marginLeft: 12,
    lineHeight: 20,
  },
  emergencySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  emergencyTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  emergencyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  emergencyTypeInfo: {
    flex: 1,
  },
  emergencyTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emergencyTypeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionItem: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  contactsSection: {
    marginBottom: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
  },
  tipsSection: {
    marginBottom: 20,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default SOSAlertScreen;