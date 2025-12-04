import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

class PaymentService {
  constructor() {
    this.apiService = apiService;
  }

  // Initiate wallet top-up (New API)
  async initiateTopUp(amount, paymentMethod = 'PAYOS', returnUrl = null, cancelUrl = null) {
    try {
      // For mobile app, we use deep links based on the Expo scheme in app.json
      // app.json → expo.scheme = "mssus-iat-rs-app"
      const APP_SCHEME = 'mssus-iat-rs-app';

      const mobileReturnUrl =
        returnUrl || `${APP_SCHEME}://wallet/topup/success`;
      const mobileCancelUrl =
        cancelUrl || `${APP_SCHEME}://wallet/topup/cancel`;

      // Simple client-side idempotency key (backend will also validate)
      const idempotencyKey = `topup-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      const requestBody = {
        amount: amount,
        paymentMethod: paymentMethod,
        returnUrl: mobileReturnUrl,
        cancelUrl: mobileCancelUrl,
        idempotencyKey,
      };

      const response = await this.apiService.post(
        ENDPOINTS.WALLET.TOPUP_INIT,
        requestBody
      );

      return {
        success: true,
        data: response, // TopUpInitResponse from backend
        // Backend fields: transactionRef, paymentUrl, qrCodeUrl, deepLink, status, expirySeconds
        paymentUrl: response.paymentUrl || response.checkoutUrl,
        qrCode: response.qrCodeUrl || response.qrCode,
        orderCode: response.transactionRef || response.orderCode,
        status: response.status || 'PENDING',
        expirySeconds: response.expirySeconds ?? null,
        message: response.message || 'Đã tạo link thanh toán thành công'
      };
    } catch (error) {
      console.error('Error initiating top-up:', error);
      throw error;
    }
  }

  // Initiate payout/withdrawal (Driver only)
  // Updated to match backend PayoutInitRequest: amount, bankName, bankBin, accountNumber, accountHolder, mode
  async initiatePayout(amount, bankName, bankBin, accountNumber, accountHolder, mode = 'AUTOMATIC') {
    try {
      const requestBody = {
        amount: amount,
        bankName: bankName,
        bankBin: bankBin,
        bankAccountNumber: accountNumber,
        accountHolderName: accountHolder,
        mode: mode // AUTOMATIC or MANUAL (optional, default AUTOMATIC)
      };

      const response = await this.apiService.post(
        ENDPOINTS.WALLET.PAYOUT_INIT,
        requestBody
      );

      return {
        success: true,
        data: response,
        payoutRef: response.payoutRef,
        idempotencyKey: response.idempotencyKey,
        status: response.status,
        message: response.message || 'Đã tạo yêu cầu rút tiền thành công'
      };
    } catch (error) {
      console.error('Error initiating payout:', error);
      throw error;
    }
  }

  // Get wallet balance (Updated API - no userId needed, uses authentication)
  async getWalletInfo() {
    try {
      const response = await this.apiService.get(ENDPOINTS.WALLET.BALANCE)
      return response;
    } catch (error) {
      console.error('Get wallet info error:', error);
      throw error;
    }
  }

  // Get transaction history (Updated API - uses new transaction controller endpoint)
  async getTransactionHistory(page = 0, size = 20, type = null, status = null) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });

      if (type) params.append('type', type);
      if (status) params.append('status', status);

      // Use new transaction history endpoint from TransactionController
      const response = await this.apiService.get(
        `${ENDPOINTS.TRANSACTION.USER_HISTORY}?${params.toString()}`
      );

      return response;
    } catch (error) {
      console.error('Get transaction history error:', error);
      throw error;
    }
  }

  // Get driver earnings (Driver only)
  async getDriverEarnings() {
    try {
      const response = await this.apiService.get(ENDPOINTS.WALLET.EARNINGS);
      return response;
    } catch (error) {
      console.error('Get driver earnings error:', error);
      throw error;
    }
  }

  // Format currency for display
  formatCurrency(amount) {
    if (typeof amount !== 'number') {
      amount = parseFloat(amount) || 0;
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Validate payment amount
  validateAmount(amount) {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Số tiền phải lớn hơn 0');
    }
    
    if (numAmount < 10000) {
      throw new Error('Số tiền nạp tối thiểu là 10,000 VNĐ');
    }
    
    if (numAmount > 50000000) {
      throw new Error('Số tiền nạp tối đa là 50,000,000 VNĐ');
    }
    
    return numAmount;
  }

  // Get payment status text
  getPaymentStatusText(status) {
    switch (status) {
      case 'PENDING':
        return 'Đang chờ thanh toán';
      case 'PAID':
      case 'COMPLETED':
        return 'Thành công';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'EXPIRED':
        return 'Đã hết hạn';
      case 'FAILED':
        return 'Thất bại';
      default:
        return 'Không xác định';
    }
  }

  // Get payment status color
  getPaymentStatusColor(status) {
    switch (status) {
      case 'PENDING':
        return '#FF9800';
      case 'PAID':
      case 'COMPLETED':
        return '#4CAF50';
      case 'CANCELLED':
      case 'EXPIRED':
      case 'FAILED':
        return '#F44336';
      default:
        return '#666';
    }
  }

  // Format transaction type (matching backend TransactionType enum)
  getTransactionTypeText(type) {
    switch (type) {
      // User deposits funds via PSP
      case 'TOP_UP':
      case 'TOPUP':
        return 'Nạp tiền';
      
      // Financial hold for quoted fare
      case 'HOLD_CREATE':
        return 'Tạm giữ tiền';
      
      // Release of financial hold
      case 'HOLD_RELEASE':
        return 'Giải phóng tiền';
      
      // Final payment deduction upon ride completion
      case 'CAPTURE_FARE':
        return 'Thanh toán chuyến đi';
      
      // Withdrawal to external bank/PSP
      case 'WITHDRAW':
      case 'PAYOUT':
        return 'Rút tiền';
      
      // Promotional credit
      case 'PROMO_CREDIT':
        return 'Khuyến mãi';
      
      // Corrections, compensation, reversals
      case 'ADJUSTMENT':
        return 'Điều chỉnh';
      
      // Refund
      case 'REFUND':
        return 'Hoàn tiền';
      
      // Legacy/fallback types
      case 'RIDE_PAYMENT':
        return 'Thanh toán chuyến đi';
      case 'RIDE_EARNING':
        return 'Thu nhập chuyến đi';
      case 'COMMISSION':
        return 'Hoa hồng';
      
      default:
        return type || 'Giao dịch';
    }
  }

  // Get transaction icon (matching backend TransactionType enum)
  getTransactionIcon(type, direction) {
    switch (type) {
      // User deposits funds via PSP
      case 'TOP_UP':
      case 'TOPUP':
        return 'add-circle';
      
      // Financial hold for quoted fare
      case 'HOLD_CREATE':
        return 'lock';
      
      // Release of financial hold
      case 'HOLD_RELEASE':
        return 'lock-open';
      
      // Final payment deduction upon ride completion
      case 'CAPTURE_FARE':
        return direction === 'OUTBOUND' ? 'payment' : 'monetization-on';
      
      // Withdrawal to external bank/PSP
      case 'WITHDRAW':
      case 'PAYOUT':
        return 'remove-circle';
      
      // Promotional credit
      case 'PROMO_CREDIT':
        return 'card-giftcard';
      
      // Corrections, compensation, reversals
      case 'ADJUSTMENT':
        return 'tune';
      
      // Refund
      case 'REFUND':
        return 'undo';
      
      // Legacy/fallback types
      case 'RIDE_PAYMENT':
        return direction === 'OUTBOUND' ? 'payment' : 'monetization-on';
      case 'RIDE_EARNING':
        return 'trending-up';
      case 'COMMISSION':
        return 'percent';
      
      default:
        return 'account-balance-wallet';
    }
  }

  // Get bank BIN code from bank name (common Vietnamese banks)
  getBankBin(bankName) {
    if (!bankName) return null;
    
    const bankNameUpper = bankName.toUpperCase().trim();
    const bankBinMap = {
      // Major Vietnamese banks
      'VIETCOMBANK': '970436',
      'VCB': '970436',
      'VIETINBANK': '970415',
      'VTB': '970415',
      'BIDV': '970418',
      'AGRIBANK': '970405',
      'ACB': '970416',
      'TECHCOMBANK': '970407',
      'TPBANK': '970423',
      'VPBANK': '970432',
      'MBBANK': '970422',
      'MB': '970422',
      'SACOMBANK': '970403',
      'SCB': '970403',
      'HDBANK': '970437',
      'HD': '970437',
      'SHB': '970443',
      'SEABANK': '970409',
      'OCB': '970448',
      'VIB': '970441',
      'EXIMBANK': '970431',
      'MSB': '970426',
      'VIETBANK': '970427',
      'NAB': '970428',
      'BAB': '970429',
      'PGBANK': '970430',
      'PUBLICBANK': '970439',
      'PVCOMBANK': '970412',
      'BAOVIETBANK': '970438',
      'VIETABANK': '970427',
      'NAMABANK': '970428',
      'ABANK': '970429',
      'PG': '970430',
      'PUBLIC': '970439',
      'PVCOM': '970412',
      'BAOVIET': '970438',
    };

    // Try exact match first
    if (bankBinMap[bankNameUpper]) {
      return bankBinMap[bankNameUpper];
    }

    // Try partial match
    for (const [key, bin] of Object.entries(bankBinMap)) {
      if (bankNameUpper.includes(key) || key.includes(bankNameUpper)) {
        return bin;
      }
    }

    return null;
  }
}

// Create and export singleton instance
const paymentService = new PaymentService();
export default paymentService;
