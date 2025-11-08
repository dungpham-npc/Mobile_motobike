import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import GlassHeader from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import paymentService from '../../services/paymentService';
import authService from '../../services/authService';
import bankAccountService from '../../services/bankAccountService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const WalletScreen = ({ navigation }) => {
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
  const [savedBankAccounts, setSavedBankAccounts] = useState([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(null);
  const [saveBankAccount, setSaveBankAccount] = useState(false);

  const quickTopUpAmounts = [50000, 100000, 200000, 500000, 1000000];

  useEffect(() => {
    loadWalletData();
  }, []);

  // Refresh wallet data when screen comes into focus (e.g., after payment callback)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadWalletData();
    });

    return unsubscribe;
  }, [navigation]);

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
      // Load all transactions (no filter) - we'll filter client-side
      const response = await paymentService.getTransactionHistory(0, 20);
      // TransactionController returns PageResponse with 'data' field
      if (response && response.data) {
        setTransactions(response.data);
      } else if (response && response.content) {
        // Fallback for legacy endpoint format
        setTransactions(response.content);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
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
        // Save bank account if checkbox is checked and not already saved
        if (saveBankAccount && !selectedBankAccountId) {
          try {
            await bankAccountService.saveBankAccount({
              bankName,
              bankAccountNumber,
              accountHolderName,
            });
            await loadSavedBankAccounts();
          } catch (error) {
            console.error('Error saving bank account:', error);
          }
        }

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
              setSelectedBankAccountId(null);
              setSaveBankAccount(false);
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
    // Clear selected bank account if user manually edits
    if (selectedBankAccountId) {
      setSelectedBankAccountId(null);
    }
  };

  // Load saved bank accounts when withdraw modal opens
  const loadSavedBankAccounts = async () => {
    try {
      const accounts = await bankAccountService.getBankAccounts();
      setSavedBankAccounts(accounts);
    } catch (error) {
      console.error('Error loading saved bank accounts:', error);
    }
  };

  // Handle bank account selection
  const handleBankAccountSelect = (accountId) => {
    const account = savedBankAccounts.find((acc) => acc.id === accountId);
    if (account) {
      setSelectedBankAccountId(accountId);
      setWithdrawData({
        ...withdrawData,
        bankName: account.bankName,
        bankAccountNumber: account.bankAccountNumber, // Use full number for submission
        accountHolderName: account.accountHolderName,
      });
    }
  };

  // Handle delete saved bank account
  const handleDeleteBankAccount = async (accountId) => {
    Alert.alert(
      'Xác nhận',
      'Bạn có chắc muốn xóa tài khoản ngân hàng này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            const deleted = await bankAccountService.deleteBankAccount(accountId);
            if (deleted) {
              await loadSavedBankAccounts();
              if (selectedBankAccountId === accountId) {
                setSelectedBankAccountId(null);
                setWithdrawData({
                  ...withdrawData,
                  bankName: '',
                  bankAccountNumber: '',
                  accountHolderName: '',
                });
              }
            }
          },
        },
      ]
    );
  };

  // Get payout status color
  const getPayoutStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return '#F59E0B'; // Amber
      case 'PROCESSING':
        return '#3B82F6'; // Blue
      case 'SUCCESS':
      case 'COMPLETED':
        return '#22C55E'; // Green
      case 'FAILED':
        return '#EF4444'; // Red
      case 'CANCELLED':
        return '#6B7280'; // Gray
      default:
        return colors.textMuted;
    }
  };

  // Get payout status text
  const getPayoutStatusText = (status) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'Đang chờ';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'SUCCESS':
      case 'COMPLETED':
        return 'Thành công';
      case 'FAILED':
        return 'Thất bại';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status || 'Không xác định';
    }
  };


  // Filter payout transactions (all statuses)
  const payoutTransactions = transactions.filter((txn) => txn.type === 'PAYOUT');
  
  // Filter TOPUP transactions (only SUCCESS status)
  const topupTransactions = transactions.filter((txn) => 
    txn.type === 'TOPUP' && txn.status === 'SUCCESS'
  );

  const getTransactionIcon = (type, direction) => {
    const icon = paymentService.getTransactionIcon(type, direction);
    let color = colors.textSecondary;

    // Backend uses: IN (money coming in), OUT (money going out), INTERNAL (internal transfers)
    const isOutgoing = direction === 'OUT' || direction === 'OUTBOUND';
    const isIncoming = direction === 'IN' || direction === 'INBOUND' || direction === 'INTERNAL';

    switch (type) {
      case 'TOP_UP':
      case 'TOPUP':
        color = '#22C55E'; // Green for top-up (always incoming)
        break;
      case 'WITHDRAW':
      case 'PAYOUT':
        color = '#F97316'; // Orange for withdrawal (always outgoing)
        break;
      case 'RIDE_PAYMENT':
      case 'CAPTURE_FARE':
        // OUT means payment (red), IN means earning (green)
        color = isOutgoing ? '#EF4444' : '#22C55E';
        break;
      case 'RIDE_EARNING':
        color = '#3B82F6'; // Blue for earnings
        break;
      case 'COMMISSION':
        color = '#8B5CF6'; // Purple for commission
        break;
      case 'REFUND':
        color = '#0EA5E9'; // Cyan for refund
        break;
      case 'HOLD_CREATE':
      case 'HOLD_RELEASE':
        color = '#F59E0B'; // Amber for holds
        break;
      case 'PROMO_CREDIT':
        color = '#EC4899'; // Pink for promo credits
        break;
      case 'ADJUSTMENT':
        color = '#6B7280'; // Gray for adjustments
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

  const formatTransactionAmount = (amount, direction) => {
    // Backend uses: IN (money coming in), OUT (money going out), INTERNAL (internal transfers)
    // IN and INTERNAL should show as positive (green), OUT should show as negative (red)
    const isIncoming = direction === 'IN' || direction === 'INTERNAL' || direction === 'INBOUND';
    const sign = isIncoming ? '+' : '-';
    return `${sign}${paymentService.formatCurrency(Math.abs(amount))}`;
  };

  const getTransactionAmountColor = (direction) => {
    // IN and INTERNAL are positive (green), OUT is negative (red)
    const isIncoming = direction === 'IN' || direction === 'INTERNAL' || direction === 'INBOUND';
    return isIncoming ? '#22C55E' : '#EF4444';
  };

  if (loading) {
    return (
      <AppBackground>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Đang tải thông tin ví...</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.scrollContent}
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

          {(walletData?.totalToppedUp > 0 || walletData?.totalSpent > 0) && (
            <Animatable.View animation="fadeInUp" duration={500} delay={140}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.statsCardContent}>
                <Text style={styles.sectionTitle}>Thống kê</Text>
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Icon name="trending-up" size={22} color="#22C55E" />
                    <Text style={styles.statValue}>
                      {paymentService.formatCurrency(walletData?.total_topped_up || 0)}
                    </Text>
                    <Text style={styles.statLabel}>Tổng nạp</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Icon name="trending-down" size={22} color="#EF4444" />
                    <Text style={styles.statValue}>
                      {paymentService.formatCurrency(walletData?.totalSpent || walletData?.total_spent || 0)}
                    </Text>
                    <Text style={styles.statLabel}>Tổng chi</Text>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>
          )}

          {/* Payout History Section */}
          {payoutTransactions.length > 0 && (
            <Animatable.View animation="fadeInUp" duration={500} delay={150}>
              <CleanCard style={styles.cardSpacing} contentStyle={styles.transactionCardContent}>
                <View style={styles.transactionHeader}>
                  <Text style={styles.sectionTitle}>Lịch sử rút tiền</Text>
                  {loadingTransactions && <ActivityIndicator size="small" color={colors.accent} />}
                </View>

                {payoutTransactions.slice(0, 5).map((transaction) => {
                  const statusColor = getPayoutStatusColor(transaction.status);

                  return (
                    <View key={transaction.txnId || transaction.id} style={styles.payoutItem}>
                      <View style={styles.payoutLeft}>
                        <View style={[styles.payoutStatusIndicator, { backgroundColor: statusColor + '20' }]}>
                          <View style={[styles.payoutStatusDot, { backgroundColor: statusColor }]} />
                        </View>
                        <View style={styles.payoutInfo}>
                          <Text style={styles.payoutDescription}>
                            {paymentService.getTransactionTypeText(transaction.type)}
                          </Text>
                          <Text style={styles.payoutNote}>
                            {transaction.note || 'Rút tiền về tài khoản ngân hàng'}
                          </Text>
                          <View style={styles.payoutMeta}>
                            <Text style={[styles.payoutStatus, { color: statusColor }]}>
                              {getPayoutStatusText(transaction.status)}
                            </Text>
                            <Text style={styles.payoutDate}>{formatDate(transaction.createdAt || transaction.created_at)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.payoutRight}>
                        <Text style={[styles.payoutAmount, { color: getTransactionAmountColor(transaction.direction) }]}>
                          {formatTransactionAmount(transaction.amount, transaction.direction)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </CleanCard>
            </Animatable.View>
          )}

          <Animatable.View animation="fadeInUp" duration={500} delay={200}>
            <CleanCard style={styles.cardSpacing} contentStyle={styles.transactionCardContent}>
              <View style={styles.transactionHeader}>
                <Text style={styles.sectionTitle}>Lịch sử giao dịch</Text>
                {loadingTransactions && <ActivityIndicator size="small" color={colors.accent} />}
              </View>

              {topupTransactions.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Icon name="receipt" size={44} color={colors.textMuted} />
                  <Text style={styles.emptyTransactionsText}>Chưa có giao dịch nạp tiền</Text>
                </View>
              ) : (
                topupTransactions.slice(0, 5).map((transaction) => {
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
    </AppBackground>
  );

  function renderTopUpModal() {
    return (
      <Modal visible={showTopUpModal} transparent animationType="slide" onRequestClose={() => setShowTopUpModal(false)}>
        <View style={styles.modalOverlay}>
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
        onRequestClose={() => {
          setShowWithdrawModal(false);
          setSelectedBankAccountId(null);
          setSaveBankAccount(false);
        }}
        onShow={loadSavedBankAccounts}
      >
        <View style={styles.modalOverlay}>
          <Animatable.View animation="fadeInUp" duration={300} style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Rút tiền</Text>
            <Text style={styles.modalSubtitle}>Nhập thông tin chuyển khoản</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {/* Saved Bank Accounts Selection */}
              {savedBankAccounts.length > 0 && (
                <View style={styles.savedAccountsContainer}>
                  <Text style={styles.savedAccountsTitle}>Tài khoản đã lưu</Text>
                  {savedBankAccounts.map((account) => (
                    <TouchableOpacity
                      key={account.id}
                      style={[
                        styles.savedAccountItem,
                        selectedBankAccountId === account.id && styles.savedAccountItemSelected,
                      ]}
                      onPress={() => handleBankAccountSelect(account.id)}
                    >
                      <View style={styles.savedAccountInfo}>
                        <Text style={styles.savedAccountName}>{account.bankName}</Text>
                        <Text style={styles.savedAccountNumber}>{account.maskedAccountNumber}</Text>
                        <Text style={styles.savedAccountHolder}>{account.accountHolderName}</Text>
                      </View>
                      <View style={styles.savedAccountActions}>
                        {selectedBankAccountId === account.id && (
                          <Icon name="check-circle" size={24} color="#22C55E" />
                        )}
                        <TouchableOpacity
                          onPress={() => handleDeleteBankAccount(account.id)}
                          style={styles.deleteAccountButton}
                        >
                          <Icon name="delete-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.addNewAccountButton}
                    onPress={() => {
                      setSelectedBankAccountId(null);
                      setWithdrawData({
                        ...withdrawData,
                        bankName: '',
                        bankAccountNumber: '',
                        accountHolderName: '',
                      });
                    }}
                  >
                    <Icon name="add-circle-outline" size={20} color={colors.accent} />
                    <Text style={styles.addNewAccountText}>Thêm tài khoản mới</Text>
                  </TouchableOpacity>
                </View>
              )}

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
                editable={!selectedBankAccountId}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Số tài khoản"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={selectedBankAccountId ? bankAccountService.maskAccountNumber(withdrawData.bankAccountNumber) : withdrawData.bankAccountNumber}
                onChangeText={(value) => handleWithdrawInputChange('bankAccountNumber', value)}
                editable={!selectedBankAccountId}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Tên chủ tài khoản"
                placeholderTextColor={colors.textMuted}
                value={withdrawData.accountHolderName}
                onChangeText={(value) => handleWithdrawInputChange('accountHolderName', value)}
                editable={!selectedBankAccountId}
              />

              {/* Save Bank Account Checkbox */}
              {!selectedBankAccountId && (
                <TouchableOpacity
                  style={styles.checkboxContainer}
                  onPress={() => setSaveBankAccount(!saveBankAccount)}
                >
                  <Icon
                    name={saveBankAccount ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={saveBankAccount ? colors.accent : colors.textMuted}
                  />
                  <Text style={styles.checkboxLabel}>Lưu tài khoản ngân hàng này</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => {
                  setShowWithdrawModal(false);
                  setSelectedBankAccountId(null);
                  setSaveBankAccount(false);
                }}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <ModernButton title="Xác nhận" size="small" onPress={handleWithdraw} />
            </View>
          </Animatable.View>
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
    gap: 6,
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
  // Saved Bank Accounts Styles
  savedAccountsContainer: {
    marginBottom: 16,
  },
  savedAccountsTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  savedAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    marginBottom: 8,
  },
  savedAccountItemSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accent + '10',
  },
  savedAccountInfo: {
    flex: 1,
  },
  savedAccountName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  savedAccountNumber: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  savedAccountHolder: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  savedAccountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteAccountButton: {
    padding: 4,
  },
  addNewAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.accent + '10',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  addNewAccountText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.accent,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
  },
  // Payout History Styles
  payoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  payoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  payoutStatusIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutDescription: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  payoutNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  payoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payoutStatus: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  payoutDate: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: colors.textMuted,
  },
  payoutRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  payoutAmount: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  cancelPayoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#EF4444' + '15',
    gap: 4,
  },
  cancelPayoutText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#EF4444',
  },
});

export default WalletScreen;
