import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import ModernButton from '../../components/ModernButton.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import paymentService from '../../services/paymentService';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawData, setWithdrawData] = useState({
    amount: '',
    bankName: '',
    bankAccountNumber: '',
    accountHolderName: '',
  });

  const quickTopUpAmounts = [50000, 100000, 200000, 500000, 1000000];

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);

      const walletResponse = await paymentService.getWalletInfo();
      setWalletData(walletResponse);

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
      console.log('Transaction history response:', response);
      
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

  const handleQuickTopUp = (amount) => {
    navigation.navigate('QRPayment', { amount, type: 'topup' });
  };

  const handleCustomTopUp = () => {
    const amount = parseInt(topUpAmount, 10);

    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }

    try {
      paymentService.validateAmount(amount);
      setShowTopUpModal(false);
      setTopUpAmount('');
      navigation.navigate('QRPayment', { amount, type: 'topup' });
    } catch (error) {
      Alert.alert('Lỗi', error.message);
    }
  };

  const handleWithdraw = async () => {
    const { amount, bankName, bankAccountNumber, accountHolderName } = withdrawData;

    if (!amount || !bankName || !bankAccountNumber || !accountHolderName) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const withdrawAmount = parseInt(amount, 10);
    if (!withdrawAmount || withdrawAmount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (withdrawAmount < 50000) {
      Alert.alert('Lỗi', 'Số tiền rút tối thiểu là 50.000 VNĐ');
      return;
    }

    if (withdrawAmount > (walletData?.availableBalance || 0)) {
      Alert.alert('Lỗi', 'Số dư không đủ để thực hiện giao dịch');
      return;
    }

    if (!/^\d{9,16}$/.test(bankAccountNumber)) {
      Alert.alert('Lỗi', 'Số tài khoản ngân hàng không hợp lệ (9-16 chữ số)');
      return;
    }

    if (accountHolderName.length < 2) {
      Alert.alert('Lỗi', 'Tên chủ tài khoản phải có ít nhất 2 ký tự');
      return;
    }

    try {
      setLoading(true);
      const result = await paymentService.initiatePayout(
        withdrawAmount,
        bankName,
        bankAccountNumber,
        accountHolderName
      );

      if (result.success) {
        Alert.alert(
          'Thành công',
          result.message || 'Đã gửi yêu cầu rút tiền. Giao dịch sẽ được xử lý trong 1-3 ngày làm việc.',
          [{
            text: 'OK',
            onPress: () => {
              setShowWithdrawModal(false);
              setWithdrawData({
                amount: '',
                bankName: '',
                bankAccountNumber: '',
                accountHolderName: '',
              });
              loadWalletData();
            },
          }]
        );
      }
    } catch (error) {
      console.error('Withdraw error:', error);
      let errorMessage = 'Không thể thực hiện giao dịch rút tiền';
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = 'Thông tin không hợp lệ';
            break;
          case 403:
            errorMessage = 'Chỉ tài xế mới có thể rút tiền';
            break;
          case 401:
            errorMessage = 'Phiên đăng nhập đã hết hạn';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawInputChange = (field, value) => {
    setWithdrawData((prev) => ({ ...prev, [field]: value }));
  };

  const getTransactionIcon = (type, direction) => {
    const normalized = normalizeDirection(direction);
    const icon = paymentService.getTransactionIcon(type, normalized);
    let color = colors.textSecondary;

    switch (type) {
      case 'TOP_UP':
      case 'TOPUP':
        color = '#22C55E';
        break;
      case 'WITHDRAW':
        color = '#F97316';
        break;
      case 'RIDE_PAYMENT':
        color = normalized === 'OUTBOUND' ? '#EF4444' : '#22C55E';
        break;
      case 'RIDE_EARNING':
        color = '#3B82F6';
        break;
      case 'COMMISSION':
        color = '#8B5CF6';
        break;
      case 'REFUND':
        color = '#0EA5E9';
        break;
      default:
        color = colors.textSecondary;
    }

    return { name: icon, color };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  // Normalize direction from backend (IN/OUT) to standard format (INBOUND/OUTBOUND)
  const normalizeDirection = (direction) => {
    if (!direction) return 'OUTBOUND';
    const upper = direction.toUpperCase();
    if (upper === 'IN' || upper === 'INBOUND') return 'INBOUND';
    if (upper === 'OUT' || upper === 'OUTBOUND') return 'OUTBOUND';
    return 'OUTBOUND';
  };

  const formatTransactionAmount = (amount, direction) => {
    const normalized = normalizeDirection(direction);
    const sign = normalized === 'INBOUND' ? '+' : '-';
    return `${sign}${paymentService.formatCurrency(Math.abs(amount))}`;
  };

  const getTransactionAmountColor = (direction) => {
    const normalized = normalizeDirection(direction);
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

      if (transaction.type === 'TOP_UP' || transaction.type === 'TOPUP') {
        totalToppedUp += amount;
      } else if (normalized === 'INBOUND') {
        // Other inbound transactions (earnings, refunds, etc.)
        // Don't count as top-up
      } else if (normalized === 'OUTBOUND') {
        // Outbound transactions (payments, withdrawals, etc.)
        totalSpent += amount;
      }
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -40}
      >
        <SafeAreaView style={[styles.safe, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <StatusBar barStyle="dark-content" />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: 160 + Math.max(insets.bottom, 0) },
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
                        {paymentService.formatCurrency(walletData?.availableBalance)}
                      </Text>
                    </View>
                  </View>

                  {walletData?.pendingBalance > 0 && (
                    <View style={styles.pendingBalance}>
                      <Icon name="hourglass-empty" size={16} color="#F97316" />
                      <Text style={styles.pendingBalanceText}>
                        Đang chờ: {paymentService.formatCurrency(walletData.pendingBalance || walletData.pending_balance)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setShowTopUpModal(true)}>
                      <Icon name="add" size={20} color="#0F172A" />
                      <Text style={styles.actionButtonText}>Nạp tiền</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => setShowWithdrawModal(true)}>
                      <Icon name="send" size={20} color="#0F172A" />
                      <Text style={styles.actionButtonText}>Rút tiền</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </CleanCard>
            </Animatable.View>

            <Animatable.View animation="fadeInUp" duration={500} delay={80}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.quickCardContent}>
                <Text style={styles.sectionTitle}>Nạp nhanh</Text>
                <View style={styles.quickAmountsList}>
                  {quickTopUpAmounts.map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={styles.quickAmountItem}
                      onPress={() => handleQuickTopUp(amount)}
                    >
                      <Text style={styles.quickAmountText}>{paymentService.formatCurrency(amount)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                    return (
                      <View key={transaction.txnId || transaction.id} style={styles.transactionItem}>
                        <View style={styles.transactionLeft}>
                          <View style={[styles.transactionIcon, { backgroundColor: icon.color + '20' }]}>
                            <Icon name={icon.name} size={20} color={icon.color} />
                          </View>
                          <View style={styles.transactionInfo}>
                            <Text style={styles.transactionDescription}>
                              {paymentService.getTransactionTypeText(transaction.type)}
                            </Text>
                            <Text style={styles.transactionNote}>
                              {transaction.note || 'Giao dịch ví'}
                            </Text>
                            <Text style={styles.transactionDate}>{formatDate(transaction.createdAt || transaction.created_at)}</Text>
                          </View>
                        </View>
                        <Text style={[styles.transactionAmount, { color: getTransactionAmountColor(transaction.direction) }]}>
                          {formatTransactionAmount(transaction.amount, transaction.direction)}
                        </Text>
                      </View>
                    );
                  })
                )}

              </CleanCard>
            </Animatable.View>
          </ScrollView>

          {renderTopUpModal()}
          {renderWithdrawModal()}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppBackground>
  );

  function renderTopUpModal() {
    return (
      <Modal
        visible={showTopUpModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <Animatable.View animation="fadeInUp" duration={300} style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Nạp tiền ví</Text>
            <Text style={styles.modalSubtitle}>Nhập số tiền muốn nạp</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ví dụ: 100000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={topUpAmount}
              onChangeText={setTopUpAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTopUpModal(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <ModernButton title="Tiếp tục" size="small" onPress={handleCustomTopUp} />
            </View>
            </Animatable.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  function renderWithdrawModal() {
    return (
      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <Animatable.View animation="fadeInUp" duration={300} style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Rút tiền</Text>
            <Text style={styles.modalSubtitle}>Nhập thông tin chuyển khoản</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
              <TextInput
                style={styles.modalInput}
                placeholder="Số tiền muốn rút"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={withdrawData.amount}
                onChangeText={(value) => handleWithdrawInputChange('amount', value)}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Tên ngân hàng"
                placeholderTextColor={colors.textMuted}
                value={withdrawData.bankName}
                onChangeText={(value) => handleWithdrawInputChange('bankName', value)}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Số tài khoản"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={withdrawData.bankAccountNumber}
                onChangeText={(value) => handleWithdrawInputChange('bankAccountNumber', value)}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Tên chủ tài khoản"
                placeholderTextColor={colors.textMuted}
                value={withdrawData.accountHolderName}
                onChangeText={(value) => handleWithdrawInputChange('accountHolderName', value)}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowWithdrawModal(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <ModernButton title="Xác nhận" size="small" onPress={handleWithdraw} />
            </View>
            </Animatable.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }
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
  quickCardContent: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  quickAmountsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAmountItem: {
    minWidth: 110,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  quickAmountText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
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
  transactionDescription: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
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
  transactionAmount: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
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
    shadowColor: 'rgba(15,23,42,0.2)',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
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
});

export default WalletScreen;
