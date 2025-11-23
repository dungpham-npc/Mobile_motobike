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
import Feather from 'react-native-vector-icons/Feather';

import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import ModernButton from '../../components/ModernButton.jsx';
import authService from '../../services/authService';
import verificationService from '../../services/verificationService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const ProfileSwitchScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 28 });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [currentStudentVerification, setCurrentStudentVerification] = useState(null);

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

  const handleSwitchProfile = async (targetRole) => {
    if (!user) return;

    if (targetRole === 'driver' && !user.driver_profile) {
      Alert.alert(
        'Chưa thể chuyển đổi',
        'Bạn cần xác minh tài khoản tài xế trước. Vui lòng gửi giấy tờ để admin duyệt.',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Gửi giấy tờ', onPress: () => navigation.navigate('DriverVerification') },
        ]
      );
      return;
    }

    setSwitchLoading(true);

    try {
      await authService.switchProfile(targetRole);
      Alert.alert(
        'Thành công',
        `Đã chuyển sang chế độ ${targetRole === 'driver' ? 'Tài xế' : 'Hành khách'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (targetRole === 'driver') {
                navigation.replace('DriverMain');
              } else {
                navigation.replace('Main');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Switch profile error:', error);
      let errorMessage = 'Không thể chuyển đổi chế độ';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setSwitchLoading(false);
    }
  };

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
          <CleanCard contentStyle={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Feather name="git-branch" size={22} color={colors.accent} />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={styles.heroTitle}>Chuyển đổi chế độ</Text>
              <Text style={styles.heroSubtitle}>
                Chọn chế độ hoạt động phù hợp với nhu cầu sử dụng Campus Ride của bạn.
              </Text>
            </View>
          </CleanCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chế độ hiện tại</Text>
            <CleanCard contentStyle={styles.cardPadding}>
              <View style={styles.currentRow}>
                <View style={[styles.roundIcon, { backgroundColor: authService.isDriver() ? '#E7F2FF' : '#E6F6EF' }]}>
                  <Feather
                    name={authService.isDriver() ? 'truck' : 'user'}
                    size={22}
                    color={authService.isDriver() ? colors.accent : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.modeHeading}>{authService.isDriver() ? 'Tài xế' : 'Hành khách'}</Text>
                  <Text style={styles.modeDescription}>
                    {authService.isDriver()
                      ? 'Nhận chuyến đi từ sinh viên khác và kiếm thêm thu nhập.'
                      : 'Đặt chuyến đi và tìm tài xế chia sẻ trong khuôn viên.'}
                  </Text>
                </View>
              </View>
            </CleanCard>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chế độ có thể chuyển</Text>
            <ModeOption
              title="Hành khách"
              description="Đặt chuyến đi, tìm tài xế xung quanh"
              icon="user"
              tint={colors.primary}
              active={!authService.isDriver()}
              status={!authService.isDriver() ? 'Đang sử dụng' : undefined}
              onPress={() => handleSwitchProfile('rider')}
            />
            <ModeOption
              title="Tài xế"
              description="Chia sẻ chuyến đi, kiếm thêm thu nhập"
              icon="truck"
              tint={colors.accent}
              active={authService.isDriver()}
              status={!user?.driver_profile ? 'Cần xác minh' : authService.isDriver() ? 'Đang sử dụng' : undefined}
              disabled={!user?.driver_profile}
              onPress={() => handleSwitchProfile('driver')}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Xác minh tài khoản</Text>
            <CleanCard contentStyle={styles.cardPadding}>
              <VerificationRow
                title="Xác minh sinh viên"
                description="Gửi thẻ sinh viên để xác nhận bạn thuộc trường."
                icon="book-open"
                status={studentStatus.text}
                statusColor={studentStatus.color}
                buttonTitle={studentStatus.status === 'verified' ? undefined : 'Gửi giấy tờ'}
                buttonDisabled={studentStatus.status === 'pending'}
                onButtonPress={handleStudentVerificationPress}
              />
              <VerificationRow
                title="Xác minh tài xế"
                description="Gửi giấy tờ xe và bằng lái để trở thành tài xế chia sẻ."
                icon="clipboard"
                status={driverStatus.status === 'verified' ? driverStatus.text : undefined}
                statusColor={driverStatus.color}
                buttonTitle={driverStatus.status === 'verified' ? undefined : 'Gửi giấy tờ'}
                buttonDisabled={driverStatus.disabled || driverStatus.status === 'pending'}
                onButtonPress={() => navigation.navigate('DriverVerification')}
              />
            </CleanCard>
            <View style={styles.infoBanner}>
              <Feather name="info" size={16} color={colors.textSecondary} />
              <Text style={styles.infoBannerText}>
                Sau khi hoàn tất xác minh tài xế, bạn có thể chuyển đổi giữa hai chế độ bất kỳ lúc nào.
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <CleanCard contentStyle={styles.actionsCard}>
              <ModernButton
                variant="secondary"
                title="Trở về hồ sơ"
                onPress={() => navigation.goBack()}
              />
              <ModernButton
                title={switchLoading ? 'Đang chuyển...' : authService.isDriver() ? 'Sử dụng chế độ hành khách' : 'Sử dụng chế độ tài xế'}
                onPress={() => handleSwitchProfile(authService.isDriver() ? 'rider' : 'driver')}
                disabled={switchLoading || (!authService.isDriver() && !user?.driver_profile)}
              />
            </CleanCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const ModeOption = ({ title, description, icon, tint, status, active, disabled, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    disabled={disabled}
    style={[styles.modeOption, active && { borderColor: tint, borderWidth: 1.5 }, disabled && styles.modeOptionDisabled]}
  >
    <View style={[styles.modeIcon, { backgroundColor: active ? tint : 'rgba(17,24,39,0.06)' }]}>
      <Feather name={icon} size={20} color={active ? '#FFFFFF' : tint} />
    </View>
    <View style={styles.modeInfo}>
      <Text style={[styles.modeTitle, active && { color: '#111827' }]}>{title}</Text>
      <Text style={styles.modeSubtitle}>{description}</Text>
    </View>
    {status && (
      <View style={[styles.modeStatusBadge, { backgroundColor: `${tint}1A` }]}>
        <Text style={[styles.modeStatusText, { color: tint }]}>{status}</Text>
      </View>
    )}
  </TouchableOpacity>
);

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
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
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
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 18,
    gap: 16,
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  modeOptionDisabled: {
    opacity: 0.55,
  },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
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
    color: '#6B7280',
  },
  modeSubtitle: {
    fontSize: 13,
    color: '#8A8A93',
  },
  modeStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  modeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
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
  infoBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionsCard: {
    padding: 18,
    gap: 12,
  },
});

export default ProfileSwitchScreen;
