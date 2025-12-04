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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Animatable from 'react-native-animatable';

import ModernButton from '../../components/ModernButton.jsx';
import paymentService from '../../services/paymentService';
import authService from '../../services/authService';
import { ApiError } from '../../services/api';

const { width } = Dimensions.get('window');

const QRPaymentScreen = ({ navigation, route }) => {
  const { amount: initialAmount = 50000, type = 'topup' } = route.params || {};
  
  const [user, setUser] = useState(null);
  const [amount, setAmount] = useState(initialAmount.toString());
  const [customAmount, setCustomAmount] = useState('');
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('input'); // input, pending, processing, success, failed

  const presetAmounts = [50000, 100000, 200000, 500000, 1000000];

  useEffect(() => {
    loadUserProfile();
  }, []);

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

    const finalAmount = isCustomAmount ? customAmount : amount;
    const validAmount = validateAndSetAmount(finalAmount);
    
    if (!validAmount) return;

    setLoading(true);
    setPaymentStatus('pending');

    try {
      // Use new API - no userId needed, uses authentication
      const result = await paymentService.initiateTopUp(validAmount);

      if (result.success) {
        // Merge backend response với các field tiện dụng cho UI
        setPaymentData({
          ...result.data,
          qrCode: result.qrCode,
          paymentUrl: result.paymentUrl,
          orderCode: result.orderCode,
          amount: validAmount,
        });
        
        // Mở PayOS checkout URL
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

  const renderAmountInput = () => {
    if (paymentStatus !== 'input') return null;

    return (
      <View style={styles.amountSection}>
        <Text style={styles.sectionTitle}>Chọn số tiền nạp</Text>
        
        {/* Preset Amounts */}
        <View style={styles.presetAmounts}>
          {presetAmounts.map((presetAmount) => (
            <TouchableOpacity
              key={presetAmount}
              style={[
                styles.presetAmountButton,
                !isCustomAmount && parseInt(amount) === presetAmount && styles.selectedAmount
              ]}
              onPress={() => {
                setAmount(presetAmount.toString());
                setIsCustomAmount(false);
              }}
            >
              <Text style={[
                styles.presetAmountText,
                !isCustomAmount && parseInt(amount) === presetAmount && styles.selectedAmountText
              ]}>
                {paymentService.formatCurrency(presetAmount)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom Amount Toggle */}
        <TouchableOpacity
          style={styles.customAmountToggle}
          onPress={() => setIsCustomAmount(!isCustomAmount)}
        >
          <Icon 
            name={isCustomAmount ? 'radio-button-checked' : 'radio-button-unchecked'} 
            size={20} 
            color="#4CAF50" 
          />
          <Text style={styles.customAmountToggleText}>Nhập số tiền khác</Text>
        </TouchableOpacity>

        {/* Custom Amount Input */}
        {isCustomAmount && (
          <Animatable.View animation="slideInDown" style={styles.customAmountContainer}>
            <View style={styles.inputContainer}>
              <Icon name="monetization-on" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.amountInput}
                placeholder="Nhập số tiền (VNĐ)"
                value={customAmount}
                onChangeText={setCustomAmount}
                keyboardType="numeric"
              />
            </View>
            <Text style={styles.helperText}>
              Tối thiểu: 10,000 VNĐ - Tối đa: 50,000,000 VNĐ
            </Text>
          </Animatable.View>
        )}

        {/* Total Amount Display */}
        <View style={styles.totalAmountCard}>
          <View style={styles.totalAmountCardInner}>
            <LinearGradient
              colors={['#34D399', '#059669']}
              style={styles.totalAmountGradient}
            >
              <Text style={styles.totalAmountLabel}>Số tiền nạp</Text>
              <Text style={styles.totalAmountValue}>
                {paymentService.formatCurrency(isCustomAmount ? (customAmount || 0) : amount)}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  };

  const renderPaymentContent = () => {
    switch (paymentStatus) {
      case 'pending':
        return (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Thanh toán PayOS</Text>
            
            {paymentData?.qrCode && (
              <View style={styles.qrContainer}>
                <View style={styles.qrContainerInner}>
                  <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center' }}>
                    <Image
                      source={{ uri: paymentData.qrCode }}
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrDescription}>
                      Quét mã QR bằng ứng dụng ngân hàng để thanh toán
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.paymentInfoCard}>
              <View style={styles.paymentInfoCardInner}>
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 }}>
              <Text style={styles.paymentInfoTitle}>Thông tin thanh toán</Text>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Mã đơn hàng:</Text>
                <Text style={styles.paymentInfoValue}>#{paymentData?.orderCode}</Text>
              </View>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Số tiền:</Text>
                <Text style={styles.paymentInfoValue}>
                  {paymentService.formatCurrency(paymentData?.amount || 0)}
                </Text>
              </View>
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Trạng thái:</Text>
                <Text style={[
                  styles.paymentInfoValue,
                  { color: paymentService.getPaymentStatusColor(paymentData?.status) }
                ]}>
                  {paymentService.getPaymentStatusText(paymentData?.status)}
                </Text>
              </View>
                </View>
              </View>
            </View>
          </View>
        );

      case 'processing':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.statusContainerInner}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, alignItems: 'center' }}>
                <Animatable.View animation="pulse" iterationCount="infinite">
                  <ActivityIndicator size={64} color="#FF9800" />
                  <Text style={styles.statusText}>Đang xử lý thanh toán...</Text>
                  <Text style={styles.statusSubtext}>Vui lòng không đóng ứng dụng</Text>
                </Animatable.View>
              </View>
            </View>
          </View>
        );

      case 'success':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.statusContainerInner}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, alignItems: 'center' }}>
                <Animatable.View animation="bounceIn">
                  <Icon name="check-circle" size={64} color="#4CAF50" />
                  <Text style={[styles.statusText, { color: '#4CAF50' }]}>Thanh toán thành công!</Text>
                  <Text style={styles.statusSubtext}>
                    Số dư ví của bạn đã được cập nhật
                  </Text>
                </Animatable.View>
              </View>
            </View>
          </View>
        );

      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <View style={styles.statusContainerInner}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 40, alignItems: 'center' }}>
                <Animatable.View animation="shake">
                  <Icon name="error" size={64} color="#F44336" />
                  <Text style={[styles.statusText, { color: '#F44336' }]}>Thanh toán thất bại</Text>
                  <Text style={styles.statusSubtext}>
                    Vui lòng thử lại hoặc liên hệ hỗ trợ
                  </Text>
                </Animatable.View>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderActionButtons = () => {
    switch (paymentStatus) {
      case 'input':
        return (
          <View style={styles.buttonContainer}>
            <ModernButton
              title={loading ? "Đang tạo..." : "Tạo thanh toán"}
              onPress={createPaymentLink}
              disabled={loading || (!isCustomAmount && !amount) || (isCustomAmount && !customAmount)}
              icon={loading ? null : "payment"}
              size="large"
            />
            <ModernButton
              title="Hủy"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
            />
          </View>
        );

      case 'pending':
        return (
          <View style={styles.buttonContainer}>
            <ModernButton
              title="Mô phỏng thanh toán"
              onPress={simulatePaymentSuccess}
              icon="play-arrow"
              variant="outline"
              size="large"
            />
            <ModernButton
              title="Hủy thanh toán"
              variant="outline"
              onPress={resetPayment}
              style={styles.cancelButton}
            />
          </View>
        );

      case 'failed':
        return (
          <View style={styles.buttonContainer}>
            <ModernButton
              title="Thử lại"
              onPress={resetPayment}
              icon="refresh"
              size="large"
            />
          </View>
        );

      case 'success':
        return (
          <View style={styles.buttonContainer}>
            <ModernButton
              title="Hoàn thành"
              onPress={() => navigation.goBack()}
              icon="check"
              size="large"
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#10412F', '#000000']}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nạp tiền ví</Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {renderAmountInput()}
        {renderPaymentContent()}
        
        {/* Payment Instructions */}
        {paymentStatus === 'pending' && (
          <View style={styles.instructionsCard}>
            <View style={styles.instructionsCardInner}>
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20 }}>
                <Text style={styles.instructionsTitle}>Hướng dẫn thanh toán:</Text>
                <View style={styles.instruction}>
                  <Icon name="looks-one" size={20} color="#4CAF50" />
                  <Text style={styles.instructionText}>Mở ứng dụng ngân hàng hoặc ví điện tử</Text>
                </View>
                <View style={styles.instruction}>
                  <Icon name="looks-two" size={20} color="#4CAF50" />
                  <Text style={styles.instructionText}>Quét mã QR PayOS phía trên</Text>
                </View>
                <View style={styles.instruction}>
                  <Icon name="looks-3" size={20} color="#4CAF50" />
                  <Text style={styles.instructionText}>Xác nhận thông tin và thanh toán</Text>
                </View>
                <View style={styles.instruction}>
                  <Icon name="looks-4" size={20} color="#4CAF50" />
                  <Text style={styles.instructionText}>Chờ hệ thống cập nhật số dư</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {renderActionButtons()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  amountSection: {
    marginBottom: 24,
  },
  presetAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  presetAmountButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedAmount: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  presetAmountText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  selectedAmountText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  customAmountToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customAmountToggleText: {
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 8,
  },
  customAmountContainer: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputIcon: {
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#1a1a1a',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  totalAmountCard: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  totalAmountCardInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    overflow: 'hidden',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  totalAmountGradient: {
    padding: 24,
    alignItems: 'center',
  },
  totalAmountLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalAmountValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  paymentSection: {
    marginBottom: 24,
  },
  qrContainer: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 20,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  qrContainerInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  qrCodeImage: {
    width: width * 0.6,
    height: width * 0.6,
    marginBottom: 16,
  },
  qrDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  paymentInfoCard: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 20,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  paymentInfoCardInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    padding: 20,
    overflow: 'hidden',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  paymentInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentInfoValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  statusContainer: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 24,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  statusContainerInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    padding: 40,
    alignItems: 'center',
    overflow: 'hidden',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    textAlign: 'center',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  instructionsCard: {
    backgroundColor: '#EBEBF0',
    borderRadius: 16,
    marginBottom: 24,
    // Shadow soft (neumorphism style - giống CleanCard)
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  instructionsCardInner: {
    borderRadius: 16,
    backgroundColor: '#EBEBF0',
    padding: 20,
    overflow: 'hidden',
    // Shadow depth (neumorphism style - giống CleanCard)
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 20,
  },
  cancelButton: {
    marginTop: 8,
  },
});

export default QRPaymentScreen;