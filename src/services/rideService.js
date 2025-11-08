import apiService, { ApiError } from './api';
import { ENDPOINTS } from '../config/api';

class RideService {
  constructor() {
    this.apiService = apiService;
  }

  // ========== QUOTE SERVICES ==========

  async normalizeQuoteFromBE(payload = {}) {
    const fare = payload.fare || {};
  
    const safeAmount = (obj) =>
      (obj && typeof obj.amount === 'number') ? obj.amount : null;
  
    return {
      // giữ lại thông tin gốc quan trọng
      quoteId: payload.quoteId ?? null,
      riderId: payload.riderId ?? null,
      pricingConfigId: payload.pricingConfigId ?? null,
      createdAt: payload.createdAt ?? null,
      expiresAt: payload.expiresAt ?? null,
  
      // quãng đường & thời gian
      distanceM: (typeof payload.distanceM === 'number') ? payload.distanceM : null,
      durationS: (typeof payload.durationS === 'number') ? payload.durationS : null,
  
      // toạ độ nếu cần dùng lại
      pickupLat: payload.pickupLat ?? null,
      pickupLng: payload.pickupLng ?? null,
      dropoffLat: payload.dropoffLat ?? null,
      dropoffLng: payload.dropoffLng ?? null,
  
      // giá cước — đưa về dạng số, KHÔNG còn .amount ở UI
      fare: {
        total:       safeAmount(fare.total),
        subtotal:    safeAmount(fare.subtotal),
        base2Km:     safeAmount(fare.base2KmVnd),
        after2KmPerKm: safeAmount(fare.after2KmPerKmVnd),
        discount:    safeAmount(fare.discount),
        commissionRate: typeof fare.commissionRate === 'number' ? fare.commissionRate : null,
        pricingVersion: fare.pricingVersion ?? null,
        distanceMetersEcho: typeof fare.distanceMeters === 'number' ? fare.distanceMeters : null
      },
  
      polyline: payload.polyline ?? null,
  
      // giữ toàn bộ gốc nếu UI cần soi thêm
      raw: payload
    };
  }
  
  async getQuote(pickup, dropoff, desiredPickupTime = null, notes = null) {
    try {
      const body = {};
  
      if (pickup?.locationId || pickup?.id) {
        body.pickupLocationId = pickup.locationId || pickup.id;
      } else if (pickup?.latitude && pickup?.longitude) {
        body.pickup = { latitude: pickup.latitude, longitude: pickup.longitude };
      } else {
        throw new Error('Invalid pickup location: must have either locationId or coordinates');
      }
  
      if (dropoff?.locationId || dropoff?.id) {
        body.dropoffLocationId = dropoff.locationId || dropoff.id;
      } else if (dropoff?.latitude && dropoff?.longitude) {
        body.dropoff = { latitude: dropoff.latitude, longitude: dropoff.longitude };
      } else {
        throw new Error('Invalid dropoff location: must have either locationId or coordinates');
      }
  
      if (desiredPickupTime) body.desiredPickupTime = desiredPickupTime;
      if (notes) body.notes = notes;
  
      console.log('Quote request body:', JSON.stringify(body, null, 2));
  
      const raw = await this.apiService.post(ENDPOINTS.QUOTES.GET_QUOTE, body);
      // Nếu apiService là axios wrapper, nó có thể trả { data: ... }
      const payload = (raw && typeof raw === 'object' && 'data' in raw) ? raw.data : raw;
  
      const normalized = await this.normalizeQuoteFromBE(payload);
  
      return normalized;
    } catch (error) {
      console.error('Get quote error:', error);
      throw error;
    }
  }

  // ========== RIDER SERVICES ==========

  async bookRide(quoteId, desiredPickupTime = null, notes = null) {
    try {
      const body = {
        quoteId: quoteId
      };

      // Add optional fields if provided
      if (desiredPickupTime) {
        body.desiredPickupTime = desiredPickupTime;
      }
      if (notes) {
        body.notes = notes;
      }

      const response = await this.apiService.post(ENDPOINTS.RIDE_REQUESTS.BOOK_RIDE, body);
      return response;
    } catch (error) {
      console.error('Book ride error:', error);
      throw error;
    }
  }

