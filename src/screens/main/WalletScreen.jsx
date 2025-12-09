import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';

import ModernButton from '../../components/ModernButton.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import paymentService from '../../services/paymentService';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';
import { parseBackendDate } from '../../utils/time';

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [user, setUser] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  // Reload ví mỗi khi màn hình được focus (ví dụ sau khi quay lại từ PayOS deep link)
  useFocusEffect(
    useCallback(() => {
      loadWalletData();
    }, [])
  );


  const loadWalletData = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      const walletResponse = await paymentService.getWalletInfo();
      
      // Ensure we're using the correct field names from backend
      const walletData = {
        ...walletResponse,
        availableBalance: walletResponse?.availableBalance ?? walletResponse?.available_balance ?? 0,
        pendingBalance: walletResponse?.pendingBalance ?? walletResponse?.pending_balance ?? 0,
      };

      setWalletData(walletData);

      await loadTransactions();
    } catch (error) {
      console.error('Error loading wallet data:', error);
      Alert.alert('Lỗi', 'Không thể tải thông tin ví');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (showLoading = false) => {
    if (showLoading) setLoadingTransactions(true);

    try {
      // Use new transaction history API endpoint
      const response = await paymentService.getTransactionHistory(0, 20);
      
      // Handle both old and new API response formats
      if (response) {
        if (response.content && Array.isArray(response.content)) {
          setTransactions(response.content);
        } else if (Array.isArray(response)) {
          setTransactions(response);
        } else if (response.data && Array.isArray(response.data)) {
          setTransactions(response.data);
        } else {
          console.warn('Unexpected transaction history response format:', response);
          setTransactions([]);
        }
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      if (showLoading) setLoadingTransactions(false);
    }
  };

  console.log(transactions);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await authService.getCurrentUserProfile();
      await loadWalletData();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };


  const getTransactionIcon = (type, direction) => {
    const normalized = normalizeDirection(direction);
    const icon = paymentService.getTransactionIcon(type, normalized);
    let color = colors.textSecondary;

    switch (type) {
      // User deposits funds via PSP
      case 'TOP_UP':
      case 'TOPUP':
        color = '#22C55E'; // Green
        break;
      
      // Financial hold for quoted fare
      case 'HOLD_CREATE':
        color = '#8B5CF6'; // Purple
        break;
      
      // Release of financial hold
      case 'HOLD_RELEASE':
        color = '#10B981'; // Emerald
        break;
      
      // Final payment deduction upon ride completion
      case 'CAPTURE_FARE':
        color = normalized === 'OUTBOUND' ? '#EF4444' : '#22C55E';
        break;
      
      // Withdrawal to external bank/PSP
      case 'WITHDRAW':
      case 'PAYOUT':
        color = '#F97316'; // Orange
        break;
      
      // Promotional credit
      case 'PROMO_CREDIT':
        color = '#EC4899'; // Pink
        break;
      
      // Corrections, compensation, reversals
      case 'ADJUSTMENT':
        color = '#6366F1'; // Indigo
        break;
      
      // Refund
      case 'REFUND':
        color = '#0EA5E9'; // Sky blue
        break;
      
      // Legacy/fallback types
      case 'RIDE_PAYMENT':
        color = normalized === 'OUTBOUND' ? '#EF4444' : '#22C55E';
        break;
      case 'RIDE_EARNING':
        color = '#3B82F6'; // Blue
        break;
      case 'COMMISSION':
        color = '#8B5CF6'; // Purple
        break;
      
      default:
        color = colors.textSecondary;
    }

    return { name: icon, color };
  };

  // Parse transaction note to extract meaningful information
  const parseTransactionNote = (note, type) => {
    if (!note) return 'Giao dịch ví';
    
    // For PAYOUT, extract bank info
    if (type === 'PAYOUT' || type === 'WITHDRAW') {
      const bankMatch = note.match(/Payout to ([^-]+)/);
      const accountMatch = note.match(/\*\*\*\*(\d+)/);
      if (bankMatch && accountMatch) {
        return `Rút tiền đến ${bankMatch[1].trim()} - ****${accountMatch[1]}`;
      }
      // Fallback: extract from note format
      const bankNameMatch = note.match(/bankName:([^|]+)/);
      const accountMatch2 = note.match(/bankAccountNumber:(\d+)/);
      if (bankNameMatch) {
        const bankName = bankNameMatch[1].trim();
        if (accountMatch2) {
          const account = accountMatch2[1];
          const maskedAccount = account.length > 4 ? `****${account.slice(-4)}` : account;
          return `Rút tiền đến ${bankName} - ${maskedAccount}`;
        }
        return `Rút tiền đến ${bankName}`;
      }
    }
    
    // For HOLD_CREATE, extract booking info
    if (type === 'HOLD_CREATE') {
      const bookingMatch = note.match(/Hold for booking request #(\d+)/);
      if (bookingMatch) {
        return `Tạm giữ cho yêu cầu đặt chỗ #${bookingMatch[1]}`;
      }
      const holdMatch = note.match(/Hold: (.+)/);
      if (holdMatch) {
        return holdMatch[1];
      }
      return 'Tạm giữ tiền';
    }
    
    // For HOLD_RELEASE
    if (type === 'HOLD_RELEASE') {
      return 'Giải phóng tiền tạm giữ';
    }
    
    // For CAPTURE_FARE
    if (type === 'CAPTURE_FARE') {
      const rideMatch = note.match(/Ride #(\d+)/);
      if (rideMatch) {
        return `Thanh toán chuyến đi #${rideMatch[1]}`;
      }
      return 'Thanh toán chuyến đi';
    }
    
    // For TOPUP, extract status
    if (type === 'TOPUP' || type === 'TOP_UP') {
      if (note.includes('Failed')) {
        return 'Nạp tiền thất bại';
      }
      if (note.includes('Success') || note.includes('top-up') || note.includes('topup')) {
        return 'Nạp tiền thành công';
      }
      // Extract amount if available
      const amountMatch = note.match(/(\d{1,3}(?:[.,]\d{3})*)\s*VND/);
      if (amountMatch) {
        return `Nạp tiền ${amountMatch[1]} VND`;
      }
    }
    
    // For PROMO_CREDIT
    if (type === 'PROMO_CREDIT') {
      return 'Khuyến mãi/Ưu đãi';
    }
    
    // For ADJUSTMENT
    if (type === 'ADJUSTMENT') {
      return 'Điều chỉnh số dư';
    }
    
    // For REFUND
    if (type === 'REFUND') {
      const refundMatch = note.match(/Refund.*?(\d+)/);
      if (refundMatch) {
        return `Hoàn tiền cho giao dịch #${refundMatch[1]}`;
      }
      return 'Hoàn tiền';
    }
    
    // Default: return first 50 chars of note
    return note.length > 50 ? note.substring(0, 50) + '...' : note;
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return '#22C55E';
      case 'PENDING':
      case 'PROCESSING':
        return '#F97316';
      case 'FAILED':
        return '#EF4444';
      default:
        return colors.textMuted;
    }
  };

  // Get status text in Vietnamese
  const getStatusText = (status) => {
    switch (status) {
      case 'SUCCESS':
      case 'COMPLETED':
        return 'Thành công';
      case 'PENDING':
        return 'Đang chờ';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'FAILED':
        return 'Thất bại';
      default:
        return status || 'Không xác định';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Format với locale Việt Nam, không chuyển đổi timezone
    return `${date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })} ${date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`;
  };

  // Normalize direction from backend (IN/OUT/INTERNAL) to standard format (INBOUND/OUTBOUND/INTERNAL)
  const normalizeDirection = (direction) => {
    if (!direction) return 'OUTBOUND';
    const upper = direction.toUpperCase();
    if (upper === 'IN' || upper === 'INBOUND') return 'INBOUND';
    if (upper === 'OUT' || upper === 'OUTBOUND') return 'OUTBOUND';
    if (upper === 'INTERNAL') return 'INTERNAL';
    return 'OUTBOUND';
  };

  const formatTransactionAmount = (amount, direction) => {
    const normalized = normalizeDirection(direction);
    if (normalized === 'INTERNAL') {
      return paymentService.formatCurrency(Math.abs(amount));
    }
    const sign = normalized === 'INBOUND' ? '+' : '-';
    return `${sign}${paymentService.formatCurrency(Math.abs(amount))}`;
  };

  const getTransactionAmountColor = (direction) => {
    const normalized = normalizeDirection(direction);
    if (normalized === 'INTERNAL') {
      return '#8B5CF6'; // Purple for internal transactions
    }
    return normalized === 'INBOUND' ? '#22C55E' : '#EF4444';
  };

  // Calculate total topped up and total spent from transactions
  const calculateStats = () => {
    if (!transactions || transactions.length === 0) {
      return {
        totalToppedUp: walletData?.total_topped_up || walletData?.totalToppedUp || 0,
        totalSpent: walletData?.total_spent || walletData?.totalSpent || 0,
      };
    }

    let totalToppedUp = 0;
    let totalSpent = 0;

    transactions.forEach((transaction) => {
      const normalized = normalizeDirection(transaction.direction);
      const amount = Math.abs(transaction.amount || 0);

      // Only count SUCCESS transactions for stats
      if (transaction.status !== 'SUCCESS' && transaction.status !== 'COMPLETED') {
        return;
      }

      // Count top-ups
      if (transaction.type === 'TOP_UP' || transaction.type === 'TOPUP') {
        totalToppedUp += amount;
      } 
      // Count outbound payments and withdrawals
      else if (normalized === 'OUTBOUND') {
        if (transaction.type === 'PAYOUT' || transaction.type === 'WITHDRAW') {
          totalSpent += amount;
        } else if (transaction.type === 'CAPTURE_FARE' || transaction.type === 'RIDE_PAYMENT') {
          totalSpent += amount;
        }
      }
      // INTERNAL transactions (HOLD_CREATE, HOLD_RELEASE, ADJUSTMENT) don't count toward stats
      // PROMO_CREDIT, REFUND are INBOUND but don't count as top-up
    });

    // Use walletData if available, otherwise use calculated values
    return {
      totalToppedUp: walletData?.total_topped_up || walletData?.totalToppedUp || totalToppedUp,
      totalSpent: walletData?.total_spent || walletData?.totalSpent || totalSpent,
    };
  };

  if (loading) {
    return (
      <AppBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={styles.safe}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Đang tải thông tin ví...</Text>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
      >
        <SafeAreaView style={[styles.safe, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <StatusBar barStyle="dark-content" />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: (tabBarHeight || 80) + 40 + Math.max(insets.bottom, 0) },
            ]}
          >
            <View style={styles.headerSpacing}>
              <GlassHeader title="Ví của tôi" subtitle="Quản lý giao dịch" />
            </View>

            <Animatable.View animation="fadeInUp" duration={500}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.balanceCardContent}>
                <LinearGradient
                  colors={['#EEF7FF', '#E0EDFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.balanceGradient}
                >
                  <View style={styles.balanceHeader}>
                    <Icon name="account-balance-wallet" size={30} color="#0F172A" />
                    <View style={styles.balanceInfo}>
                      <Text style={styles.balanceLabel}>Số dư khả dụng</Text>
                      <Text style={styles.balanceAmount}>
                        {paymentService.formatCurrency(
                          walletData?.availableBalance ?? 
                          walletData?.available_balance ?? 
                          0
                        )}
                      </Text>
                    </View>
                  </View>

                  {(walletData?.pendingBalance > 0 || walletData?.pending_balance > 0) && (
                    <View style={styles.pendingBalance}>
                      <Icon name="hourglass-empty" size={16} color="#F97316" />
                      <Text style={styles.pendingBalanceText}>
                        Đang chờ: {paymentService.formatCurrency(
                          walletData?.pendingBalance ?? 
                          walletData?.pending_balance ?? 
                          0
                        )}
                      </Text>
                    </View>
                  )}

                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.actionButton} 
                      onPress={() => navigation.navigate('QRPayment', { type: 'topup' })}
                    >
                      <Icon name="add" size={20} color="#0F172A" />
                      <Text style={styles.actionButtonText}>Nạp tiền</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionButton} 
                      onPress={() => navigation.navigate('Withdraw', { walletData })}
                    >
                      <Icon name="send" size={20} color="#0F172A" />
                      <Text style={styles.actionButtonText}>Rút tiền</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </CleanCard>
            </Animatable.View>

            {(() => {
              const stats = calculateStats();
              return (stats.totalToppedUp > 0 || stats.totalSpent > 0) ? (
                <Animatable.View animation="fadeInUp" duration={500} delay={140}>
                  <CleanCard style={styles.cardSpacing} contentStyle={styles.statsCardContent}>
                    <Text style={styles.sectionTitle}>Thống kê</Text>
                    <View style={styles.statsContainer}>
                      <View style={styles.statItem}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#22C55E20' }]}>
                          <Icon name="trending-up" size={22} color="#22C55E" />
                        </View>
                        <Text style={styles.statValue}>
                          {paymentService.formatCurrency(stats.totalToppedUp)}
                        </Text>
                        <Text style={styles.statLabel}>Tổng nạp</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <View style={[styles.statIconContainer, { backgroundColor: '#EF444420' }]}>
                          <Icon name="trending-down" size={22} color="#EF4444" />
                        </View>
                        <Text style={styles.statValue}>
                          {paymentService.formatCurrency(stats.totalSpent)}
                        </Text>
                        <Text style={styles.statLabel}>Tổng chi</Text>
                      </View>
                    </View>
                  </CleanCard>
                </Animatable.View>
              ) : null;
            })()}

            <Animatable.View animation="fadeInUp" duration={500} delay={200}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.transactionCardContent}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
                  {loadingTransactions && <ActivityIndicator size="small" color={colors.accent} />}
                </View>

                {transactions.length === 0 ? (
                  <View style={styles.emptyTransactions}>
                    <Icon name="receipt" size={44} color={colors.textMuted} />
                    <Text style={styles.emptyTransactionsText}>Chưa có giao dịch nào</Text>
                  </View>
                ) : (
                  transactions.map((transaction) => {
                    const icon = getTransactionIcon(transaction.type, transaction.direction);
                    const statusColor = getStatusColor(transaction.status);
                    const parsedNote = parseTransactionNote(transaction.note, transaction.type);
                    const showStatusBadge = transaction.status && transaction.status !== 'SUCCESS' && transaction.status !== 'COMPLETED';
                    
                    return (
                      <View key={transaction.txnId || transaction.id} style={styles.transactionItem}>
                        <View style={styles.transactionLeft}>
                          <View style={[styles.transactionIcon, { backgroundColor: icon.color + '20' }]}>
                            <Icon name={icon.name} size={20} color={icon.color} />
                          </View>
                          <View style={styles.transactionInfo}>
                            <View style={styles.transactionHeaderRow}>
                              <Text style={styles.transactionDescription}>
                                {paymentService.getTransactionTypeText(transaction.type)}
                              </Text>
                              {showStatusBadge && (
                                <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                                    {getStatusText(transaction.status)}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.transactionNote} numberOfLines={2}>
                              {parsedNote}
                            </Text>
                            <Text style={styles.transactionDate}>
                              {formatDate(transaction.createdAt || transaction.created_at)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.transactionRight}>
                          <Text style={[styles.transactionAmount, { color: getTransactionAmountColor(transaction.direction) }]}>
                            {formatTransactionAmount(transaction.amount, transaction.direction)}
                          </Text>
                          {/* Show balance changes if available */}
                          {transaction.afterAvail !== null && transaction.afterAvail !== undefined && (
                            <Text style={styles.transactionBalance}>
                              Số dư: {paymentService.formatCurrency(transaction.afterAvail)}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}

              </CleanCard>
            </Animatable.View>
          </ScrollView>

        </SafeAreaView>
      </KeyboardAvoidingView>
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
  balanceCardContent: {
    padding: 0,
    overflow: 'hidden',
  },
  balanceGradient: {
    borderRadius: 20,
    padding: 20,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#3A4B63',
    marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: '#0F172A',
  },
  pendingBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  pendingBalanceText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#C2410C',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#0F172A',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  statsCardContent: {
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(148,163,184,0.2)',
  },
  transactionCardContent: {
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyTransactionsText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.18)',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 8,
  },
  transactionDescription: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  transactionNote: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  transactionAmount: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  transactionBalance: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.35)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F7F8FC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
    shadowColor: 'rgba(15,23,42,0.2)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  bankSelector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  bankSelectorText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  bankSelectorPlaceholder: {
    color: colors.textMuted,
    fontFamily: 'Inter_400Regular',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#F7F8FC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  pickerLoading: {
    padding: 40,
    alignItems: 'center',
  },
  pickerEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  bankItem: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.18)',
  },
  bankItemName: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bankItemBin: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 18,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  modalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
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
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#22C55E',
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  modeSelector: {
    marginTop: 8,
    marginBottom: 8,
  },
  modeLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.3)',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#EEF7FF',
    borderColor: colors.accent,
  },
  modeButtonText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  modeHelperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
    marginTop: 4,
  },
});

export default WalletScreen;
