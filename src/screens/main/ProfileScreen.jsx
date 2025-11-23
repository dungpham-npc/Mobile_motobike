import React, { useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import authService from '../../services/authService';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { colors } from '../../theme/designTokens';

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const refreshProfile = async () => {
        try {
          const freshProfile = await authService.getCurrentUserProfile();
          if (freshProfile) {
            setUser(freshProfile);
          }
        } catch (error) {
          console.error('Error refreshing profile:', error);
        }
      };

      refreshProfile();
    }, [])
  );

  const loadUserProfile = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        const profile = await authService.getCurrentUserProfile();
        setUser(profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất?',
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
          },
        },
      ]
    );
  };

  const menuItems = [
    { icon: 'swap-horiz', title: 'Chuyển đổi chế độ', onPress: () => navigation.navigate('ProfileSwitch') },
    { icon: 'edit', title: 'Chỉnh sửa thông tin', onPress: () => navigation.navigate('EditProfile') },
    { icon: 'security', title: 'Đổi mật khẩu', onPress: () => navigation.navigate('ChangePassword') },
    {
      icon: 'verified',
      title: 'Xác minh tài khoản',
      onPress: () => {
        navigation.navigate('ProfileSwitch');
      },
    },
    { icon: 'help', title: 'Trợ giúp & Hỗ trợ', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
    { icon: 'policy', title: 'Điều khoản sử dụng', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
    { icon: 'info', title: 'Về chúng tôi', onPress: () => Alert.alert('Thông báo', 'Chức năng đang phát triển') },
  ];

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Đang tải thông tin...</Text>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (!user) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.errorContainer}>
            <Icon name="error-outline" size={48} color={colors.textMuted} />
            <Text style={styles.errorText}>Không thể tải thông tin hồ sơ</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerSpacing}>
            <GlassHeader title="Hồ sơ của tôi" />
          </View>

          <Animatable.View animation="fadeInUp" duration={480}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.userCardContent}>
              <View style={styles.userInfo}>
                <Image
                  source={{
                    uri: user.user?.profile_photo_url
                      ? `${user.user.profile_photo_url}?t=${Date.now()}`
                      : 'https://via.placeholder.com/100',
                  }}
                  style={styles.avatar}
                />
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{user.user?.full_name || 'Chưa cập nhật'}</Text>
                  <Text style={styles.userEmail}>{user.user?.email || 'Chưa cập nhật'}</Text>
                  <Text style={styles.studentId}>MSSV: {user.user?.student_id || 'Chưa cập nhật'}</Text>
                  <View style={styles.verificationStatus}>
                    <Icon
                      name={authService.isRiderVerified() ? 'verified' : 'pending'}
                      size={16}
                      color={authService.isRiderVerified() ? '#22C55E' : '#F97316'}
                    />
                    <Text
                      style={[
                        styles.verificationText,
                        { color: authService.isRiderVerified() ? '#22C55E' : '#F97316' },
                      ]}
                    >
                      {authService.isRiderVerified() ? 'Đã xác minh' : 'Chưa xác minh'}
                    </Text>
                  </View>
                </View>
              </View>
            </CleanCard>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={480} delay={80}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.statsCardContent}>
              <Text style={styles.statsTitle}>Thống kê</Text>
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {user.rider_profile?.total_rides || user.driver_profile?.total_shared_rides || 0}
                  </Text>
                  <Text style={styles.statLabel}>Chuyến đi</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {user.wallet?.cached_balance
                      ? `${parseFloat(user.wallet.cached_balance).toLocaleString()}đ`
                      : '0đ'}
                  </Text>
                  <Text style={styles.statLabel}>Số dư ví</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>
                    {user.rider_profile?.rating_avg || user.driver_profile?.rating_avg || '0.0'}
                  </Text>
                  <Text style={styles.statLabel}>Đánh giá</Text>
                </View>
              </View>
            </CleanCard>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={480} delay={140}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.menuContent}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.menuItem,
                    index !== menuItems.length - 1 && styles.menuDivider,
                    item.disabled && styles.disabledMenuItem,
                  ]}
                  onPress={item.disabled ? null : item.onPress}
                  disabled={item.disabled}
                >
                  <View style={styles.menuItemLeft}>
                    <Icon
                      name={item.icon}
                      size={22}
                      color={item.disabled ? colors.textMuted : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.menuItemText,
                        item.disabled && styles.disabledMenuItemText,
                      ]}
                    >
                      {item.title}
                    </Text>
                  </View>
                  {!item.disabled && <Icon name="chevron-right" size={22} color={colors.textMuted} />}
                </TouchableOpacity>
              ))}
            </CleanCard>
          </Animatable.View>

          <Animatable.View animation="fadeInUp" duration={480} delay={200}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.logoutCardContent}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Icon name="logout" size={22} color="#EF4444" />
                <Text style={styles.logoutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </CleanCard>
          </Animatable.View>

          <Text style={styles.versionText}>Phiên bản 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: {
    paddingBottom: 140,
    paddingTop: 24,
  },
  headerSpacing: {
    marginBottom: 24,
  },
  cardSpacing: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  userCardContent: {
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationText: {
    fontSize: 12,
    marginLeft: 6,
    fontFamily: 'Inter_600SemiBold',
  },
  statsCardContent: {
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(148,163,184,0.22)',
  },
  menuContent: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  disabledMenuItem: {
    opacity: 0.6,
  },
  disabledMenuItemText: {
    color: colors.textMuted,
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
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginBottom: 28,
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
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
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
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 18,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});

export default ProfileScreen;
