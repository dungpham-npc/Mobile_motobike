import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import Feather from 'react-native-vector-icons/Feather';
import * as Animatable from 'react-native-animatable';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors, typography, spacing } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const SwitchModeScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 28 });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchLoading, setSwitchLoading] = useState(null);
  const [currentMode, setCurrentMode] = useState(null); // 'driver' | 'rider'

  const loadUserProfile = async (forceRefresh = true) => {
    try {
      // Set loading state
      if (forceRefresh) {
        setLoading(true);
      }
      
      // Always refresh from server to get latest role and activeProfile
      // Use timestamp to bypass cache
      const freshProfile = await authService.getCurrentUserProfile(forceRefresh);
      
      console.log('📋 Full profile response:', JSON.stringify(freshProfile, null, 2));
      
      setUser(freshProfile);
      
      // Determine current mode based on activeProfile (most accurate)
      // Priority: activeProfile > user_type > driver_profile existence
      let mode = 'rider'; // default
      
      // Check activeProfile first (most reliable after switch)
      const activeProfile = freshProfile?.active_profile || freshProfile?.activeProfile;
      if (activeProfile) {
        mode = activeProfile.toLowerCase() === 'driver' ? 'driver' : 'rider';
      } else if (freshProfile?.user?.user_type === 'driver') {
        mode = 'driver';
      } else if (freshProfile?.driver_profile !== null && freshProfile?.driver_profile !== undefined) {
        mode = 'driver';
      }
      
      const driverProfile = freshProfile?.driver_profile || freshProfile?.driverProfile;
      const availableProfiles = freshProfile?.available_profiles || freshProfile?.availableProfiles || [];
      console.log('📱 Current mode detected:', mode, {
        active_profile: activeProfile,
        user_type: freshProfile?.user?.user_type,
        available_profiles: availableProfiles,
        has_driver_profile: driverProfile !== null && driverProfile !== undefined,
        driver_profile_status: driverProfile?.status,
        driver_profile_keys: driverProfile ? Object.keys(driverProfile) : null,
      });
      
      setCurrentMode(mode);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Fallback to cached user if API fails
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        
        // Use same logic for fallback
        let mode = 'rider';
        const activeProfile = currentUser?.active_profile || currentUser?.activeProfile;
        if (activeProfile) {
          mode = activeProfile.toLowerCase() === 'driver' ? 'driver' : 'rider';
        } else if (currentUser?.user?.user_type === 'driver') {
          mode = 'driver';
        } else if (currentUser?.driver_profile !== null && currentUser?.driver_profile !== undefined) {
          mode = 'driver';
        }
        
        console.log('📱 Fallback mode detected:', mode, {
          active_profile: activeProfile,
          user_type: currentUser?.user?.user_type,
        });
        
        setCurrentMode(mode);
      } else {
        Alert.alert('Lỗi', 'Không thể tải thông tin hồ sơ');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserProfile(true);
  }, []);

  // Refresh profile when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Screen focused, refreshing profile...');
      loadUserProfile(true);
    }, [])
  );

  const handleSwitchProfile = async (targetRole) => {
    if (!user) return;

    // Prevent switching to same role
    if (targetRole === currentMode) {
      return;
    }

    // Check driver profile status
    if (targetRole === 'driver') {
      // First check availableProfiles - most reliable
      const availableProfiles = user.available_profiles || user.availableProfiles || [];
      const hasDriverInAvailable = availableProfiles.some(profile => 
        profile && profile.toUpperCase() === 'DRIVER'
      );
      
      console.log('🔍 Checking driver availability for switch:', {
        available_profiles: availableProfiles,
        has_driver_in_available: hasDriverInAvailable,
      });
      
      // If driver is not in availableProfiles, check driver_profile directly
      if (!hasDriverInAvailable) {
        const driverProfile = user.driver_profile || user.driverProfile;
        const driverStatus = driverProfile?.status;
        
        console.log('🔍 Checking driver profile directly:', {
          has_driver_profile: !!driverProfile,
          driver_status: driverStatus,
        });
        
        // Check if driver profile exists
        if (!driverProfile) {
          Alert.alert(
            'Chưa thể chuyển đổi',
            'Bạn cần xác minh tài khoản tài xế trước. Vui lòng gửi giấy tờ để admin duyệt.',
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Xác minh ngay', onPress: () => navigation.navigate('AccountVerification') },
            ]
          );
          return;
        }
        
        // Check if status is not ACTIVE
        if (driverStatus && driverStatus.toUpperCase() !== 'ACTIVE') {
          const statusMessages = {
            'PENDING': 'Tài khoản tài xế của bạn đang chờ admin duyệt.',
            'REJECTED': 'Tài khoản tài xế của bạn đã bị từ chối. Vui lòng gửi lại giấy tờ.',
            'SUSPENDED': 'Tài khoản tài xế của bạn đã bị tạm ngưng.',
            'INACTIVE': 'Tài khoản tài xế của bạn đang không hoạt động.',
          };
          
          Alert.alert(
            'Chưa thể chuyển đổi',
            statusMessages[driverStatus.toUpperCase()] || 'Tài khoản tài xế của bạn chưa được kích hoạt.',
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Xem chi tiết', onPress: () => navigation.navigate('AccountVerification') },
            ]
          );
          return;
        }
      } else {
        console.log('✅ Driver profile is available (from availableProfiles), allowing switch');
      }
    }

    setSwitchLoading(targetRole);

    try {
      console.log('🔄 Starting profile switch to:', targetRole);
      const response = await authService.switchProfile(targetRole);
      console.log('✅ Profile switch successful:', response);
      
      // Wait a moment to ensure all state is updated
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reset navigation stack to the appropriate main screen
      // This ensures a clean navigation state
      const targetRoute = targetRole === 'driver' ? 'DriverMain' : 'Main';
      
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: targetRoute }],
        })
      );
    } catch (error) {
      console.error('❌ Switch profile error:', error);
      setSwitchLoading(null);
      
      let errorMessage = 'Không thể chuyển đổi chế độ';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      
      Alert.alert('Lỗi', errorMessage);
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader
            floating
            topOffset={headerOffset}
            title="Chuyển đổi chế độ"
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const isDriver = currentMode === 'driver';

  // Helper function to check if driver profile is active
  const isDriverProfileActive = (userData) => {
    if (!userData) {
      console.log('❌ isDriverProfileActive: No userData');
      return false;
    }
    
    // First check availableProfiles - this is the most reliable indicator
    const availableProfiles = userData.available_profiles || userData.availableProfiles || [];
    const hasDriverInAvailable = availableProfiles.some(profile => 
      profile && profile.toUpperCase() === 'DRIVER'
    );
    
    console.log('🔍 Checking driver profile availability:', {
      available_profiles: availableProfiles,
      has_driver_in_available: hasDriverInAvailable,
    });
    
    // If driver is in availableProfiles, user can switch to driver mode
    if (hasDriverInAvailable) {
      console.log('✅ Driver profile is available (from availableProfiles)');
      return true;
    }
    
    // Fallback: Check driver_profile directly (may be null if activeProfile is rider)
    const driverProfile = userData.driver_profile || userData.driverProfile;
    console.log('🔍 Checking driver profile directly:', {
      has_driver_profile: !!driverProfile,
      driver_profile_keys: driverProfile ? Object.keys(driverProfile) : null,
    });
    
    if (!driverProfile) {
      console.log('❌ isDriverProfileActive: No driver profile found');
      return false;
    }
    
    const status = driverProfile.status;
    console.log('🔍 Driver profile status:', status);
    
    const isActive = status && status.toUpperCase() === 'ACTIVE';
    console.log('✅ isDriverProfileActive result:', isActive);
    
    return isActive;
  };

  // Helper function to get driver profile status message
  const getDriverProfileStatusMessage = (userData) => {
    if (!userData) return 'Cần xác minh';
    const driverProfile = userData.driver_profile || userData.driverProfile;
    if (!driverProfile) return 'Cần xác minh';
    const status = driverProfile.status;
    if (!status) return 'Cần xác minh';
    
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'ACTIVE') return undefined; // No message if active
    if (statusUpper === 'PENDING') return 'Đang chờ duyệt';
    if (statusUpper === 'REJECTED') return 'Đã bị từ chối';
    if (statusUpper === 'SUSPENDED') return 'Đã bị tạm ngưng';
    if (statusUpper === 'INACTIVE') return 'Không hoạt động';
    return 'Cần xác minh';
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title="Chuyển đổi chế độ"
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
        >
          <Animatable.View animation="fadeInUp" duration={400} delay={60}>
            <CleanCard contentStyle={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Feather name="git-branch" size={24} color={colors.primary} />
              </View>
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>Chuyển đổi chế độ</Text>
                <Text style={styles.heroSubtitle}>
                  Chọn chế độ hoạt động phù hợp với nhu cầu sử dụng Campus Ride của bạn.
                </Text>
              </View>
            </CleanCard>
          </Animatable.View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chọn chế độ</Text>
            
            <Animatable.View animation="fadeInUp" duration={400} delay={120}>
              <ModeCard
                title="Hành khách"
                description="Đặt chuyến đi, tìm tài xế xung quanh"
                icon="user"
                iconBg="#E6F6EF"
                iconColor={colors.primary}
                active={currentMode === 'rider'}
                loading={switchLoading === 'rider'}
                disabled={switchLoading !== null || currentMode === 'rider'}
                onPress={() => handleSwitchProfile('rider')}
              />
            </Animatable.View>

            <Animatable.View animation="fadeInUp" duration={400} delay={180}>
              <ModeCard
                title="Tài xế"
                description="Chia sẻ chuyến đi, kiếm thêm thu nhập"
                icon="truck"
                iconBg="#E7F2FF"
                iconColor={colors.accent}
                active={currentMode === 'driver'}
                loading={switchLoading === 'driver'}
                disabled={switchLoading !== null || currentMode === 'driver' || !isDriverProfileActive(user)}
                disabledMessage={!isDriverProfileActive(user) ? getDriverProfileStatusMessage(user) : undefined}
                onPress={() => handleSwitchProfile('driver')}
              />
            </Animatable.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const ModeCard = ({ 
  title, 
  description, 
  icon, 
  iconBg, 
  iconColor, 
  active, 
  loading, 
  disabled, 
  disabledMessage,
  onPress 
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={disabled ? 1 : 0.7}
    disabled={disabled || loading}
    style={styles.modeCardWrapper}
  >
    <CleanCard 
      style={[
        styles.modeCard, 
        active && styles.modeCardActive,
        disabled && styles.modeCardDisabled
      ]} 
      contentStyle={styles.modeCardContent}
    >
      <View style={styles.modeCardInner}>
        <View style={[
          styles.modeIconContainer, 
          { backgroundColor: iconBg },
          disabled && styles.modeIconContainerDisabled
        ]}>
          <Feather name={icon} size={28} color={disabled ? colors.textMuted : iconColor} />
        </View>
        
        <View style={styles.modeInfo}>
          <View style={styles.modeHeader}>
            <Text style={[
              styles.modeTitle, 
              active && styles.modeTitleActive,
              disabled && styles.modeTitleDisabled
            ]}>
              {title}
            </Text>
            {active && (
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Đang sử dụng</Text>
              </View>
            )}
            {disabledMessage && !active && (
              <View style={styles.disabledBadge}>
                <Text style={styles.disabledBadgeText}>{disabledMessage}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.modeDescription, disabled && styles.modeDescriptionDisabled]}>
            {description}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : active ? (
          <View style={styles.checkIcon}>
            <Feather name="check-circle" size={24} color={iconColor} />
          </View>
        ) : (
          <Feather 
            name="chevron-right" 
            size={20} 
            color={disabled ? colors.textMuted : iconColor} 
          />
        )}
      </View>
    </CleanCard>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  heroCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  modeCardWrapper: {
    marginBottom: spacing.sm,
  },
  modeCard: {
    marginBottom: 0,
  },
  modeCardActive: {
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  modeCardDisabled: {
    opacity: 0.6,
  },
  modeCardContent: {
    padding: spacing.md,
  },
  modeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  modeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeIconContainerDisabled: {
    backgroundColor: '#F3F4F6',
  },
  modeInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  modeTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  modeTitleActive: {
    color: colors.primary,
  },
  modeTitleDisabled: {
    color: colors.textMuted,
  },
  modeDescription: {
    fontSize: typography.body,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  modeDescriptionDisabled: {
    color: colors.textMuted,
  },
  checkIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary + '15',
  },
  activeBadgeText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  disabledBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  disabledBadgeText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textMuted,
  },
});

export default SwitchModeScreen;
