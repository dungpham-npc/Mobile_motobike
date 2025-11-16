import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PhoneService from '../services/PhoneService';
import locationService from '../services/LocationService';

const DriverContactCard = ({ 
  driver, 
  onCallPress, 
  onMessagePress, 
  onLocationPress,
  showLocation = true,
  showMessage = true 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);

  useEffect(() => {
    if (showLocation && driver?.id) {
      // Simulate getting driver location - trong thực tế sẽ lấy từ API
      setDriverLocation({
        latitude: 10.7769,
        longitude: 106.7009,
        address: "Quận 1, TP.HCM",
        lastUpdated: new Date()
      });
    }
  }, [driver?.id, showLocation]);

  const handleCallDriver = async () => {
    if (!driver?.phone) {
      Alert.alert('Lỗi', 'Không có số điện thoại của tài xế');
      return;
    }

    setIsLoading(true);
    try {
      const success = await PhoneService.makePhoneCall(driver.phone, driver.name);
      
      if (success && onCallPress) {
        onCallPress(driver);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể thực hiện cuộc gọi');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMessageDriver = async () => {
    if (!driver?.phone) {
      Alert.alert('Lỗi', 'Không có số điện thoại của tài xế');
      return;
    }

    setIsLoading(true);
    try {
      const message = `Xin chào ${driver.name}, tôi là khách hàng đã đặt chuyến đi.`;
      const success = await PhoneService.sendSMS(driver.phone, message, driver.name);
      
      if (success && onMessagePress) {
        onMessagePress(driver);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.message || 'Không thể gửi tin nhắn');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationPress = () => {
    if (driverLocation && onLocationPress) {
      onLocationPress(driverLocation);
    }
  };

  const formatPhoneNumber = (phone) => {
    return PhoneService.formatPhoneNumber(phone);
  };

  const getTimeAgo = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  if (!driver) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Driver Info */}
      <View style={styles.driverInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: driver.avatar || 'https://via.placeholder.com/60' }}
            style={styles.avatar}
          />
          <View style={[
            styles.statusDot, 
            { backgroundColor: driver.isOnline ? '#4CAF50' : '#999' }
          ]} />
        </View>
        
        <View style={styles.driverDetails}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <View style={styles.ratingContainer}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.rating}>{driver.rating}</Text>
            <Text style={styles.ratingCount}>({driver.totalRides} chuyến)</Text>
          </View>
          
          {driver.vehicleInfo && (
            <Text style={styles.vehicleInfo}>
              {driver.vehicleInfo.brand} {driver.vehicleInfo.model} - {driver.vehicleInfo.licensePlate}
            </Text>
          )}
          
          <Text style={styles.phoneNumber}>
            {formatPhoneNumber(driver.phone)}
          </Text>
        </View>
      </View>

      {/* Location Info */}
      {showLocation && driverLocation && (
        <TouchableOpacity 
          style={styles.locationContainer}
          onPress={handleLocationPress}
        >
          <Icon name="location-on" size={16} color="#2196F3" />
          <View style={styles.locationDetails}>
            <Text style={styles.locationText}>{driverLocation.address}</Text>
            <Text style={styles.locationTime}>
              Cập nhật {getTimeAgo(driverLocation.lastUpdated)}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color="#ccc" />
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.callButton]}
          onPress={handleCallDriver}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="phone" size={20} color="#fff" />
              <Text style={styles.callButtonText}>Gọi</Text>
            </>
          )}
        </TouchableOpacity>

        {showMessage && (
          <TouchableOpacity
            style={[styles.actionButton, styles.messageButton]}
            onPress={handleMessageDriver}
            disabled={isLoading}
          >
            <Icon name="message" size={20} color="#2196F3" />
            <Text style={styles.messageButtonText}>Nhắn tin</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Emergency Actions */}
      <View style={styles.emergencyContainer}>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => Alert.alert(
            'Báo cáo sự cố',
            'Bạn có muốn báo cáo sự cố với chuyến đi này?',
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Báo cáo', onPress: () => console.log('Report issue') }
            ]
          )}
        >
          <Icon name="report" size={16} color="#FF9800" />
          <Text style={styles.emergencyText}>Báo cáo sự cố</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={() => PhoneService.makeEmergencyCall('113')}
        >
          <Icon name="warning" size={16} color="#F44336" />
          <Text style={styles.emergencyText}>Khẩn cấp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0e0e0',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginLeft: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  vehicleInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  locationTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  messageButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageButtonText: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  emergencyText: {
    fontSize: 13,
    color: '#666',
  },
});

export default DriverContactCard;
