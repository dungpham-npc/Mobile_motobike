import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'saved_bank_accounts';

class BankAccountService {
  /**
   * Mask bank account number (show only last 4 digits)
   * @param {string} accountNumber - Full account number
   * @returns {string} - Masked account number (e.g., "****7890")
   */
  maskAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) {
      return '****';
    }
    const last4 = accountNumber.slice(-4);
    return `****${last4}`;
  }

  /**
   * Save bank account information securely
   * @param {Object} bankAccount - Bank account object
   * @param {string} bankAccount.bankName - Bank name
   * @param {string} bankAccount.bankAccountNumber - Full account number
   * @param {string} bankAccount.accountHolderName - Account holder name
   * @returns {Promise<Object>} - Saved bank account with masked number
   */
  async saveBankAccount(bankAccount) {
    try {
      const { bankName, bankAccountNumber, accountHolderName } = bankAccount;

      if (!bankName || !bankAccountNumber || !accountHolderName) {
        throw new Error('Bank name, account number, and account holder name are required');
      }

      // Get existing bank accounts
      const existingAccounts = await this.getBankAccounts();

      // Check if account already exists (by account number)
      const existingIndex = existingAccounts.findIndex(
        (acc) => acc.bankAccountNumber === bankAccountNumber
      );

      const bankAccountData = {
        id: existingIndex >= 0 ? existingAccounts[existingIndex].id : Date.now().toString(),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(), // Store full number for payout, but mask in display
        accountHolderName: accountHolderName.trim(),
        maskedAccountNumber: this.maskAccountNumber(bankAccountNumber),
        createdAt: existingIndex >= 0 ? existingAccounts[existingIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // Update existing account
        existingAccounts[existingIndex] = bankAccountData;
      } else {
        // Add new account
        existingAccounts.push(bankAccountData);
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existingAccounts));

      console.log('✅ Bank account saved:', bankAccountData.maskedAccountNumber);
      return bankAccountData;
    } catch (error) {
      console.error('❌ Error saving bank account:', error);
      throw error;
    }
  }

  /**
   * Get all saved bank accounts
   * @returns {Promise<Array>} - Array of saved bank accounts with masked numbers
   */
  async getBankAccounts() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const accounts = JSON.parse(data);
      // Ensure all accounts have masked numbers
      return accounts.map((acc) => ({
        ...acc,
        maskedAccountNumber: acc.maskedAccountNumber || this.maskAccountNumber(acc.bankAccountNumber),
      }));
    } catch (error) {
      console.error('❌ Error getting bank accounts:', error);
      return [];
    }
  }

  /**
   * Get bank account by ID
   * @param {string} id - Bank account ID
   * @returns {Promise<Object|null>} - Bank account object or null
   */
  async getBankAccountById(id) {
    try {
      const accounts = await this.getBankAccounts();
      return accounts.find((acc) => acc.id === id) || null;
    } catch (error) {
      console.error('❌ Error getting bank account by ID:', error);
      return null;
    }
  }

  /**
   * Delete bank account by ID
   * @param {string} id - Bank account ID
   * @returns {Promise<boolean>} - True if deleted, false otherwise
   */
  async deleteBankAccount(id) {
    try {
      const accounts = await this.getBankAccounts();
      const filteredAccounts = accounts.filter((acc) => acc.id !== id);

      if (filteredAccounts.length === accounts.length) {
        // Account not found
        return false;
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filteredAccounts));
      console.log('✅ Bank account deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Error deleting bank account:', error);
      return false;
    }
  }

  /**
   * Clear all saved bank accounts
   * @returns {Promise<void>}
   */
  async clearAllBankAccounts() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('✅ All bank accounts cleared');
    } catch (error) {
      console.error('❌ Error clearing bank accounts:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const bankAccountService = new BankAccountService();
export default bankAccountService;

