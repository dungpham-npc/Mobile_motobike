import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

class PaymentService {
  constructor() {
    this.apiService = apiService;
  }

  // Initiate wallet top-up (New API)
  async initiateTopUp(amount, paymentMethod = 'PAYOS', returnUrl = null, cancelUrl = null) {
    try {
      // For mobile app, we can use deep links or custom schemes
      const mobileReturnUrl = returnUrl || 'mssus://payment/success';
      const mobileCancelUrl = cancelUrl || 'mssus://payment/cancel';

      const requestBody = {
        amount: amount,
        paymentMethod: paymentMethod,
        returnUrl: mobileReturnUrl,
        cancelUrl: mobileCancelUrl
      };

      const response = await this.apiService.post(
        ENDPOINTS.WALLET.TOPUP_INIT,
        requestBody
      );

      console.log('response', response);

      return {
        success: true,
        data: response,
        paymentUrl: response.checkoutUrl || response.paymentUrl,
        qrCode: response.qrCode,
        orderCode: response.orderCode,
        amount: response.amount,
        status: response.status,
        message: response.message || 'Đã tạo link thanh toán thành công'
      };
    } catch (error) {
      console.error('Error initiating top-up:', error);
      throw error;
    }
  }

  // Initiate payout/withdrawal (Driver only)
  async initiatePayout(amount, bankName, bankAccountNumber, accountHolderName) {
    try {
      const requestBody = {
        amount: amount,
        bankName: bankName,
        bankAccountNumber: bankAccountNumber,
        accountHolderName: accountHolderName
      };

      const response = await this.apiService.post(
        ENDPOINTS.WALLET.PAYOUT_INIT,
        requestBody
      );

      return {
        success: true,
        data: response,
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
      const response = await this.apiService.get(ENDPOINTS.WALLET.BALANCE);
      console.log('response', response);
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

      console.log('Transaction history response:', response);
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

  // Format transaction type
  getTransactionTypeText(type) {
    switch (type) {
      case 'TOP_UP':
        return 'Nạp tiền';
      case 'WITHDRAW':
        return 'Rút tiền';
      case 'RIDE_PAYMENT':
        return 'Thanh toán chuyến đi';
      case 'RIDE_EARNING':
        return 'Thu nhập chuyến đi';
      case 'COMMISSION':
        return 'Hoa hồng';
      case 'REFUND':
        return 'Hoàn tiền';
      default:
        return type;
    }
  }

  // Get transaction icon
  getTransactionIcon(type, direction) {
    switch (type) {
      case 'TOP_UP':
        return 'add-circle';
      case 'WITHDRAW':
        return 'remove-circle';
      case 'RIDE_PAYMENT':
        return direction === 'OUTBOUND' ? 'payment' : 'monetization-on';
      case 'RIDE_EARNING':
        return 'trending-up';
      case 'COMMISSION':
        return 'percent';
      case 'REFUND':
        return 'undo';
      default:
        return 'account-balance-wallet';
    }
  }
}

// Create and export singleton instance
const paymentService = new PaymentService();
export default paymentService;
