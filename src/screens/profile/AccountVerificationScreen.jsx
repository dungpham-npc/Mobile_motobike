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
import authService from '../../services/authService';
import verificationService from '../../services/verificationService';
import { colors, typography, spacing } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const AccountVerificationScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 28 });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStudentVerification, setCurrentStudentVerification] = useState(null);
  const [currentDriverVerification, setCurrentDriverVerification] = useState(null);

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
      const [studentVerification, driverVerification] = await Promise.all([
        verificationService.getCurrentStudentVerification(),
        verificationService.getCurrentDriverVerification(),
      ]);
      setCurrentStudentVerification(studentVerification);
      setCurrentDriverVerification(driverVerification);
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

      await refreshVerificationStatus();
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
            title="Xác minh tài khoản"
            onBackPress={() => navigation.goBack()}
          />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
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
          title="Xác minh tài khoản"
          onBackPress={() => navigation.goBack()}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}
        >
          <CleanCard contentStyle={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Feather name="shield-check" size={22} color={colors.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>Xác minh tài khoản</Text>
              <Text style={styles.heroSubtitle}>
                Xác minh danh tính để sử dụng đầy đủ các tính năng của Campus Ride.
              </Text>
            </View>
          </CleanCard>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trạng thái xác minh</Text>
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
              <View style={styles.divider} />
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
            <CleanCard contentStyle={styles.helpCard}>
              <View style={styles.helpHeader}>
                <Feather name="help-circle" size={20} color={colors.primary} />
                <Text style={styles.helpTitle}>Cần hỗ trợ?</Text>
              </View>
              <Text style={styles.helpText}>
                Nếu bạn gặp vấn đề trong quá trình xác minh, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.
              </Text>
            </CleanCard>
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

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
      <Feather name={icon} size={18} color={colors.primary} />
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
    width: 48,
    height: 48,
    borderRadius: 16,
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
  },
  cardPadding: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginVertical: spacing.sm,
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
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  verificationDescription: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    lineHeight: 20,
  },
  verificationStatusText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
  },
  inlineButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  inlineButtonDisabled: {
    backgroundColor: 'rgba(148,163,184,0.28)',
  },
  inlineButtonText: {
    fontSize: typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
  infoBanner: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  helpCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  helpTitle: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  helpText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default AccountVerificationScreen;


