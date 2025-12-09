import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';
import { useFocusEffect } from '@react-navigation/native';

import GlassHeader from '../../components/ui/GlassHeader.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import { StatusBar } from 'react-native';
import { colors, typography, spacing } from '../../theme/designTokens';
import paymentService from '../../services/paymentService';

const DriverEarningsScreen = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  const COMMISSION_RATE = 0.2; // Keep in sync with backend estimate in DriverEarningsResponse

  const periods = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week', label: 'Tuần này' },
    { key: 'month', label: 'Tháng này' },
    { key: 'year', label: 'Năm này' }
  ];

  const toNumber = (value) => {
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const normalizeTransactions = useCallback((rawList) => {
    const list = Array.isArray(rawList) ? rawList : [];

    return list
      .map((tx) => ({
        ...tx,
        amount: toNumber(tx.amount),
        type: (tx.type || '').toUpperCase(),
        direction: (tx.direction || '').toUpperCase(),
        status: (tx.status || '').toUpperCase(),
        createdAt: tx.createdAt || tx.created_at || tx.timestamp,
        sharedRideId: tx.sharedRideId || tx.shared_ride_id || tx.sharedRideID,
      }))
      .filter((tx) => tx.type === 'CAPTURE_FARE')
      .filter((tx) => tx.direction === 'IN')
      .filter((tx) => !tx.status || tx.status === 'SUCCESS')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, []);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [earningsRes, txRes, walletInfo] = await Promise.all([
          paymentService.getDriverEarnings(),
          paymentService.getTransactionHistory(0, 100, 'CAPTURE_FARE', 'SUCCESS'),
          paymentService.getWalletInfo().catch(() => null), // Fallback if fails
        ]);

        // Log for debugging
        console.log('Driver earnings response:', earningsRes);
        console.log('Wallet info response:', walletInfo);

        // Merge earnings response with wallet info to ensure availableBalance is present
        const mergedSummary = {
          ...earningsRes,
          // If availableBalance is missing from earnings response, use wallet info
          availableBalance: earningsRes?.availableBalance ?? walletInfo?.availableBalance ?? 0,
          pendingEarnings: earningsRes?.pendingEarnings ?? walletInfo?.pendingBalance ?? 0,
        };

        setSummary(mergedSummary);

        const txList = Array.isArray(txRes?.content)
          ? txRes.content
          : Array.isArray(txRes?.data)
          ? txRes.data
          : Array.isArray(txRes?.items)
          ? txRes.items
          : Array.isArray(txRes)
          ? txRes
          : [];

        setTransactions(normalizeTransactions(txList));
      } catch (err) {
        console.error('Failed to load driver earnings:', err);
        setError(err?.message || 'Không thể tải dữ liệu thu nhập');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [normalizeTransactions]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  const getPeriodStart = (periodKey) => {
    const now = new Date();
    switch (periodKey) {
      case 'today': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case 'week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday as start
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - diff);
        return d;
      }
      case 'month': {
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
      case 'year': {
        return new Date(now.getFullYear(), 0, 1);
      }
      default:
        return new Date(0);
    }
  };

  const estimateCommission = (netAmount) => {
    if (COMMISSION_RATE === 0) return 0;
    return netAmount * COMMISSION_RATE / (1 - COMMISSION_RATE);
  };

  const buildPeriodData = useCallback(
    (periodKey) => {
      const start = getPeriodStart(periodKey);
      const filtered = transactions.filter((tx) => {
        const created = new Date(tx.createdAt);
        return created >= start;
      });

      let net = filtered.reduce((sum, tx) => sum + toNumber(tx.amount), 0);
      if (periodKey === 'week' && summary?.weekEarnings != null) {
        net = toNumber(summary.weekEarnings);
      } else if (periodKey === 'month' && summary?.monthEarnings != null) {
        net = toNumber(summary.monthEarnings);
      } else if (periodKey === 'year' && summary?.totalEarnings != null && net === 0) {
        net = toNumber(summary.totalEarnings);
      }

      const commission = net > 0 ? estimateCommission(net) : 0;
      const gross = net + commission;
      const rides = filtered.length;

      return {
        gross,
        commission,
        net,
        rides,
      };
    },
    [summary, transactions]
  );

  const currentData = buildPeriodData(selectedPeriod);

  const recentEarnings = transactions.slice(0, 10);

  const handleWithdrawal = () => {
    Alert.alert(
      'Yêu cầu rút tiền',
      `Số dư khả dụng: ${toNumber(summary?.availableBalance).toLocaleString()} VNĐ\nPhí xử lý: 5,000 VNĐ`,
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
    return date.toLocaleString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const onRefresh = async () => {
    fetchData(true);
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <StatusBar barStyle="light-content" />
          <View style={styles.headerSpacing}>
            <GlassHeader
              title="Thu nhập của tôi"
              subtitle="Đang tải dữ liệu..."
            />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

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
                  {toNumber(currentData.net).toLocaleString()}đ
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
                      {currentData.rides > 0
                        ? Math.round(currentData.net / currentData.rides).toLocaleString()
                        : '0'}đ/chuyến
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
                        {toNumber(currentData.gross).toLocaleString()}đ
                      </Text>
                    </View>
                  </View>

                  <View style={styles.breakdownItem}>
                    <View style={[styles.breakdownIcon, { backgroundColor: '#FFF4E6' }]}>
                      <Icon name="remove-circle" size={18} color="#FF9800" />
                    </View>
                    <View style={styles.breakdownContent}>
                      <Text style={styles.breakdownLabel}>
                        Hoa hồng (ước tính {COMMISSION_RATE * 100}%)
                      </Text>
                      <Text style={[styles.breakdownValue, styles.breakdownValueNegative]}>
                        -{toNumber(currentData.commission).toLocaleString()}đ
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
                      {toNumber(summary?.availableBalance).toLocaleString()}đ
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
                  key={earning.txnId || earning.id || index}
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
                          <Text style={styles.earningRider}>
                            {earning.riderName || earning.note || `Chuyến đi #${earning.sharedRideId || earning.sharedRideRequestId || 'N/A'}`}
                          </Text>
                          <Text style={styles.earningTime}>{formatDate(earning.createdAt)}</Text>
                        </View>
                      </View>
                      <Text style={styles.earningAmount}>+{toNumber(earning.amount).toLocaleString()}đ</Text>
                    </View>
                    <Text style={styles.earningRoute} numberOfLines={1}>
                      {earning.note || 'Hoa hồng đã trừ'}
                    </Text>
                    <View style={styles.earningDetails}>
                      <Text style={styles.earningDetailText}>
                        Thu nhập: {toNumber(earning.amount).toLocaleString()}đ
                      </Text>
                      <Text style={styles.earningDetailText}>
                        Hoa hồng (ước tính): -{toNumber(estimateCommission(toNumber(earning.amount))).toLocaleString()}đ
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
                  Số dư khả dụng: {toNumber(summary?.availableBalance).toLocaleString()} VNĐ
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
                    onPress={() => confirmWithdrawal(toNumber(summary?.availableBalance))}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: typography.body,
    fontFamily: 'Inter_500Medium',
    color: colors.error || '#EF4444',
    textAlign: 'center',
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
