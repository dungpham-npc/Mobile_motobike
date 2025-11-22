import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import verificationService from '../../services/verificationService';
import authService from '../../services/authService';
import { colors } from '../../theme/designTokens';
import useSoftHeaderSpacing from '../../hooks/useSoftHeaderSpacing.js';

const AccountVerificationScreen = ({ navigation }) => {
  const { headerOffset, contentPaddingTop } = useSoftHeaderSpacing({ contentExtra: 56 });
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentStudentVerification, setCurrentStudentVerification] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshVerificationStatus();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      const profile = authService.getCurrentUser() || await authService.getCurrentUserProfile();
      setUser(profile);
      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentStudentVerification(verification);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể tải thông tin xác minh');
    } finally {
      setLoading(false);
    }
  };

  const refreshVerificationStatus = async () => {
    try {
      const verification = await verificationService.getCurrentStudentVerification();
      setCurrentStudentVerification(verification);
    } catch (error) {}
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
      Alert.alert('Giấy tờ bị từ chối', `Giấy tờ đã bị từ chối với lý do: ${reason}\n\nBạn có thể gửi lại giấy tờ mới.`, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Gửi lại', onPress: () => navigation.navigate('StudentVerification') },
      ]);
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
          <SoftBackHeader floating topOffset={headerOffset} title="" subtitle="" onBackPress={() => navigation.goBack()} />
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
        <SoftBackHeader floating topOffset={headerOffset} title="" subtitle="" onBackPress={() => navigation.goBack()} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: contentPaddingTop }]}> 
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
};

const VerificationRow = ({ title, description, icon, status, statusColor, buttonTitle, buttonDisabled, onButtonPress }) => (
  <View style={styles.verificationRow}>
    <View style={styles.verificationIcon}>
      <Feather name={icon} size={18} color={colors.accent} />
    </View>
    <View style={styles.verificationInfo}>
      <Text style={styles.verificationTitle}>{title}</Text>
      <Text style={styles.verificationDescription}>{description}</Text>
    </View>
    {buttonTitle ? (
      <TouchableOpacity onPress={onButtonPress} disabled={buttonDisabled} style={[styles.inlineButton, buttonDisabled && styles.inlineButtonDisabled]}>
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
    return { status: 'locked', text: 'Cần xác minh sinh viên trước', color: '#9CA3AF', disabled: true };
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
  safe: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40, gap: 24 },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0A0A0A' },
  cardPadding: { paddingHorizontal: 20, paddingVertical: 20, gap: 18 },
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
  verificationInfo: { flex: 1, gap: 4 },
  verificationTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  verificationDescription: { fontSize: 13, color: '#8A8A93', lineHeight: 20 },
  verificationStatusText: { fontSize: 13, fontWeight: '600' },
  inlineButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.accent },
  inlineButtonDisabled: { backgroundColor: 'rgba(148,163,184,0.28)' },
  inlineButtonText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
});

export default AccountVerificationScreen;


