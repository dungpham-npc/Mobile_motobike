import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import mockData from '../../data/mockData.json';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { StatusBar } from 'react-native';
import { colors, typography, spacing } from '../../theme/designTokens';

const DriverEarningsScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const driver = mockData.users[1];
  const earnings = driver.earnings;

  const periods = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'year', label: 'Năm này' }
  ];

  const earningsData = {
    today: { gross: 125000, commission: 18750, net: 106250, rides: 8 },
    week: { gross: 850000, commission: 127500, net: 722500, rides: 45 },
    month: { gross: 3200000, commission: 480000, net: 2720000, rides: 180 },
    year: { gross: 28500000, commission: 4275000, net: 24225000, rides: 1520 }
  };

  const currentData = earningsData[selectedPeriod];
  const commissionRate = earnings.commission;

  const recentEarnings = [
    {
      id: 1,
      date: '2024-01-16T14:30:00Z',
      riderName: 'Nguyen Van A',
      route: 'Ký túc xá A → Trường FPT',
      fare: 15000,
      commission: 2250,
      net: 12750,
      status: 'completed'
    },
    {
      id: 2,
      date: '2024-01-16T12:15:00Z',
      riderName: 'Le Thi B',
      route: 'Nhà văn hóa → Chợ Bến Thành',
      fare: 25000,
      commission: 3750,
      net: 21250,
      status: 'completed'
    },
    {
      id: 3,
      date: '2024-01-16T10:45:00Z',
      riderName: 'Pham Van C',
      route: 'Trọ sinh viên → Trường FPT',
      fare: 18000,
      commission: 2700,
      net: 15300,
      status: 'completed'
    }
  ];

  const handleWithdrawal = () => {
    Alert.alert(
      'Yêu cầu rút tiền',
      `Số dư khả dụng: ${earnings.thisMonth.toLocaleString()} VNĐ\nPhí xử lý: 5,000 VNĐ`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Tiếp tục', onPress: () => setShowWithdrawal(true) }
      ]
    );
  };

  const confirmWithdrawal = (amount) => {
    Alert.alert(
      'Xác nhận rút tiền',
      `Rút ${amount.toLocaleString()} VNĐ về tài khoản ngân hàng?\nYêu cầu sẽ được xử lý trong 1-2 ngày làm việc.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Xác nhận', onPress: () => {
          setShowWithdrawal(false);
          Alert.alert('Thành công', 'Yêu cầu rút tiền đã được gửi đi. Chúng tôi sẽ xử lý trong 1-2 ngày làm việc.');
        }}
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k`;
    }
    return amount.toString();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <AppBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
          }
        >
          <View style={styles.headerSpacing}>
            <GlassHeader
              title="Thu nhập của tôi"
              subtitle="Theo dõi thu nhập và rút tiền"
            />
          </View>

          <View style={styles.content}>
            {/* Period Selector */}
            <Animatable.View animation="fadeInUp" duration={400}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodContainer}
              >
                {periods.map((period) => (
                  <TouchableOpacity
                    key={period.key}
                    style={[
                      styles.periodTab,
                      selectedPeriod === period.key && styles.periodTabActive
                    ]}
                    onPress={() => setSelectedPeriod(period.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.periodTabText,
                      selectedPeriod === period.key && styles.periodTabTextActive
                    ]}>
                      {period.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animatable.View>

            {/* Net Earnings Hero */}
            <Animatable.View animation="fadeInUp" duration={400} delay={60}>
              <CleanCard style={styles.heroCard} contentStyle={styles.heroCardContent}>
                <Text style={styles.heroLabel}>Thu nhập ròng</Text>
                <Text style={styles.heroAmount}>
                  {currentData.net.toLocaleString()}đ
                </Text>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Icon name="directions-car" size={16} color={colors.textSecondary} />
                    <Text style={styles.heroMetaText}>{currentData.rides} chuyến</Text>
                  </View>
                  <View style={styles.heroMetaDivider} />
                  <View style={styles.heroMetaItem}>
                    <Icon name="trending-up" size={16} color={colors.textSecondary} />
                    <Text style={styles.heroMetaText}>
                      {Math.round(currentData.net / currentData.rides).toLocaleString()}đ/chuyến
                    </Text>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Earnings Breakdown */}
            <Animatable.View animation="fadeInUp" duration={400} delay={120}>
              <CleanCard style={styles.breakdownCard} contentStyle={styles.breakdownCardContent}>
                <Text style={styles.cardTitle}>Chi tiết thu nhập</Text>
                <View style={styles.breakdownList}>
                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownIcon, { backgroundColor: '#E3F2FD' }]}>
                      <Icon name="trending-up" size={18} color="#2196F3" />
                    </View>
                    <View style={styles.breakdownContent}>
                      <Text style={styles.breakdownLabel}>Tổng doanh thu</Text>
                      <Text style={styles.breakdownValue}>
                        {currentData.gross.toLocaleString()}đ
                      </Text>
                    </View>
                  </View>

                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownIcon, { backgroundColor: '#FFF4E6' }]}>
                      <Icon name="remove-circle" size={18} color="#FF9800" />
                    </View>
                    <View style={styles.breakdownContent}>
                      <Text style={styles.breakdownLabel}>
                        Hoa hồng ({(commissionRate * 100)}%)
                      </Text>
                      <Text style={[styles.breakdownValue, styles.breakdownValueNegative]}>
                        -{currentData.commission.toLocaleString()}đ
                      </Text>
                    </View>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Available Balance */}
            <Animatable.View animation="fadeInUp" duration={400} delay={180}>
              <CleanCard style={styles.balanceCard} contentStyle={styles.balanceCardContent}>
                <View style={styles.balanceHeader}>
                  <View>
                    <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
                    <Text style={styles.balanceAmount}>
                      {earnings.thisMonth.toLocaleString()}đ
                    </Text>
                  </View>
                  <View style={[styles.balanceIcon, { backgroundColor: '#E8F5E9' }]}>
                    <Icon name="account-balance-wallet" size={24} color={colors.primary} />
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={handleWithdrawal}
                  activeOpacity={0.8}
                >
                  <View style={styles.withdrawButtonContent}>
                    <View style={styles.withdrawIconContainer}>
                      <Icon name="account-balance" size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.withdrawButtonText}>Rút tiền</Text>
                    <Icon name="arrow-forward" size={20} color="#FFFFFF" style={styles.withdrawArrow} />
                  </View>
                </TouchableOpacity>
              </CleanCard>
            </Animatable.View>

            {/* Recent Earnings */}
            <View style={styles.recentSection}>
              <Text style={styles.sectionTitle}>Thu nhập gần đây</Text>
              {recentEarnings.map((earning, index) => (
                <Animatable.View 
                  key={earning.id}
                  animation="fadeInUp" 
                  duration={400}
                  delay={240 + index * 40}
                >
                  <CleanCard style={styles.earningCard} contentStyle={styles.earningCardContent}>
                    <View style={styles.earningTop}>
                      <View style={styles.earningLeft}>
                        <View style={[styles.earningIcon, { backgroundColor: '#E8F5E9' }]}>
                          <Icon name="check-circle" size={18} color="#4CAF50" />
                        </View>
                        <View style={styles.earningInfo}>
                          <Text style={styles.earningRider}>{earning.riderName}</Text>
                          <Text style={styles.earningTime}>{formatDate(earning.date)}</Text>
                        </View>
                      </View>
                      <Text style={styles.earningAmount}>+{earning.net.toLocaleString()}đ</Text>
                    </View>
                    <Text style={styles.earningRoute} numberOfLines={1}>
                      {earning.route}
                    </Text>
                    <View style={styles.earningDetails}>
                      <Text style={styles.earningDetailText}>
                        Cước: {earning.fare.toLocaleString()}đ
                      </Text>
                      <Text style={styles.earningDetailText}>
                        Hoa hồng: -{earning.commission.toLocaleString()}đ
                      </Text>
                    </View>
                  </CleanCard>
                </Animatable.View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Withdrawal Modal */}
        {showWithdrawal && (
          <View style={styles.modalOverlay}>
            <Animatable.View animation="slideInUp" style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rút tiền</Text>
                <TouchableOpacity onPress={() => setShowWithdrawal(false)}>
                  <Icon name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={styles.availableBalance}>
                  Số dư khả dụng: {earnings.thisMonth.toLocaleString()} VNĐ
                </Text>
                
                <View style={styles.withdrawalOptions}>
                  <TouchableOpacity 
                    style={styles.withdrawalOption}
                    onPress={() => confirmWithdrawal(100000)}
                  >
                    <Text style={styles.withdrawalAmount}>100,000đ</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.withdrawalOption}
                    onPress={() => confirmWithdrawal(200000)}
                  >
                    <Text style={styles.withdrawalAmount}>200,000đ</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.withdrawalOption}
                    onPress={() => confirmWithdrawal(earnings.thisMonth)}
                  >
                    <Text style={styles.withdrawalAmount}>Tất cả</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.withdrawalNote}>
                  • Phí xử lý: 5,000 VNĐ{'\n'}
                  • Thời gian xử lý: 1-2 ngày làm việc{'\n'}
                  • Tiền sẽ được chuyển vào tài khoản đã đăng ký
                </Text>
              </View>
            </Animatable.View>
          </View>
        )}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  // Period Selector
  periodContainer: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  periodTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginRight: spacing.sm,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodTabText: {
    fontSize: typography.small,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  // Hero Card
  heroCard: {
    marginBottom: 0,
  },
  heroCardContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  heroAmount: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroMetaDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E5E7EB',
  },
  heroMetaText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  // Breakdown Card
  breakdownCard: {
    marginBottom: 0,
  },
  breakdownCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  breakdownList: {
    gap: spacing.md,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownContent: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  breakdownValue: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  breakdownValueNegative: {
    color: '#EF4444',
  },
  // Balance Card
  balanceCard: {
    marginBottom: 0,
  },
  balanceCardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  balanceIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawButton: {
    marginTop: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  withdrawButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  withdrawIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  withdrawButtonText: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  withdrawArrow: {
    marginLeft: 'auto',
  },
  // Recent Section
  recentSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  earningCard: {
    marginBottom: 0,
  },
  earningCardContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  earningTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  earningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  earningIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningInfo: {
    flex: 1,
  },
  earningRider: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  earningTime: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  earningAmount: {
    fontSize: typography.body,
    fontFamily: 'Inter_700Bold',
    color: '#4CAF50',
  },
  earningRoute: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  earningDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  earningDetailText: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: typography.subheading,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  modalBody: {
    padding: spacing.lg,
  },
  availableBalance: {
    fontSize: typography.body,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  withdrawalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  withdrawalOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  withdrawalAmount: {
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  withdrawalNote: {
    fontSize: typography.small,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default DriverEarningsScreen;
