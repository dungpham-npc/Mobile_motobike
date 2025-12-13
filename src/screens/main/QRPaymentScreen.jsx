import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import paymentService from '../../services/paymentService';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const { width } = Dimensions.get('window');

const QRPaymentScreen = ({ navigation, route }) => {
  const { amount: initialAmount = 50000, type = 'topup' } = route.params || {};
  
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState(initialAmount.toString());
  const [customAmount, setCustomAmount] = useState('');
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmountError, setCustomAmountError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('input'); // input, pending, processing, success, failed

  const presetAmounts = [50000, 100000, 200000, 500000, 1000000];

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Validate custom amount input
  const validateCustomAmountInput = (value) => {
    // Clear error if empty
    if (!value || value.trim() === '') {
      setCustomAmountError(null);
      return true;
    }

    // Check if it's a valid number format (only digits)
    const numberRegex = /^\d+$/;
    if (!numberRegex.test(value)) {
      setCustomAmountError('Vui lòng nhập ký tự số');
      return false;
    }

    // Check minimum amount
    const numAmount = parseInt(value, 10);
    if (numAmount < 10000) {
      setCustomAmountError('Mệnh giá phải trên 10.000 ₫');
      return false;
    }

    // Valid
    setCustomAmountError(null);
    return true;
  };

  // Tự động tạo payment link khi có amount từ route params
  useEffect(() => {
    const hasAmountFromRoute = route.params?.amount !== undefined && route.params?.amount !== null;
    
    if (hasAmountFromRoute && paymentStatus === 'input' && !paymentData) {
      const timer = setTimeout(() => {
        handleAutoCreatePayment(route.params.amount);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [route.params?.amount]);

  const handleAutoCreatePayment = async (amountValue) => {
    const validAmount = validateAndSetAmount(amountValue.toString());
    if (!validAmount) return;

    setAmount(validAmount.toString());
    setLoading(true);
    setPaymentStatus('pending');

    try {
      const result = await paymentService.initiateTopUp(validAmount);

      if (result.success) {
        setPaymentData({
          ...result.data,
          qrCode: result.qrCode,
          paymentUrl: result.paymentUrl,
          orderCode: result.orderCode,
          amount: validAmount,
        });
        
        const supported = await Linking.canOpenURL(result.paymentUrl);
        if (supported) {
          await Linking.openURL(result.paymentUrl);
        } else {
          Alert.alert('Lỗi', 'Không thể mở link thanh toán');
        }
      }
    } catch (error) {
      console.error('Auto create payment link error:', error);
      setPaymentStatus('failed');
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const validateAndSetAmount = (value) => {
    try {
      const validAmount = paymentService.validateAmount(value);
      return validAmount;
    } catch (error) {
      Alert.alert('Lỗi', error.message);
      return null;
    }
  };

  const createPaymentLink = async () => {
    // Validate custom amount if using custom input
    if (isCustomAmount) {
      if (!customAmount || customAmount.trim() === '') {
        setCustomAmountError('Vui lòng nhập số tiền');
        return;
      }
      const isValid = validateCustomAmountInput(customAmount);
      if (!isValid) {
        return;
      }
    }

    const finalAmount = isCustomAmount ? customAmount : amount;
    const validAmount = validateAndSetAmount(finalAmount);
    
    if (!validAmount) return;

    setLoading(true);
    setPaymentStatus('pending');

    try {
      const result = await paymentService.initiateTopUp(validAmount);

      if (result.success) {
        setPaymentData({
          ...result.data,
          qrCode: result.qrCode,
          paymentUrl: result.paymentUrl,
          orderCode: result.orderCode,
          amount: validAmount,
        });
        
        const supported = await Linking.canOpenURL(result.paymentUrl);
        if (supported) {
          await Linking.openURL(result.paymentUrl);
        } else {
          Alert.alert('Lỗi', 'Không thể mở link thanh toán');
        }
      }
    } catch (error) {
      console.error('Create payment link error:', error);
      setPaymentStatus('failed');
      
      let errorMessage = 'Không thể tạo link thanh toán';
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = 'Thông tin thanh toán không hợp lệ';
            break;
          case 404:
            errorMessage = 'Không tìm thấy ví người dùng';
            break;
          case 0:
            errorMessage = 'Không thể kết nối đến server thanh toán';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
      }
      
      Alert.alert('Lỗi thanh toán', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const simulatePaymentSuccess = () => {
    Alert.alert(
      'Mô phỏng thanh toán',
      'Bạn có muốn mô phỏng thanh toán thành công?',
      [
        { text: 'Hủy', style: 'cancel' },
        { 
          text: 'Thành công', 
          onPress: () => {
            setPaymentStatus('processing');
            setTimeout(() => {
              setPaymentStatus('success');
              Alert.alert(
                'Thanh toán thành công!',
                `Đã nạp ${paymentService.formatCurrency(isCustomAmount ? customAmount : amount)} vào ví của bạn`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            }, 2000);
          }
        }
      ]
    );
  };

  const resetPayment = () => {
    setPaymentStatus('input');
    setPaymentData(null);
    setLoading(false);
  };

  const getDisplayAmount = () => {
    if (isCustomAmount && customAmount) {
      return paymentService.formatCurrency(parseInt(customAmount) || 0);
    }
    return paymentService.formatCurrency(parseInt(amount) || 0);
  };

  const renderAmountInput = () => {
    const hasAmountFromRoute = route.params?.amount !== undefined && route.params?.amount !== null;
    if (paymentStatus !== 'input' || hasAmountFromRoute) return null;

    return (
      <>
        {/* Hero Amount Display Card */}
        <Animatable.View animation="fadeInUp" duration={400}>
          <CleanCard style={styles.heroCard} contentStyle={styles.heroCardContent}>
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <Icon name="account-balance-wallet" size={36} color={colors.primary} />
              </View>
              <Text style={styles.heroLabel}>Số tiền nạp</Text>
              <Text style={styles.heroAmount}>{getDisplayAmount()}</Text>
              {((isCustomAmount && customAmount) || (!isCustomAmount && amount)) && (
                <View style={styles.heroBadge}>
                  <Icon name="check-circle" size={14} color={colors.primary} />
                  <Text style={styles.heroBadgeText}>Sẵn sàng thanh toán</Text>
                </View>
              )}
            </View>
          </CleanCard>
        </Animatable.View>

        {/* Quick Amount Selection Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={80}>
          <CleanCard style={styles.sectionCard} contentStyle={styles.sectionCardContent}>
            <View style={styles.sectionHeader}>
              <Icon name="flash-on" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Chọn số tiền nạp</Text>
            </View>
            <View style={styles.quickAmountsGrid}>
              {presetAmounts.map((presetAmount, index) => {
                const isSelected = !isCustomAmount && parseInt(amount) === presetAmount;
                return (
                  <View key={presetAmount} style={styles.quickAmountCardWrapper}>
                    <Animatable.View
                      animation="fadeInUp"
                      duration={300}
                      delay={100 + index * 50}
                    >
                      <TouchableOpacity
                        style={[
                          styles.quickAmountCard,
                          isSelected && styles.quickAmountCardSelected,
                          loading && styles.quickAmountCardDisabled,
                        ]}
                      onPress={() => {
                        setAmount(presetAmount.toString());
                        setIsCustomAmount(false);
                        setCustomAmountError(null);
                      }}
                        disabled={loading}
                        activeOpacity={0.7}
                      >
                        {isSelected && (
                          <View style={styles.selectedIndicator}>
                            <Icon name="check-circle" size={16} color={colors.primary} />
                          </View>
                        )}
                        <Text
                          style={[
                            styles.quickAmountText,
                            isSelected && styles.quickAmountTextSelected,
                          ]}
                        >
                          {paymentService.formatCurrency(presetAmount)}
                        </Text>
                      </TouchableOpacity>
                    </Animatable.View>
                  </View>
                );
              })}
            </View>
          </CleanCard>
        </Animatable.View>

        {/* Custom Amount Card */}
        <Animatable.View animation="fadeInUp" duration={400} delay={160}>
          <CleanCard style={styles.sectionCard} contentStyle={styles.sectionCardContent}>
            <TouchableOpacity
              style={styles.customAmountHeader}
              onPress={() => {
                setIsCustomAmount(true);
                setAmount('');
                if (customAmount) {
                  validateCustomAmountInput(customAmount);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.customAmountHeaderLeft}>
                <View
                  style={[
                    styles.radioButton,
                    isCustomAmount && styles.radioButtonSelected,
                  ]}
                >
                  {isCustomAmount && <View style={styles.radioButtonInner} />}
                </View>
                <View style={styles.customAmountHeaderText}>
                  <Text style={styles.customAmountTitle}>Nhập số tiền khác</Text>
                  <Text style={styles.customAmountSubtitle}>
                    Tối thiểu 10.000 ₫
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {isCustomAmount && (
              <Animatable.View animation="fadeInDown" duration={250}>
                <View style={styles.inputWrapper}>
                  <View style={[
                    styles.inputCard,
                    isCustomAmount && !customAmountError && styles.inputCardFocused,
                    customAmountError && styles.inputCardError
                  ]}>
                    <Icon
                      name="edit"
                      size={20}
                      color={customAmountError ? '#EF4444' : colors.textSecondary}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập số tiền"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={customAmount}
                      onChangeText={(value) => {
                        // Only allow numeric input
                        const numericValue = value.replace(/[^0-9]/g, '');
                        setCustomAmount(numericValue);
                        validateCustomAmountInput(numericValue);
                      }}
                      editable={!loading}
                      autoFocus={isCustomAmount}
                    />
                    {customAmount && (
                      <Text style={[styles.inputSuffix, customAmountError && styles.inputSuffixError]}>₫</Text>
                    )}
                  </View>
                  {customAmountError && (
                    <Animatable.View animation="fadeInDown" duration={200}>
                      <View style={styles.errorMessageContainer}>
                        <Icon name="error-outline" size={16} color="#EF4444" />
                        <Text style={styles.errorMessage}>{customAmountError}</Text>
                      </View>
                    </Animatable.View>
                  )}
                </View>
              </Animatable.View>
            )}
          </CleanCard>
        </Animatable.View>
      </>
    );
  };

  const renderPaymentContent = () => {
    switch (paymentStatus) {
      case 'pending':
        return (
          <>
            {/* QR Code Card */}
            {paymentData?.qrCode && (
              <Animatable.View animation="fadeInUp" duration={400}>
                <CleanCard style={styles.sectionCard} contentStyle={styles.qrCardContent}>
                  <View style={styles.qrContainer}>
                    <Image
                      source={{ uri: paymentData.qrCode }}
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrDescription}>
                      Quét mã QR bằng ứng dụng ngân hàng để thanh toán
                    </Text>
                  </View>
                </CleanCard>
              </Animatable.View>
            )}

            {/* Payment Info Card */}
            <Animatable.View animation="fadeInUp" duration={400} delay={80}>
              <CleanCard style={styles.sectionCard} contentStyle={styles.sectionCardContent}>
                <Text style={styles.sectionTitle}>Thông tin thanh toán</Text>
                <View style={styles.infoSection}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Mã đơn hàng</Text>
                    <Text style={styles.infoValue}>#{paymentData?.orderCode}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số tiền</Text>
                    <Text style={styles.infoValue}>
                      {paymentService.formatCurrency(paymentData?.amount || 0)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trạng thái</Text>
                    <View style={styles.statusBadge}>
                      <Text style={[
                        styles.statusText,
                        { color: paymentService.getPaymentStatusColor(paymentData?.status) }
                      ]}>
                        {paymentService.getPaymentStatusText(paymentData?.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>

            {/* Instructions Card */}
            <Animatable.View animation="fadeInUp" duration={400} delay={160}>
              <CleanCard style={styles.sectionCard} contentStyle={styles.sectionCardContent}>
                <Text style={styles.sectionTitle}>Hướng dẫn thanh toán</Text>
                <View style={styles.instructionsList}>
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>1</Text>
                    </View>
                    <Text style={styles.instructionText}>Mở ứng dụng ngân hàng hoặc ví điện tử</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>2</Text>
                    </View>
                    <Text style={styles.instructionText}>Quét mã QR PayOS phía trên</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>3</Text>
                    </View>
                    <Text style={styles.instructionText}>Xác nhận thông tin và thanh toán</Text>
                  </View>
                  <View style={styles.instructionItem}>
                    <View style={styles.instructionNumber}>
                      <Text style={styles.instructionNumberText}>4</Text>
                    </View>
                    <Text style={styles.instructionText}>Chờ hệ thống cập nhật số dư</Text>
                  </View>
                </View>
              </CleanCard>
            </Animatable.View>
          </>
        );

      case 'processing':
        return (
          <Animatable.View animation="fadeInUp" duration={300}>
            <CleanCard style={styles.sectionCard} contentStyle={styles.statusCardContent}>
              <Animatable.View animation="pulse" iterationCount="infinite">
                <ActivityIndicator size={64} color="#FF9800" />
                <Text style={styles.statusText}>Đang xử lý thanh toán...</Text>
                <Text style={styles.statusSubtext}>Vui lòng không đóng ứng dụng</Text>
              </Animatable.View>
            </CleanCard>
          </Animatable.View>
        );

      case 'success':
        return (
          <Animatable.View animation="fadeInUp" duration={300}>
            <CleanCard style={styles.sectionCard} contentStyle={styles.statusCardContent}>
              <Animatable.View animation="bounceIn">
                <Icon name="check-circle" size={64} color={colors.primary} />
                <Text style={[styles.statusText, { color: colors.primary }]}>Thanh toán thành công!</Text>
                <Text style={styles.statusSubtext}>
                  Số dư ví của bạn đã được cập nhật
                </Text>
              </Animatable.View>
            </CleanCard>
          </Animatable.View>
        );

      case 'failed':
        return (
          <Animatable.View animation="fadeInUp" duration={300}>
            <CleanCard style={styles.sectionCard} contentStyle={styles.statusCardContent}>
              <Animatable.View animation="shake">
                <Icon name="error" size={64} color="#EF4444" />
                <Text style={[styles.statusText, { color: '#EF4444' }]}>Thanh toán thất bại</Text>
                <Text style={styles.statusSubtext}>
                  Vui lòng thử lại hoặc liên hệ hỗ trợ
                </Text>
              </Animatable.View>
            </CleanCard>
          </Animatable.View>
        );

      default:
        return null;
    }
  };

  const renderActionButtons = () => {
    switch (paymentStatus) {
      case 'input':
        return (
          <Animatable.View animation="fadeInUp" duration={400} delay={240}>
            <View style={styles.actionContainer}>
              <ModernButton
                title={loading ? "Đang tạo..." : "Tạo thanh toán"}
                onPress={createPaymentLink}
                disabled={!!(loading || (!isCustomAmount && !amount) || (isCustomAmount && (!customAmount || !!customAmountError)))}
                icon={loading ? null : "payment"}
                size="large"
                style={styles.primaryActionButton}
              />
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        );

      case 'pending':
        return (
          <Animatable.View animation="fadeInUp" duration={400} delay={240}>
            <View style={styles.actionContainer}>
              <ModernButton
                title="Mô phỏng thanh toán"
                onPress={simulatePaymentSuccess}
                icon="play-arrow"
                variant="outline"
                size="large"
                style={styles.primaryActionButton}
              />
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={resetPayment}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Hủy thanh toán</Text>
              </TouchableOpacity>
            </View>
          </Animatable.View>
        );

      case 'failed':
        return (
          <Animatable.View animation="fadeInUp" duration={400} delay={240}>
            <View style={styles.actionContainer}>
              <ModernButton
                title="Thử lại"
                onPress={resetPayment}
                icon="refresh"
                size="large"
                style={styles.primaryActionButton}
              />
            </View>
          </Animatable.View>
        );

      case 'success':
        return (
          <Animatable.View animation="fadeInUp" duration={400} delay={240}>
            <View style={styles.actionContainer}>
              <ModernButton
                title="Hoàn thành"
                onPress={() => navigation.goBack()}
                icon="check"
                size="large"
                style={styles.primaryActionButton}
              />
            </View>
          </Animatable.View>
        );

      default:
        return null;
    }
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" />
          {/* Floating Back Button */}
          <TouchableOpacity
            style={styles.floatingBackButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerSubtitle}>
                  {paymentStatus === 'input' ? 'Chọn số tiền muốn nạp' : 'Thanh toán PayOS'}
                </Text>
                <Text style={styles.headerTitle}>Nạp tiền ví</Text>
              </View>
            </View>
            {renderAmountInput()}
            {renderPaymentContent()}
            {renderActionButtons()}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  // Floating Back Button
  floatingBackButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Header Section
  headerSection: {
    marginBottom: 8,
    paddingVertical: 12,
    paddingTop: 8,
    alignItems: 'center',
  },
  headerTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
  },
  // Hero Card
  heroCard: {
    marginBottom: 0,
  },
  heroCardContent: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    width: '100%',
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16,65,47,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  heroAmount: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16,65,47,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  heroBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
  // Section Card
  sectionCard: {
    marginBottom: 0,
  },
  sectionCardContent: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  // Quick Amount Grid
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-between',
  },
  quickAmountCardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  quickAmountCardWrapperLast: {
    marginRight: 0,
  },
  quickAmountCard: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: 'rgba(0,0,0,0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  quickAmountCardSelected: {
    backgroundColor: 'rgba(16,65,47,0.06)',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  quickAmountCardDisabled: {
    opacity: 0.5,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  quickAmountText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  quickAmountTextSelected: {
    color: colors.primary,
  },
  // Custom Amount
  customAmountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customAmountHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    borderColor: 'rgba(148,163,184,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(16,65,47,0.08)',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  customAmountHeaderText: {
    flex: 1,
  },
  customAmountTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  customAmountSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  inputWrapper: {
    marginTop: 16,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  inputCardFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
  },
  inputCardError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  inputSuffix: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  inputSuffixError: {
    color: '#EF4444',
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorMessage: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: '#EF4444',
    flex: 1,
  },
  // QR Code
  qrCardContent: {
    padding: 24,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrCodeImage: {
    width: width * 0.6,
    height: width * 0.6,
    marginBottom: 16,
    borderRadius: 16,
  },
  qrDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Info Section
  infoSection: {
    marginTop: 8,
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.15)',
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(16,65,47,0.08)',
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  // Instructions
  instructionsList: {
    marginTop: 8,
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16,65,47,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
  },
  // Status Card
  statusCardContent: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  statusSubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  // Actions
  actionContainer: {
    gap: 12,
    marginTop: 8,
  },
  primaryActionButton: {
    marginBottom: 0,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textSecondary,
  },
});

export default QRPaymentScreen;
