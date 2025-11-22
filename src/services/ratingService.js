import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

/**
 * RatingService - API calls for rating drivers
 */
class RatingService {
  constructor() {
    this.apiService = apiService;
  }

  /**
   * Submit a rating for a driver after completing a ride
   * @param {number} requestId - Shared ride request ID
   * @param {number} score - Rating score (1-5)
   * @param {string} comment - Optional comment
   * @returns {Promise<Object>} Response message
   */
  async submitRating(requestId, score, comment = '') {
    try {
      console.log(`📝 Submitting rating for request ${requestId}: ${score} stars`);
      
      const body = {
        sharedRideRequestId: requestId,
        score: score,
        comment: comment || null,
      };

      const response = await this.apiService.post(ENDPOINTS.RATINGS.SUBMIT, body);
      
      console.log('✅ Rating submitted successfully:', response);
      return response;
    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Failed to submit rating', error.status || 0, error);
    }
  }

  /**
   * Get ratings history for the authenticated rider
   * @param {number} page - Page number (default 0)
   * @param {number} size - Page size (default 20)
   * @returns {Promise<Object>} Paginated ratings
   */
  async getRiderRatingsHistory(page = 0, size = 20) {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('size', size.toString());
      
      const endpoint = `${ENDPOINTS.RATINGS.RIDER_HISTORY}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);

      console.log(`✅ Retrieved ${response.data?.length || 0} ratings`);
      return response;
    } catch (error) {
      console.error('❌ Error getting rider ratings history:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Failed to get ratings history', error.status || 0, error);
    }
  }

  /**
   * Get ratings history for the authenticated driver
   * @param {number} page - Page number (default 0)
   * @param {number} size - Page size (default 20)
   * @returns {Promise<Object>} Paginated ratings
   */
  async getDriverRatingsHistory(page = 0, size = 20) {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('size', size.toString());
      
      const endpoint = `${ENDPOINTS.RATINGS.DRIVER_HISTORY}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);

      console.log(`✅ Retrieved ${response.data?.length || 0} ratings`);
      return response;
    } catch (error) {
      console.error('❌ Error getting driver ratings history:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Failed to get ratings history', error.status || 0, error);
    }
  }
}

// Create and export singleton instance
const ratingService = new RatingService();
export default ratingService;