  async joinRide(rideId, quoteId, desiredPickupTime = null, notes = null) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.JOIN_RIDE.replace('{rideId}', rideId);
      const body = {
        quoteId: quoteId
      };

      // Add optional fields if provided
      if (desiredPickupTime) {
        body.desiredPickupTime = desiredPickupTime;
      }
      if (notes) {
        body.notes = notes;
      }

      const response = await this.apiService.post(endpoint, body);
      return response;
    } catch (error) {
      console.error('Join ride error:', error);
      throw error;
    }
  }

  async getAvailableRides(startTime = null, endTime = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      if (startTime) params.append('startTime', startTime);
      if (endTime) params.append('endTime', endTime);

      const response = await this.apiService.get(`${ENDPOINTS.RIDES.AVAILABLE}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Get available rides error:', error);
      throw error;
    }
  }

  async getRiderRequests(riderId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      if (status) params.append('status', status);

      const endpoint = `${ENDPOINTS.RIDE_REQUESTS.GET_BY_RIDER}/${riderId}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get rider requests error:', error);
      throw error;
    }
  }

  async cancelRequest(requestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.CANCEL.replace('{requestId}', requestId);
      const response = await this.apiService.delete(endpoint);
      return response;
    } catch (error) {
      console.error('Cancel request error:', error);
      throw error;
    }
  }

  // ========== DRIVER SERVICES ==========

  // Driver decision APIs
  // Create shared ride (Driver)
  async createSharedRide(rideData) {
    try {
      console.log('Creating shared ride:', rideData);
      const response = await this.apiService.post(ENDPOINTS.RIDES.CREATE, rideData);
      return response;
    } catch (error) {
      console.error('Create shared ride error:', error);
      throw error;
    }
  }

async acceptRideRequest(requestId, rideId, currentLocation = null) {
  try {
    console.log('📞 Accepting ride request:', { requestId, rideId });
    
    const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT.replace('{requestId}', requestId);
    const requestBody = { 
      rideId,
      // Backend requires currentDriverLocation (LatLng)
      currentDriverLocation: currentLocation?.latitude && currentLocation?.longitude
        ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude }
        : null
    };
    
    console.log('📤 Sending request to:', endpoint);
    console.log('📤 Request body:', requestBody);
    
    const response = await this.apiService.post(endpoint, requestBody);
    
    console.log('✅ Accept ride request success:', response);
    return response;
  } catch (error) {
    console.error('❌ Accept ride request error:', error);
    throw error;
  }
}

