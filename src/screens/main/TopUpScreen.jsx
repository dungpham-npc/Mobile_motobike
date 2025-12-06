import React, { useState } from 'react';
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
  Image,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import GlassHeader, { SoftBackHeader } from '../../components/ui/GlassHeader.jsx';
import AppBackground from '../../components/layout/AppBackground.jsx';
import CleanCard from '../../components/ui/CleanCard.jsx';
import paymentService from '../../services/paymentService';
import { ApiError } from '../../services/api';
import { colors } from '../../theme/designTokens';

const TopUpScreen = ({ navigation, route }) => {
  const [topUpAmount, setTopUpAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('input'); // input, pending, success, failed
  const quickTopUpAmounts = [50000, 100000, 200000, 500000, 1000000];

  const createPaymentLink = async (amount) => {
    try {
      const validAmount = paymentService.validateAmount(amount);
      setLoading(true);
      setPaymentStatus('pending');
      setSelectedAmount(validAmount);

      const result = await paymentService.initiateTopUp(validAmount);

      if (result.success) {
        setPaymentData({
          ...result.data,
          qrCode: result.qrCode,
          paymentUrl: result.paymentUrl,
          orderCode: result.orderCode,
          amount: validAmount,
        });

        // Tự động mở PayOS checkout URL
        const supported = await Linking.canOpenURL(result.paymentUrl);
        if (supported) {
          await Linking.openURL(result.paymentUrl);
        }
      }
    } catch (error) {
      console.error('Create payment link error:', error);
      setPaymentStatus('failed');
      let errorMessage = 'Không thể tạo link thanh toán';
      if (error instanceof ApiError) {
        errorMessage = error.message || errorMessage;
      }
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickTopUp = (amount) => {
    createPaymentLink(amount);
  };

  const handleCustomTopUp = () => {
    const amount = parseInt(topUpAmount, 10);

    if (!amount || amount <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ');
      return;
    }

    createPaymentLink(amount);
  };

  const resetPayment = () => {
    setPaymentStatus('input');
    setPaymentData(null);
    setSelectedAmount(null);
    setTopUpAmount('');
    setLoading(false);
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={styles.safe}>
          <SoftBackHeader 
            title="Nạp tiền ví" 
            subtitle="Chọn số tiền muốn nạp"
            onBackPress={() => navigation.goBack()}
          />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {paymentStatus === 'input' ? (
              <Animatable.View animation="fadeInUp" duration={300}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Nạp nhanh</Text>
                  <View style={styles.quickAmountsList}>
                    {quickTopUpAmounts.map((amount) => (
                      <TouchableOpacity
                        key={amount}
                        style={[
                          styles.quickAmountItem,
                          loading && styles.quickAmountItemDisabled
                        ]}
                        onPress={() => handleQuickTopUp(amount)}
                        disabled={loading}
                      >
                        {loading && selectedAmount === amount ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Text style={styles.quickAmountText}>
                            {paymentService.formatCurrency(amount)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Nhập số tiền tùy chọn</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: 100000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    value={topUpAmount}
                    onChangeText={setTopUpAmount}
                    editable={!loading}
                  />
                  <ModernButton
                    title={loading ? "Đang tạo..." : "Tiếp tục"}
                    onPress={handleCustomTopUp}
                    style={styles.continueButton}
                    disabled={loading || !topUpAmount}
                  />
                </View>
              </Animatable.View>
            ) : paymentStatus === 'pending' && paymentData ? (
              <Animatable.View animation="fadeInUp" duration={300}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Thanh toán PayOS</Text>
                  
                  {paymentData.qrCode && (
                    <CleanCard style={styles.qrCard} contentStyle={styles.qrCardContent}>
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
                  )}

                  <CleanCard style={styles.infoCard} contentStyle={styles.infoCardContent}>
                    <Text style={styles.infoTitle}>Thông tin thanh toán</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Mã đơn hàng:</Text>
                      <Text style={styles.infoValue}>#{paymentData.orderCode}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Số tiền:</Text>
                      <Text style={styles.infoValue}>
                        {paymentService.formatCurrency(paymentData.amount || 0)}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Trạng thái:</Text>
                      <Text style={[
                        styles.infoValue,
                        { color: paymentService.getPaymentStatusColor(paymentData.status) }
                      ]}>
                        {paymentService.getPaymentStatusText(paymentData.status)}
                      </Text>
                    </View>
                  </CleanCard>

                  <View style={styles.buttonContainer}>
                    <ModernButton
                      title="Mở PayOS"
                      onPress={() => {
                        if (paymentData.paymentUrl) {
                          Linking.openURL(paymentData.paymentUrl);
                        }
                      }}
                      icon="open-in-new"
                      style={styles.actionButton}
                    />
                    <ModernButton
                      title="Hủy"
                      variant="outline"
                      onPress={resetPayment}
                      style={styles.cancelButton}
                    />
                  </View>
                </View>
              </Animatable.View>
            ) : paymentStatus === 'failed' ? (
              <Animatable.View animation="fadeInUp" duration={300}>
                <View style={styles.errorContainer}>
                  <Icon name="error" size={64} color="#F44336" />
                  <Text style={styles.errorText}>Tạo thanh toán thất bại</Text>
                  <Text style={styles.errorSubtext}>
                    Vui lòng thử lại hoặc liên hệ hỗ trợ
                  </Text>
                  <ModernButton
                    title="Thử lại"
                    onPress={resetPayment}
                    icon="refresh"
                    style={styles.retryButton}
                  />
                </View>
              </Animatable.View>
            ) : null}
          </ScrollView>
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
  section: {
    marginBottom: 32,
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  quickAmountText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    fontFamily: 'Inter_500Medium',
    color: colors.textPrimary,
    fontSize: 15,
  },
  continueButton: {
    marginTop: 8,
  },
  quickAmountItemDisabled: {
    opacity: 0.5,
  },
  qrCard: {
    marginBottom: 20,
  },
  qrCardContent: {
    padding: 24,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrCodeImage: {
    width: 250,
    height: 250,
    marginBottom: 16,
  },
  qrDescription: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    marginBottom: 20,
  },
  infoCardContent: {
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.18)',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    marginBottom: 8,
  },
  cancelButton: {
    marginTop: 0,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#F44336',
    marginTop: 8,
  },
  errorSubtext: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
  },
});

export default TopUpScreen;

