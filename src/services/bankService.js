import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

class BankService {
  constructor() {
    this.apiService = apiService;
    this.banksCache = null;
    this.lastFetchTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  // Get all banks
  async getAllBanks() {
    try {
      // Check cache first
      if (this.banksCache && this.lastFetchTime && 
          (Date.now() - this.lastFetchTime) < this.CACHE_DURATION) {
        return this.banksCache;
      }

      const response = await this.apiService.get(ENDPOINTS.BANKS.ALL);
      
      // Cache the result
      this.banksCache = response;
      this.lastFetchTime = Date.now();
      
      return response;
    } catch (error) {
      console.error('Error fetching banks:', error);
      throw error;
    }
  }

  // Get supported banks (transferSupported = 1)
  async getSupportedBanks() {
    try {
      const response = await this.apiService.get(ENDPOINTS.BANKS.SUPPORTED);
      return response;
    } catch (error) {
      console.error('Error fetching supported banks:', error);
      throw error;
    }
  }

  // Get bank by BIN
  async getBankByBin(bin) {
    try {
      const response = await this.apiService.get(
        ENDPOINTS.BANKS.BY_BIN.replace('{bin}', bin)
      );
      return response;
    } catch (error) {
      console.error('Error fetching bank by BIN:', error);
      throw error;
    }
  }

  // Validate bank BIN
  async validateBankBin(bin) {
    try {
      const response = await this.apiService.get(
        ENDPOINTS.BANKS.VALIDATE_BIN.replace('{bin}', bin)
      );
      return response;
    } catch (error) {
      console.error('Error validating bank BIN:', error);
      throw error;
    }
  }

  // Clear cache
  clearCache() {
    this.banksCache = null;
    this.lastFetchTime = null;
  }
}

// Create and export singleton instance
const bankService = new BankService();
export default bankService;

