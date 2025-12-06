import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import GlassHeader, { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import paymentService from '../../services/paymentService';
import bankService from '../../services/bankService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const WithdrawScreen = ({ navigation, route }) => {
  const { walletData } = route.params || {};
  
  const [withdrawData, setWithdrawData] = useState({
    amount: '',
    bankName: '',
    bankBin: '',
    bankAccountNumber: '',
    accountHolderName: '',
    mode: 'AUTOMATIC',
  });
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amountError, setAmountError] = useState('');

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      setLoadingBanks(true);
      const supportedBanks = await bankService.getSupportedBanks();
      setBanks(supportedBanks || []);
    } catch (error) {
      console.error('Error loading banks:', error);
      setBanks([]);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleWithdrawInputChange = (field, value) => {
    setWithdrawData((prev) => {
      const updated = { ...prev, [field]: value };
      return updated;
    });

    // Validate amount real-time
    if (field === 'amount') {
      validateAmount(value);
    }
  };

  const validateAmount = (amountValue) => {
    if (!amountValue || amountValue.trim() === '') {
      setAmountError('');
      return;
    }

    const amount = parseInt(amountValue, 10);
    const availableBalance = walletData?.availableBalance ?? walletData?.available_balance ?? 0;

    if (isNaN(amount) || amount <= 0) {
      setAmountError('Số tiền phải lớn hơn 0');
      return;
    }

    if (amount < 50000) {
      setAmountError('Số tiền rút tối thiểu là 50.000 VNĐ');
      return;
    }

    if (amount > availableBalance) {
      setAmountError(`Số dư không đủ. Số dư khả dụng: ${paymentService.formatCurrency(availableBalance)}`);
      return;
    }

    setAmountError('');
  };

  const isFormValid = () => {
    const { amount, bankName, bankBin, bankAccountNumber, accountHolderName } = withdrawData;
    const amountNum = parseInt(amount, 10);
    const availableBalance = walletData?.availableBalance ?? walletData?.available_balance ?? 0;

    return (
      amount &&
      amountNum > 0 &&
      amountNum >= 50000 &&
      amountNum <= availableBalance &&
      bankName &&
      bankBin &&
      bankAccountNumber &&
      accountHolderName &&
      /^\d{6}$/.test(bankBin) &&
      /^\d{9,16}$/.test(bankAccountNumber) &&
      accountHolderName.length >= 2 &&
      !amountError
    );
  };

  const handleBankSelect = (bank) => {
    setWithdrawData((prev) => ({
      ...prev,
      bankName: bank.name || bank.shortName || bank.short_name || '',
      bankBin: bank.bin || '',
    }));
    setShowBankPicker(false);
  };

  const handleWithdraw = async () => {
    const { amount, bankName, bankBin, bankAccountNumber, accountHolderName, mode } = withdrawData;

    if (!amount || !bankName || !bankBin || !bankAccountNumber || !accountHolderName) {
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

    const availableBalance = walletData?.availableBalance ?? walletData?.available_balance ?? 0;
    if (withdrawAmount > availableBalance) {
      Alert.alert('Lỗi', 'Số dư không đủ để thực hiện giao dịch');
      return;
    }

    if (!/^\d{6}$/.test(bankBin)) {
      Alert.alert('Lỗi', 'Mã BIN ngân hàng phải là 6 chữ số');
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
      console.log('Initiating payout with data:', {
        amount: withdrawAmount,
        bankName,
        bankBin,
        accountNumber: bankAccountNumber,
        accountHolder: accountHolderName,
        mode,
      });

      const result = await paymentService.initiatePayout(
        withdrawAmount,
        bankName,
        bankBin,
        bankAccountNumber,
        accountHolderName,
        mode
      );

      console.log('Payout result:', result);

      if (result.success) {
        Alert.alert(
          'Thành công',
          result.message || 'Đã gửi yêu cầu rút tiền. Giao dịch sẽ được xử lý trong 1-3 ngày làm việc.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Withdraw error:', error);
      let errorMessage = 'Không thể thực hiện giao dịch rút tiền';
      if (error instanceof ApiError) {
        console.error('API Error details:', {
          status: error.status,
          message: error.message,
          data: error.data,
        });
        switch (error.status) {
          case 400:
            errorMessage = error.message || 'Thông tin không hợp lệ';
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

  return (
    <AppBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader
            title="Rút tiền"
            subtitle="Nhập thông tin chuyển khoản"
            onBackPress={() => navigation.goBack()}
          />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animatable.View animation="fadeInUp" duration={300}>
              {/* Available Balance Display */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceCardInner}>
                  <View style={styles.balanceInfo}>
                    <Icon name="account-balance-wallet" size={24} color={colors.primary} />
                    <View style={styles.balanceTextContainer}>
                      <Text style={styles.balanceLabel}>Số dư có thể rút</Text>
                      <Text style={styles.balanceAmount}>
                        {paymentService.formatCurrency(
                          walletData?.availableBalance ?? 
                          walletData?.available_balance ?? 
                          0
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Số tiền muốn rút *</Text>
                <TextInput
                  style={[
                    styles.input,
                    amountError && styles.inputError
                  ]}
                  placeholder="Nhập số tiền"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={withdrawData.amount}
                  onChangeText={(value) => handleWithdrawInputChange('amount', value)}
                />
                {amountError ? (
                  <Text style={styles.errorText}>{amountError}</Text>
                ) : withdrawData.amount && parseInt(withdrawData.amount, 10) > 0 ? (
                  <Text style={styles.helperText}>
                    Số tiền: {paymentService.formatCurrency(parseInt(withdrawData.amount, 10))}
                  </Text>
                ) : null}
              </View>

              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.bankSelector}
                  onPress={() => setShowBankPicker(true)}
                >
                  <Text
                    style={[
                      styles.bankSelectorText,
                      !withdrawData.bankName && styles.bankSelectorPlaceholder,
                    ]}
                  >
                    {withdrawData.bankName || 'Chọn ngân hàng'}
                  </Text>
                  <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Số tài khoản"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={withdrawData.bankAccountNumber}
                onChangeText={(value) => handleWithdrawInputChange('bankAccountNumber', value)}
              />

              <TextInput
                style={[styles.input, {
                  marginTop: 16,
                }]}
                placeholder="Tên chủ tài khoản"
                placeholderTextColor={colors.textMuted}
                value={withdrawData.accountHolderName}
                onChangeText={(value) => handleWithdrawInputChange('accountHolderName', value)}
              />

              <View style={styles.modeSelector}>
                <Text style={styles.modeLabel}>Phương thức xử lý</Text>
                <View style={styles.modeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      withdrawData.mode === 'AUTOMATIC' && styles.modeButtonActive,
                    ]}
                    onPress={() => handleWithdrawInputChange('mode', 'AUTOMATIC')}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        withdrawData.mode === 'AUTOMATIC' && styles.modeButtonTextActive,
                      ]}
                    >
                      Tự động
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      withdrawData.mode === 'MANUAL' && styles.modeButtonActive,
                    ]}
                    onPress={() => handleWithdrawInputChange('mode', 'MANUAL')}
                  >
                    <Text
                      style={[
                        styles.modeButtonText,
                        withdrawData.mode === 'MANUAL' && styles.modeButtonTextActive,
                      ]}
                    >
                      Thủ công
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ModernButton
                title={loading ? 'Đang xử lý...' : 'Xác nhận'}
                onPress={handleWithdraw}
                disabled={loading || !isFormValid()}
                style={styles.submitButton}
              />
            </Animatable.View>
          </ScrollView>

          {/* Bank Picker Modal */}
          <Modal
            visible={showBankPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowBankPicker(false)}
          >
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Chọn ngân hàng</Text>
                  <TouchableOpacity onPress={() => setShowBankPicker(false)}>
                    <Icon name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {loadingBanks ? (
                  <View style={styles.pickerLoading}>
                    <ActivityIndicator size="large" color={colors.accent} />
                  </View>
                ) : banks.length === 0 ? (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>Không có ngân hàng nào</Text>
                  </View>
                ) : (
                  <FlatList
                    data={banks}
                    keyExtractor={(item, index) => item.bin || item.id || index.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.bankItem}
                        onPress={() => handleBankSelect(item)}
                      >
                        <Text style={styles.bankItemName}>
                          {item.name || item.shortName || item.short_name || 'Ngân hàng'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  balanceCard: {
    marginBottom: 20,
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  balanceCardInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    fontSize: 15,
  },
  inputError: {
    borderColor: '#EF4444',
    borderWidth: 1.5,
  },
  inputGroup: {
    marginBottom: 16,
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
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#22C55E',
    marginTop: 8,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#EF4444',
    marginTop: 8,
    marginLeft: 4,
  },
  modeSelector: {
    marginTop: 8,
    marginBottom: 24,
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
  submitButton: {
    marginTop: 8,
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
});

export default WithdrawScreen;

