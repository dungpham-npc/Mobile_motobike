import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import vehicleService from '../../services/vehicleService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { StatusBar } from 'react-native';
import { colors, typography, spacing } from '../../theme/designTokens';

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
        let vehiclesList = [];
        if (vehiclesData) {
          if (Array.isArray(vehiclesData)) {
            vehiclesList = vehiclesData;
          } else if (vehiclesData.content && Array.isArray(vehiclesData.content)) {
            vehiclesList = vehiclesData.content;
          } else if (vehiclesData.data && Array.isArray(vehiclesData.data)) {
            vehiclesList = vehiclesData.data;
          }
        }
        
        // Format vehicles to ensure consistent structure
        const formattedVehicles = vehicleService.formatVehicles(vehiclesList);
        console.log('Loaded vehicles:', formattedVehicles);
        setVehicles(formattedVehicles);
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
    navigation.navigate('EditProfile');
  };

  const handleVehicleEdit = () => {
    // If vehicle exists, navigate directly to edit screen
    if (vehicleInfo && vehicleInfo.id) {
      navigation.navigate('EditVehicle', { vehicleId: vehicleInfo.id });
    } else {
      // If no vehicle, navigate to add screen
      navigation.navigate('AddVehicle');
    }
  };

  const menuSections = [
    {
      title: 'Tài khoản',
      items: [
        { icon: 'swap-horiz', title: 'Chuyển đổi chế độ', onPress: () => navigation.navigate('SwitchMode') },
        { icon: 'edit', title: 'Chỉnh sửa thông tin', onPress: handleEditProfile },
        { icon: 'security', title: 'Đổi mật khẩu', onPress: () => navigation.navigate('ChangePassword') },
        { icon: 'verified', title: 'Xác minh tài khoản', onPress: () => navigation.navigate('AccountVerification') },
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
    <AppBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerSpacing}>
            <GlassHeader
              title="Hồ sơ tài xế"
            />
          </View>

        <View style={styles.content}>
          {/* Profile Card */}
          <Animatable.View animation="fadeInUp">
            <CleanCard style={styles.profileCard} contentStyle={styles.profileCardContent}>
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
            </CleanCard>
          </Animatable.View>

          {/* Stats Card */}
          <Animatable.View animation="fadeInUp" duration={400} delay={80}>
            <CleanCard style={styles.statsCard} contentStyle={styles.statsCardContent}>
              <Text style={styles.cardTitle}>Thống kê tài xế</Text>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#FFF4E6' }]}>
                    <Icon name="star" size={20} color="#FF9800" />
                  </View>
                  <Text style={styles.statValue}>
                    {driverProfile.rating_avg ? driverProfile.rating_avg.toFixed(1) : '0.0'}
                  </Text>
                  <Text style={styles.statLabel}>Đánh giá</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#E3F2FD' }]}>
                    <Icon name="directions-car" size={20} color="#2196F3" />
                  </View>
                  <Text style={styles.statValue}>
                    {driverProfile.total_shared_rides || 0}
                  </Text>
                  <Text style={styles.statLabel}>Chuyến đi</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#E8F5E9' }]}>
                    <Icon name="account-balance-wallet" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.statValue}>
                    {user.wallet?.cached_balance 
                      ? `${(user.wallet.cached_balance / 1000).toFixed(0)}k`
                      : '0'}
                  </Text>
                  <Text style={styles.statLabel}>Số dư ví</Text>
                </View>

                <View style={styles.statItem}>
                  <View style={[styles.statIconContainer, { backgroundColor: '#F3E5F5' }]}>
                    <Icon name="trending-up" size={20} color="#9C27B0" />
                  </View>
                  <Text style={styles.statValue}>
                    {driverProfile.total_earned 
                      ? `${(driverProfile.total_earned / 1000000).toFixed(1)}M`
                      : '0'}
                  </Text>
                  <Text style={styles.statLabel}>Tổng thu nhập</Text>
                </View>
              </View>
            </CleanCard>
          </Animatable.View>

          {/* Vehicle Info Card */}
          <CleanCard style={styles.vehicleCard} contentStyle={styles.vehicleCardContent}>
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
          </CleanCard>

          {/* Menu Sections */}
          {menuSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.menuSection}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <CleanCard style={styles.menuContainer} contentStyle={styles.menuContainerContent}>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity 
                    key={itemIndex} 
                    style={[
                      styles.menuItem,
                      itemIndex !== section.items.length - 1 && styles.menuDivider
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
              </CleanCard>
            </View>
          ))}

          {/* Logout Button */}
          <Animatable.View animation="fadeInUp" duration={480} delay={200}>
            <CleanCard style={styles.logoutCard} contentStyle={styles.logoutCardContent}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Icon name="logout" size={22} color="#EF4444" />
                <Text style={styles.logoutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </CleanCard>
          </Animatable.View>

          {/* App Version */}
          <Text style={styles.versionText}>MSSUS Driver v1.0.0</Text>
        </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  profileCard: {
    marginBottom: 20,
  },
  profileCardContent: {
    padding: 20,
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
    marginBottom: 20,
  },
  statsCardContent: {
    padding: 20,
  },
  cardTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '47%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.08)',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  vehicleCard: {
    marginBottom: 20,
  },
  vehicleCardContent: {
    padding: 20,
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
    marginBottom: 0,
  },
  menuContainerContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
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
  logoutCard: {
    marginBottom: 20,
  },
  logoutCardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
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