async acceptBroadcastRequest(requestId, vehicleId, currentLocation = null, startLocationId = null) {
  try {
    console.log('📞 Accepting broadcast request:', { requestId, vehicleId, currentLocation, startLocationId });
    
    const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT_BROADCAST.replace('{requestId}', requestId);
    
    // Build request body - at least one of startLocationId or startLatLng must be provided
    const requestBody = {};
    if (startLocationId) {
      requestBody.startLocationId = startLocationId;
    }
    
    if (currentLocation?.latitude && currentLocation?.longitude) {
      requestBody.startLatLng = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude
      };
    } else {
      // Fallback: send with null location if not available
      requestBody.startLatLng = null;
    }
    
    console.log('📤 Sending request to:', endpoint);
    console.log('📤 Request body:', requestBody);
    
    const response = await this.apiService.post(endpoint, requestBody);
    
    console.log('✅ Accept broadcast request success:', response);
    return response;
  } catch (error) {
    console.error('❌ Accept broadcast request error:', error);
    throw error;
  }
}


  async rejectRideRequest(requestId, reason = null) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.REJECT.replace('{requestId}', requestId);
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const response = await this.apiService.post(endpoint + params);
      return response;
    } catch (error) {
      console.error('Reject ride request error:', error);
      throw error;
    }
  }

  // Get ride by ID
  async getRideById(rideId) {
    try {
      const endpoint = ENDPOINTS.SHARED_RIDES.GET_BY_ID.replace('{rideId}', rideId);
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get ride by ID error:', error);
      throw error;
    }
  }

  // Complete ride - will auto-complete all ride requests first
  async completeRide(rideId) {
    try {
      // First, get all ride requests to check their status
      console.log(`📋 Getting ride requests for ride ${rideId}...`);
      const requestsResponse = await this.getRideRequests(rideId);
      console.log('📋 Ride requests response:', JSON.stringify(requestsResponse, null, 2));
      
      // Extract request list from response (handle pagination)
      const requestList = Array.isArray(requestsResponse) 
        ? requestsResponse 
        : (requestsResponse?.data || requestsResponse?.content || requestsResponse?.items || []);
      
      console.log(`📋 Found ${requestList.length} ride request(s)`);
      
      // Complete any ONGOING requests first
      const ongoingRequests = requestList.filter(req => req.status === 'ONGOING');
      console.log(`📋 Found ${ongoingRequests.length} ONGOING request(s) to complete`);
      
      for (const req of ongoingRequests) {
        // Try multiple possible field names for rideRequestId
        const rideRequestId = req.sharedRideRequestId || 
                            req.shared_ride_request_id || 
                            req.rideRequestId || 
                            req.ride_request_id ||
                            req.id;
        
        if (!rideRequestId) {
          console.warn(`⚠️ Skipping request without ID:`, req);
          continue;
        }
        
        console.log(`🔄 Completing ride request ${rideRequestId} (status: ${req.status})...`);
        try {
          await this.completeRideRequestOfRide(rideId, rideRequestId);
          console.log(`✅ Completed ride request ${rideRequestId}`);
        } catch (err) {
          console.warn(`⚠️ Failed to complete request ${rideRequestId}:`, err);
          throw err;
        }
      }
      
      // Now complete the ride
      console.log(`🔄 Completing ride ${rideId}...`);
      const endpoint = ENDPOINTS.RIDES.COMPLETE.replace('{rideId}', rideId);
      // Backend expects body: { "rideId": 123 }
      try {
        const response = await this.apiService.post(endpoint, { rideId });
        console.log(`✅ Successfully completed ride ${rideId}`, response);
        return response;
      } catch (completeError) {
        console.error('❌ Complete ride API error:', completeError);
        console.error('❌ Error details:', {
          message: completeError?.message,
          status: completeError?.status,
          response: completeError?.response,
          data: completeError?.data
        });
        throw completeError;
      }
    } catch (error) {
      console.error('❌ Complete ride error:', error);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Cancel ride
  async cancelRide(rideId, reason = null) {
    try {
      const endpoint = ENDPOINTS.SHARED_RIDES.CANCEL.replace('{rideId}', rideId);
      const body = reason ? { reason } : {};
      const response = await this.apiService.post(endpoint, body);
      return response;
    } catch (error) {
      console.error('Cancel ride error:', error);
      throw error;
    }
  }

  // Ride management APIs
  async startRide(rideId) {
    try {
      const endpoint = ENDPOINTS.RIDES.START.replace('{rideId}', rideId);
      const response = await this.apiService.post(endpoint, { rideId });
      return response;
    } catch (error) {
      console.error('Start ride error:', error);
      throw error;
    }
  }

  // Start a ride request (CONFIRMED -> ONGOING) - called when driver picks up passenger
  async startRideRequestOfRide(rideId, rideRequestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.START_REQUEST;
      const response = await this.apiService.post(endpoint, {
        rideId,
        rideRequestId
      });
      return response;
    } catch (error) {
      console.error('Start ride request error:', error);
      throw error;
    }
  }

  // Complete a ride request (ONGOING -> COMPLETED) - called when driver drops off passenger
  async completeRideRequestOfRide(rideId, rideRequestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.COMPLETE_REQUEST;
      const response = await this.apiService.post(endpoint, {
        rideId,
        rideRequestId
      });
      return response;
    } catch (error) {
      console.error('Complete ride request error:', error);
      throw error;
    }
  }


  // GPS tracking API
  async trackRide(rideId, locationPoints) {
    try {
      const endpoint = ENDPOINTS.RIDES.TRACK.replace('{rideId}', rideId);
      const response = await this.apiService.post(endpoint, locationPoints);
      return response;
    } catch (error) {
      console.error('Track ride error:', error);
      throw error;
    }
  }

  async createRide(vehicleId, startLocationId, endLocationId, startLatLng, endLatLng, scheduledDepartureTime) {
    try {
      const response = await this.apiService.post(ENDPOINTS.RIDES.CREATE, {
        vehicleId,
        startLocationId,
        endLocationId,
        startLatLng: {
          latitude: startLatLng.latitude,
          longitude: startLatLng.longitude
        },
        endLatLng: {
          latitude: endLatLng.latitude,
          longitude: endLatLng.longitude
        },
        scheduledDepartureTime
      });
      return response;
    } catch (error) {
      console.error('Create ride error:', error);
      throw error;
    }
  }

  async getDriverRides(driverId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      if (status) params.append('status', status);

      const endpoint = `${ENDPOINTS.RIDES.GET_BY_DRIVER}/${driverId}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get driver rides error:', error);
      throw error;
    }
  }


  async cancelRide(rideId, reason) {
    try {
      const endpoint = ENDPOINTS.RIDES.CANCEL.replace('{rideId}', rideId);
      const params = new URLSearchParams({
        reason: reason
      });
      
      const response = await this.apiService.delete(`${endpoint}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Cancel ride error:', error);
      throw error;
    }
  }

  async getRideRequests(rideId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString()
      });
      
      if (status) params.append('status', status);

      const endpoint = ENDPOINTS.RIDE_REQUESTS.GET_BY_RIDE.replace('{rideId}', rideId);
      const response = await this.apiService.get(`${endpoint}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Get ride requests error:', error);
      throw error;
    }
  }

  async acceptRequest(requestId, rideId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT.replace('{requestId}', requestId);
      const response = await this.apiService.post(endpoint, {
        rideId: rideId
      });
      return response;
    } catch (error) {
      console.error('Accept request error:', error);
      throw error;
    }
  }

  async rejectRequest(requestId, reason) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.REJECT.replace('{requestId}', requestId);
      const params = new URLSearchParams({
        reason: reason
      });
      
      const response = await this.apiService.post(`${endpoint}?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Reject request error:', error);
      throw error;
    }
  }

  // ========== SHARED SERVICES ==========

  async getRideDetails(rideId) {
    try {
      const endpoint = ENDPOINTS.RIDES.DETAILS.replace('{rideId}', rideId);
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get ride details error:', error);
      throw error;
    }
  }

  async getRequestDetails(requestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.DETAILS.replace('{requestId}', requestId);
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error('Get request details error:', error);
      throw error;
    }
  }

  // ========== UTILITY METHODS ==========

  formatRideStatus(status) {
    const statusMap = {
      'SCHEDULED': 'Đã lên lịch',
      'ONGOING': 'Đang diễn ra',
      'COMPLETED': 'Hoàn thành',
      'CANCELLED': 'Đã hủy'
    };
    return statusMap[status] || status;
  }

  formatRequestStatus(status) {
    const statusMap = {
      'PENDING': 'Chờ xác nhận',
      'CONFIRMED': 'Đã xác nhận',
      'ONGOING': 'Đang diễn ra',
      'COMPLETED': 'Hoàn thành',
      'CANCELLED': 'Đã hủy',
      'EXPIRED': 'Đã hết hạn'
    };
    return statusMap[status] || status;
  }

  getStatusColor(status) {
    const colorMap = {
      'SCHEDULED': '#FF9800',
      'PENDING': '#FF9800',
      'CONFIRMED': '#4CAF50',
      'ONGOING': '#2196F3',
      'COMPLETED': '#4CAF50',
      'CANCELLED': '#F44336',
      'EXPIRED': '#9E9E9E'
    };
    return colorMap[status] || '#666';
  }

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

  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km
    return distance;
  }
}

const rideService = new RideService();
export default rideService;
