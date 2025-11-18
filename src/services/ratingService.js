import apiService from './api';
import { ENDPOINTS } from '../config/api';

class RatingService {
  constructor() {
    this.apiService = apiService;
  }

  async submitRating(requestId, score, comment = null) {
    try {
      const body = {
        sharedRideRequestId: requestId,
        score: score,
      };

      if (comment) {
        body.comment = comment;
      }

      const response = await this.apiService.post(ENDPOINTS.RATINGS.SUBMIT, body);
      return response;
    } catch (error) {
      console.error('Submit rating error:', error);
      throw error;
    }
  }

  async getDriverRatings(page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      const endpoint = `${ENDPOINTS.RATINGS.DRIVER_HISTORY}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get driver ratings error:', error);
      throw error;
    }
  }

  async getRiderRatings(page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      const endpoint = `${ENDPOINTS.RATINGS.RIDER_HISTORY}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get rider ratings error:', error);
      throw error;
    }
  }

  async getRiderRatingsHistory(page = 0, size = 20) {
    return this.getRiderRatings(page, size);
  }

  async getDriverRatingsHistory(page = 0, size = 20) {
    return this.getDriverRatings(page, size);
  }
}

export default new RatingService();

