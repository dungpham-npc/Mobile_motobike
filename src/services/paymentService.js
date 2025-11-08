import apiService, { ApiError } from './api';
import { ENDPOINTS, API_CONFIG } from '../config/api';

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

  // Initiate payout/withdrawal (All users)
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

  // Cancel payout (if backend supports)
  async cancelPayout(payoutRef) {
    try {
      const endpoint = ENDPOINTS.WALLET.PAYOUT_CANCEL.replace('{payoutRef}', payoutRef);
      const response = await this.apiService.post(endpoint);

      return {
        success: true,
        data: response,
        message: response.message || 'Đã hủy yêu cầu rút tiền thành công'
      };
    } catch (error) {
      console.error('Error cancelling payout:', error);
      // If endpoint doesn't exist (404), return a user-friendly message
      if (error.status === 404) {
        throw new Error('Tính năng hủy yêu cầu rút tiền chưa được hỗ trợ. Vui lòng liên hệ hỗ trợ.');
      }
      throw error;
    }
  }

  // Simulate PayOS webhook for testing
  async simulateWebhook(orderCode, amount, description = 'Test wallet top-up') {
    try {
      const payload = {
        data: {
          orderCode: orderCode.toString(),
          amount: amount,
          description: description,
          accountNumber: '12345678',
          reference: `REF${orderCode}`,
          transactionDateTime: new Date().toISOString(),
          status: 'PAID',
          currency: 'VND'
        },
        desc: 'success',
        success: true,
        signature: 'test_signature'
      };

      // Backend expects String payload (raw JSON string) and returns String response
      // Use fetch directly to handle raw string response
      const baseURL = this.apiService.baseURL || API_CONFIG.CURRENT.BASE_URL;
      const url = `${baseURL}${ENDPOINTS.PAYOS.WEBHOOK}`;
      const headers = this.apiService.getAuthHeaders ? this.apiService.getAuthHeaders() : {
        'Content-Type': 'application/json',
        'Accept': 'text/plain'
      };

      console.log('Simulating webhook:', { orderCode, amount, url });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      // Backend returns plain string "Succeeded" or "Failed", not JSON
      const responseText = await response.text();

      if (!response.ok) {
        throw new ApiError(
          responseText || 'Webhook simulation failed',
          response.status,
          { responseText }
        );
      }

      // Check if response is "Succeeded"
      if (responseText === 'Succeeded' || responseText.includes('Succeeded')) {
        return {
          success: true,
          data: { response: responseText },
          message: 'Đã mô phỏng thanh toán thành công'
        };
      } else {
        throw new Error(`Webhook simulation failed: ${responseText}`);
      }
    } catch (error) {
      console.error('Error simulating webhook:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error.message || 'Không thể mô phỏng webhook',
        0,
        error
      );
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

  // Get transaction history from TransactionController (Updated API - uses authentication)
  async getTransactionHistory(page = 0, size = 20, type = null, status = null, sortBy = 'createdAt', sortDir = 'desc') {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sort: sortBy,
        direction: sortDir
      });

      if (type) params.append('type', type);
      if (status) params.append('status', status);

      // Use TransactionController endpoint
      const response = await this.apiService.get(
        `${ENDPOINTS.TRANSACTIONS.USER_HISTORY}?${params.toString()}`
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
    
    if (numAmount > 10000000) {
      throw new Error('Số tiền nạp tối đa là 10,000,000 VNĐ');
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
      case 'TOPUP':
        return 'Nạp tiền';
      case 'WITHDRAW':
      case 'PAYOUT':
        return 'Rút tiền';
      case 'RIDE_PAYMENT':
      case 'CAPTURE_FARE':
        return 'Thanh toán chuyến đi';
      case 'RIDE_EARNING':
        return 'Thu nhập chuyến đi';
      case 'COMMISSION':
        return 'Hoa hồng';
      case 'REFUND':
        return 'Hoàn tiền';
      case 'HOLD_CREATE':
        return 'Giữ tiền';
      case 'HOLD_RELEASE':
        return 'Giải phóng tiền';
      case 'PROMO_CREDIT':
        return 'Khuyến mãi';
      case 'ADJUSTMENT':
        return 'Điều chỉnh';
      default:
        return type;
    }
  }

  // Get transaction icon
  getTransactionIcon(type, direction) {
    switch (type) {
      case 'TOP_UP':
      case 'TOPUP':
        return 'add-circle';
      case 'WITHDRAW':
      case 'PAYOUT':
        return 'remove-circle';
      case 'RIDE_PAYMENT':
      case 'CAPTURE_FARE':
        // OUT means money going out (payment), IN means money coming in (earning)
        return direction === 'OUT' || direction === 'OUTBOUND' ? 'payment' : 'monetization-on';
      case 'RIDE_EARNING':
        return 'trending-up';
      case 'COMMISSION':
        return 'percent';
      case 'REFUND':
        return 'undo';
      case 'HOLD_CREATE':
      case 'HOLD_RELEASE':
        return 'lock';
      case 'PROMO_CREDIT':
        return 'card-giftcard';
      case 'ADJUSTMENT':
        return 'tune';
      default:
        return 'account-balance-wallet';
    }
  }
}

// Create and export singleton instance
const paymentService = new PaymentService();
export default paymentService;
