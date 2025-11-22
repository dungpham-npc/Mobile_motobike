import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import vehicleService from '../../services/vehicleService';

const DriverProfileScreen = ({ navigation }) => {
  const [showVehicleInfo, setShowVehicleInfo] = useState(true);
  const [user, setUser] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDriverData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadDriverData();
    }, [])
  );

  const loadDriverData = async () => {
    try {
      setLoading(true);
      
      // Load user profile first
      const userProfile = await authService.getCurrentUserProfile();
      setUser(userProfile);
      
      // Try to load vehicles, but don't fail if it errors (403, etc.)
      try {
        const vehiclesData = await vehicleService.getDriverVehicles({ page: 0, size: 10 });
        
        // Extract vehicles from response (could be array or paginated response)
        if (vehiclesData) {
          if (Array.isArray(vehiclesData)) {
            setVehicles(vehiclesData);
          } else if (vehiclesData.content && Array.isArray(vehiclesData.content)) {
            setVehicles(vehiclesData.content);
          } else if (vehiclesData.data && Array.isArray(vehiclesData.data)) {
            setVehicles(vehiclesData.data);
          } else {
            setVehicles([]);
          }
        } else {
          setVehicles([]);
        }
      } catch (vehicleError) {
        // If vehicle loading fails (403, 404, etc.), just set empty array
        console.warn('Could not load vehicles (may not have permission or no vehicles):', vehicleError);
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
      // Only show alert if user profile failed to load
      if (!user) {
        Alert.alert('Lỗi', 'Không thể tải thông tin tài xế');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDriverData();
    setRefreshing(false);
  };

  // Get first vehicle or default
  const vehicleInfo = vehicles.length > 0 ? vehicles[0] : null;

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản tài xế?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Đăng xuất', 
          onPress: async () => {
            try {
              await authService.logout();
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout error:', error);
              navigation.replace('Login');
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert('Chỉnh sửa hồ sơ', 'Chức năng đang được phát triển');
  };

  const handleVehicleEdit = () => {
    Alert.alert('Cập nhật thông tin xe', 'Chức năng đang được phát triển');
  };

  const menuSections = [
    {
      title: 'Chuyến đi',
      items: [
        { icon: 'history', title: 'Lịch sử chuyến đi', onPress: () => navigation.navigate('DriverRideHistory') },
        { icon: 'star', title: 'Đánh giá của tôi', onPress: () => navigation.navigate('DriverRatings') }
      ]
    },
    {
      title: 'Tài khoản',
      items: [
        { icon: 'edit', title: 'Chỉnh sửa thông tin', onPress: handleEditProfile },
        { icon: 'security', title: 'Đổi mật khẩu', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'verified', title: 'Xác minh tài khoản', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'account-balance', title: 'Thông tin ngân hàng', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') }
      ]
    },
    {
      title: 'Hỗ trợ',
      items: [
        { icon: 'help', title: 'Trung tâm trợ giúp', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'phone', title: 'Liên hệ hỗ trợ', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'feedback', title: 'Góp ý', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') }
      ]
    },
    {
      title: 'Cài đặt',
      items: [
        { icon: 'notifications', title: 'Thông báo', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'language', title: 'Ngôn ngữ', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'policy', title: 'Chính sách bảo mật', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
        { icon: 'info', title: 'Về ứng dụng', onPress: () => Alert.alert('MSSUS', 'Phiên bản 1.0.0\nHệ thống chia sẻ xe máy cho sinh viên') }
      ]
    }
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10412F" />
          <Text style={styles.loadingText}>Đang tải thông tin...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Không thể tải thông tin tài xế</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDriverData}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const driverProfile = user.driver_profile || {};

  const isDriverProfileVerified = () => {
    if (!driverProfile) return false;
    if (driverProfile.status) {
      return ['APPROVED', 'ACTIVE', 'VERIFIED'].includes(driverProfile.status.toUpperCase());
    }
    return !!driverProfile.license_verified_at || !!driverProfile.is_available;
  };

  const isVerified = isDriverProfileVerified();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <LinearGradient
          colors={['#10412F', '#000000']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Hồ sơ tài xế</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Profile Card */}
          <Animatable.View animation="fadeInUp" style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <Image 
                source={{ 
                  uri: user.user?.profile_photo_url 
                    ? `${user.user.profile_photo_url}?t=${Date.now()}`
                    : 'https://via.placeholder.com/100'
                }} 
                style={styles.avatar}
              />
              <View style={styles.profileInfo}>
                <Text style={styles.driverName}>{user.user?.full_name || 'Chưa cập nhật'}</Text>
                <Text style={styles.driverEmail}>{user.user?.email || 'Chưa cập nhật'}</Text>
                <Text style={styles.studentId}>MSSV: {user.user?.student_id || 'Chưa cập nhật'}</Text>
                <View style={styles.verificationStatus}>
                  <Icon 
                    name={isVerified ? 'verified' : 'pending'} 
                    size={16} 
                    color={isVerified ? '#4CAF50' : '#FF9800'} 
                  />
                  <Text style={[
                    styles.verificationText,
                    { color: isVerified ? '#4CAF50' : '#FF9800' }
                  ]}>
                    {isVerified ? 'Đã xác minh' : 'Chưa xác minh'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
                <Icon name="edit" size={20} color="#4CAF50" />
              </TouchableOpacity>
            </View>
          </Animatable.View>

          {/* Stats Card */}
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Thống kê tài xế</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <LinearGradient
                  colors={['#FF9800', '#F57C00']}
                  style={styles.statIcon}
                >
                  <Icon name="star" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>
                  {driverProfile.rating_avg ? driverProfile.rating_avg.toFixed(1) : '0.0'}
                </Text>
                <Text style={styles.statLabel}>Đánh giá</Text>
              </View>

              <View style={styles.statItem}>
                <LinearGradient
                  colors={['#2196F3', '#1976D2']}
                  style={styles.statIcon}
                >
                  <Icon name="directions-car" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>
                  {driverProfile.total_shared_rides || 0}
                </Text>
                <Text style={styles.statLabel}>Chuyến đi</Text>
              </View>

              <View style={styles.statItem}>
                <LinearGradient
                  colors={['#10412F', '#000000']}
                  style={styles.statIcon}
                >
                  <Icon name="account-balance-wallet" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>
                  {user.wallet?.cached_balance 
                    ? `${(user.wallet.cached_balance / 1000).toFixed(0)}k`
                    : '0'}
                </Text>
                <Text style={styles.statLabel}>Số dư ví</Text>
              </View>

              <View style={styles.statItem}>
                <LinearGradient
                  colors={['#9C27B0', '#7B1FA2']}
                  style={styles.statIcon}
                >
                  <Icon name="trending-up" size={20} color="#fff" />
                </LinearGradient>
                <Text style={styles.statValue}>
                  {driverProfile.total_earned 
                    ? `${(driverProfile.total_earned / 1000000).toFixed(1)}M`
                    : '0'}
                </Text>
                <Text style={styles.statLabel}>Tổng thu nhập</Text>
              </View>
            </View>
          </View>

          {/* Vehicle Info Card */}
          <View style={styles.vehicleCard}>
            <TouchableOpacity 
              style={styles.vehicleHeader}
              onPress={() => setShowVehicleInfo(!showVehicleInfo)}
            >
              <Text style={styles.cardTitle}>Thông tin xe</Text>
              <Icon 
                name={showVehicleInfo ? 'expand-less' : 'expand-more'} 
                size={24} 
                color="#666" 
              />
            </TouchableOpacity>
            
            {showVehicleInfo && (
              <Animatable.View animation="fadeInDown" style={styles.vehicleDetails}>
                {vehicleInfo ? (
                  <>
                    <View style={styles.vehicleRow}>
                      <Icon name="category" size={20} color="#666" />
                      <Text style={styles.vehicleLabel}>Dòng xe:</Text>
                      <Text style={styles.vehicleValue}>{vehicleInfo.model || 'Chưa cập nhật'}</Text>
                    </View>
                    
                    <View style={styles.vehicleRow}>
                      <Icon name="confirmation-number" size={20} color="#666" />
                      <Text style={styles.vehicleLabel}>Biển số:</Text>
                      <Text style={styles.vehicleValue}>
                        {vehicleInfo.plate_number || vehicleInfo.plateNumber || 'Chưa cập nhật'}
                      </Text>
                    </View>
                    
                    <View style={styles.vehicleRow}>
                      <Icon name="palette" size={20} color="#666" />
                      <Text style={styles.vehicleLabel}>Màu sắc:</Text>
                      <Text style={styles.vehicleValue}>{vehicleInfo.color || 'Chưa cập nhật'}</Text>
                    </View>
                    
                    {vehicleInfo.year && (
                      <View style={styles.vehicleRow}>
                        <Icon name="calendar-today" size={20} color="#666" />
                        <Text style={styles.vehicleLabel}>Năm SX:</Text>
                        <Text style={styles.vehicleValue}>{vehicleInfo.year}</Text>
                      </View>
                    )}
                    
                    {vehicleInfo.capacity && (
                      <View style={styles.vehicleRow}>
                        <Icon name="people" size={20} color="#666" />
                        <Text style={styles.vehicleLabel}>Số chỗ:</Text>
                        <Text style={styles.vehicleValue}>{vehicleInfo.capacity}</Text>
                      </View>
                    )}
                    
                    <ModernButton
                      title="Cập nhật thông tin xe"
                      variant="outline"
                      size="small"
                      icon="edit"
                      onPress={handleVehicleEdit}
                      style={styles.vehicleEditButton}
                    />
                  </>
                ) : (
                  <View style={styles.noVehicleContainer}>
                    <Icon name="directions-car" size={48} color="#ccc" />
                    <Text style={styles.noVehicleText}>Chưa có thông tin xe</Text>
                    <ModernButton
                      title="Thêm xe mới"
                      variant="outline"
                      size="small"
                      icon="add"
                      onPress={() => navigation.navigate('AddVehicle')}
                      style={styles.vehicleEditButton}
                    />
                  </View>
                )}
              </Animatable.View>
            )}
          </View>

          {/* Menu Sections */}
          {menuSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.menuContainer}>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity 
                    key={itemIndex} 
                    style={[
                      styles.menuItem,
                      itemIndex === section.items.length - 1 && styles.lastMenuItem
                    ]}
                    onPress={item.onPress}
                  >
                    <View style={styles.menuItemLeft}>
                      <Icon name={item.icon} size={24} color="#666" />
                      <Text style={styles.menuItemText}>{item.title}</Text>
                    </View>
                    <Icon name="chevron-right" size={24} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* Logout Button */}
          <ModernButton
            title="Đăng xuất"
            variant="outline"
            icon="logout"
            onPress={handleLogout}
            style={styles.logoutButton}
          />

          {/* App Version */}
          <Text style={styles.versionText}>MSSUS Driver v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  driverEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  editButton: {
    padding: 8,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleDetails: {
    marginTop: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vehicleLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    width: 80,
  },
  vehicleValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    flex: 1,
  },
  vehicleEditButton: {
    marginTop: 16,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 16,
  },
  logoutButton: {
    marginBottom: 20,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#10412F',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  noVehicleContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noVehicleText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
});

export default DriverProfileScreen;