import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import verificationService from '../../services/verificationService';
import profileService from '../../services/profileService';
import authService from '../../services/authService';
import { colors } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const ProfileSwitchScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 56 });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStudentVerification, setCurrentStudentVerification] = useState(null);
  const [switchLoading, setSwitchLoading] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshVerificationStatus();
    });

    return unsubscribe;
  }, [navigation]);

  const refreshVerificationStatus = async () => {
    try {
      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentStudentVerification(verification);
    } catch (error) {
      console.log('Could not refresh verification status:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      } else {
        const profile = await authService.getCurrentUserProfile();
        setUser(profile);
      }

      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentStudentVerification(verification);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  const studentStatus = getStudentVerificationStatus(currentStudentVerification);
  const driverStatus = getDriverVerificationStatus(user, studentStatus);

  const handleStudentVerificationPress = () => {
    const status = currentStudentVerification?.status?.toLowerCase();

    if (status === 'pending') {
      Alert.alert('Đang xác minh', 'Yêu cầu của bạn đang được admin xem xét.');
      return;
    }

    if (status === 'rejected') {
      const reason = currentStudentVerification?.rejection_reason || 'Không rõ lý do';
      Alert.alert(
        'Giấy tờ bị từ chối',
        `Giấy tờ đã bị từ chối với lý do: ${reason}\n\nBạn có thể gửi lại giấy tờ mới.`,
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Gửi lại', onPress: () => navigation.navigate('StudentVerification') },
        ]
      );
      return;
    }

    if (['approved', 'verified', 'active'].includes(status)) {
      Alert.alert('Đã xác minh', 'Tài khoản sinh viên của bạn đã được xác minh.');
      return;
    }

    navigation.navigate('StudentVerification');
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader
            floating
            topOffset={headerOffset}
            title=""
            subtitle=""
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  const isDriver = user?.user?.user_type === 'driver';

  const handleSwitch = async (targetRole) => {
    if (!user) return;

    if (targetRole === 'driver' && !user?.driver_profile) {
      Alert.alert('Chưa thể chuyển đổi', 'Bạn chưa xác minh tài xế. Vui lòng gửi giấy tờ.');
      return;
    }

    if ((targetRole === 'driver' && isDriver) || (targetRole === 'rider' && !isDriver)) {
      return; // already in this mode
    }

    try {
      setSwitchLoading(true);
      await profileService.switchProfile(targetRole);
      const refreshed = await authService.getCurrentUserProfile();
      setUser(refreshed);
      // Move user to correct root
      if (targetRole === 'driver') {
        navigation.replace('DriverMain');
      } else {
        navigation.replace('Main');
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể chuyển đổi chế độ');
    } finally {
      setSwitchLoading(false);
    }
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.safe}>
        <SoftBackHeader
          floating
          topOffset={headerOffset}
          title=""
          subtitle=""
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chế độ hiện tại</Text>
            <CleanCard contentStyle={styles.cardPadding}>
              <View style={styles.currentRow}>
                <View style={[styles.roundIcon, { backgroundColor: isDriver ? '#E7F2FF' : '#E6F6EF' }]}>
                  <Feather name={isDriver ? 'truck' : 'user'} size={22} color={isDriver ? colors.accent : colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.modeHeading}>{isDriver ? 'Tài xế' : 'Hành khách'}</Text>
                  <Text style={styles.modeDescription}>
                    {isDriver ? 'Nhận chuyến đi và chia sẻ hành trình.' : 'Đặt chuyến đi, tìm tài xế xung quanh.'}
                  </Text>
                </View>
              </View>
            </CleanCard>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chế độ có thể chuyển</Text>
            <TouchableOpacity
              style={[styles.modeRow, !isDriver && styles.modeRowDisabled]}
              disabled={!isDriver}
              onPress={() => handleSwitch('rider')}
              activeOpacity={0.85}
            >
              <View style={[styles.modeIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <Feather name="user" size={20} color={colors.primary} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={[styles.modeTitle, !isDriver && { color: '#6B7280' }]}>Hành khách</Text>
                <Text style={styles.modeSubtitle}>Đặt chuyến đi, tìm tài xế xung quanh</Text>
              </View>
              {!isDriver && <View style={styles.badge}><Text style={styles.badgeText}>Đang sử dụng</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeRow, (isDriver ? true : !user?.driver_profile) && styles.modeRowDisabled]}
              disabled={isDriver || !user?.driver_profile || switchLoading}
              onPress={() => handleSwitch('driver')}
              activeOpacity={0.85}
            >
              <View style={[styles.modeIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Feather name="truck" size={20} color={colors.accent} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={[styles.modeTitle, isDriver && { color: '#6B7280' }]}>Tài xế</Text>
                <Text style={styles.modeSubtitle}>Chia sẻ chuyến đi, kiếm thêm thu nhập</Text>
              </View>
              {isDriver && <View style={styles.badge}><Text style={styles.badgeText}>Đang sử dụng</Text></View>}
              {!isDriver && !user?.driver_profile && (
                <View style={styles.badgeWarning}><Text style={styles.badgeWarningText}>Cần xác minh</Text></View>
              )}
            </TouchableOpacity>
          </View>

          {/* Verification section removed from this screen */}
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

// ModeOption removed as the screen now only shows account verification

const VerificationRow = ({
  title,
  description,
  icon,
  status,
  statusColor,
  buttonTitle,
  buttonDisabled,
  onButtonPress,
}) => (
  <View style={styles.verificationRow}>
    <View style={styles.verificationIcon}>
      <Feather name={icon} size={18} color={colors.accent} />
    </View>
    <View style={styles.verificationInfo}>
      <Text style={styles.verificationTitle}>{title}</Text>
      <Text style={styles.verificationDescription}>{description}</Text>
    </View>
    {buttonTitle ? (
      <TouchableOpacity
        onPress={onButtonPress}
        disabled={buttonDisabled}
        style={[styles.inlineButton, buttonDisabled && styles.inlineButtonDisabled]}
      >
        <Text style={[styles.inlineButtonText, buttonDisabled && { color: '#9CA3AF' }]}>{buttonTitle}</Text>
      </TouchableOpacity>
    ) : (
      <Text style={[styles.verificationStatusText, { color: statusColor }]}>{status}</Text>
    )}
  </View>
);

const getStudentVerificationStatus = (verification) => {
  if (!verification) {
    return { status: 'not_verified', text: 'Chưa xác minh', color: '#9CA3AF' };
  }

  const status = verification.status?.toLowerCase();
  if (['active', 'verified', 'approved'].includes(status)) {
    return { status: 'verified', text: 'Đã xác minh', color: '#22C55E' };
  }
  if (status === 'pending') {
    return { status: 'pending', text: 'Đang xác minh', color: '#F59E0B' };
  }
  if (['rejected', 'suspended'].includes(status)) {
    return { status: 'rejected', text: 'Bị từ chối', color: '#EF4444' };
  }
  return { status: 'not_verified', text: 'Chưa xác minh', color: '#9CA3AF' };
};

const getDriverVerificationStatus = (user, studentStatus) => {
  if (studentStatus.status !== 'verified') {
    return {
      status: 'locked',
      text: 'Cần xác minh sinh viên trước',
      color: '#9CA3AF',
      disabled: true,
    };
  }

  const driverProfile = user?.driver_profile;
  if (!driverProfile) {
    return { status: 'not_verified', text: 'Chưa xác minh', color: '#9CA3AF' };
  }

  const status = driverProfile.status?.toLowerCase();
  if (['active', 'verified', 'approved'].includes(status)) {
    return { status: 'verified', text: 'Đã xác minh', color: '#22C55E' };
  }
  if (status === 'pending') {
    return { status: 'pending', text: 'Đang xác minh', color: '#F59E0B', disabled: true };
  }
  if (['rejected', 'suspended'].includes(status)) {
    return { status: 'rejected', text: 'Bị từ chối', color: '#EF4444' };
  }
  return { status: 'not_verified', text: 'Chưa xác minh', color: '#9CA3AF' };
};

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
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },
  currentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  roundIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modeDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 14,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    marginBottom: 10,
  },
  modeRowDisabled: {
    opacity: 0.6,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeInfo: {
    flex: 1,
    gap: 4,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modeSubtitle: {
    fontSize: 13,
    color: '#8A8A93',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  badgeWarning: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  badgeWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  heroCard: {
    paddingVertical: 24,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0A',
  },
  cardPadding: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 18,
  },
  // removed styles related to mode switching and action buttons
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  verificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationInfo: {
    flex: 1,
    gap: 4,
  },
  verificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  verificationDescription: {
    fontSize: 13,
    color: '#8A8A93',
    lineHeight: 20,
  },
  verificationStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inlineButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  inlineButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
  inlineButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // removed info banner and actions card styles
});

export default ProfileSwitchScreen;
