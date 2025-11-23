import apiService, { ApiError } from "./api";
import { ENDPOINTS } from "../config/api";

class RideService {
  constructor() {
    this.apiService = apiService;
  }

  // ========== QUOTE SERVICES ==========

  async normalizeQuoteFromBE(payload = {}) {
    const fare = payload.fare || {};

    // Handle both object with .amount property and direct number values
    const safeAmount = (obj) => {
      if (obj === null || obj === undefined) return null;
      if (typeof obj === "number") return obj;
      if (typeof obj === "object" && typeof obj.amount === "number")
        return obj.amount;
      if (typeof obj === "string") {
        const parsed = parseFloat(obj);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    // Extract quoteId - handle both camelCase and snake_case
    const quoteId = payload.quoteId || payload.quote_id || null;

    console.log(
      "Normalizing quote, payload:",
      JSON.stringify(payload, null, 2)
    );
    console.log("Extracted quoteId:", quoteId);
    console.log("Fare object:", JSON.stringify(fare, null, 2));

    // Handle fare.total in various formats
    const totalFare =
      safeAmount(fare.total) ||
      safeAmount(fare.totalVnd) ||
      safeAmount(payload.totalFare) ||
      0;
    console.log("Extracted total fare:", totalFare);

    return {
      // giữ lại thông tin gốc quan trọng
      quoteId: quoteId,
      riderId: payload.riderId ?? payload.rider_id ?? null,
      pricingConfigId:
        payload.pricingConfigId ?? payload.pricing_config_id ?? null,
      createdAt: payload.createdAt ?? payload.created_at ?? null,
      expiresAt: payload.expiresAt ?? payload.expires_at ?? null,

      // quãng đường & thời gian
      distanceM:
        typeof payload.distanceM === "number" ? payload.distanceM : null,
      durationS:
        typeof payload.durationS === "number" ? payload.durationS : null,

      // toạ độ nếu cần dùng lại
      pickupLat: payload.pickupLat ?? null,
      pickupLng: payload.pickupLng ?? null,
      dropoffLat: payload.dropoffLat ?? null,
      dropoffLng: payload.dropoffLng ?? null,

      // giá cước — đưa về dạng số, KHÔNG còn .amount ở UI
      fare: {
        total: totalFare,
        subtotal:
          safeAmount(fare.subtotal) || safeAmount(fare.subtotalVnd) || null,
        base2Km:
          safeAmount(fare.base2KmVnd) || safeAmount(fare.base2Km) || null,
        after2KmPerKm:
          safeAmount(fare.after2KmPerKmVnd) ||
          safeAmount(fare.after2KmPerKm) ||
          null,
        discount: safeAmount(fare.discount) || null,
        commissionRate:
          typeof fare.commissionRate === "number" ? fare.commissionRate : null,
        pricingVersion: fare.pricingVersion ?? fare.pricing_version ?? null,
        distanceMetersEcho:
          typeof fare.distanceMeters === "number" ? fare.distanceMeters : null,
      },

      polyline: payload.polyline ?? null,

      // giữ toàn bộ gốc nếu UI cần soi thêm
      raw: payload,
    };
  }

  async getQuote(
    pickup,
    dropoff,
    desiredPickupTime = null,
    notes = null,
    routeId = null
  ) {
    try {
      const body = {};

      // If routeId is provided, use predefined route (backend will use route's locations)
      if (routeId != null) {
        body.routeId = routeId;
      } else {
        // Otherwise, use custom locations
        if (pickup?.locationId || pickup?.id) {
          body.pickupLocationId = pickup.locationId || pickup.id;
        } else if (pickup?.latitude && pickup?.longitude) {
          body.pickup = {
            latitude: pickup.latitude,
            longitude: pickup.longitude,
          };
        } else {
          throw new Error(
            "Invalid pickup location: must have either locationId or coordinates"
          );
        }

        if (dropoff?.locationId || dropoff?.id) {
          body.dropoffLocationId = dropoff.locationId || dropoff.id;
        } else if (dropoff?.latitude && dropoff?.longitude) {
          body.dropoff = {
            latitude: dropoff.latitude,
            longitude: dropoff.longitude,
          };
        } else {
          throw new Error(
            "Invalid dropoff location: must have either locationId or coordinates"
          );
        }
      }

      if (desiredPickupTime) body.desiredPickupTime = desiredPickupTime;
      if (notes) body.notes = notes;

      console.log("Quote request body:", JSON.stringify(body, null, 2));

      const raw = await this.apiService.post(ENDPOINTS.QUOTES.GET_QUOTE, body);
      // Nếu apiService là axios wrapper, nó có thể trả { data: ... }
      const payload =
        raw && typeof raw === "object" && "data" in raw ? raw.data : raw;

      const normalized = this.normalizeQuoteFromBE(payload);

      return normalized;
    } catch (error) {
      console.error("Get quote error:", error);
      throw error;
    }
  }

  // ========== RIDER SERVICES ==========

  async bookRide(quoteId, desiredPickupTime = null, notes = null) {
    try {
      const body = {
        quoteId: quoteId,
      };

      // Add optional fields if provided
      if (desiredPickupTime) {
        body.desiredPickupTime = desiredPickupTime;
      }
      if (notes) {
        body.notes = notes;
      }

      const response = await this.apiService.post(
        ENDPOINTS.RIDE_REQUESTS.BOOK_RIDE,
        body
      );
      return response;
    } catch (error) {
      console.error("Book ride error:", error);
      throw error;
    }
  }

  async joinRide(rideId, quoteId, desiredPickupTime = null, notes = null) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.JOIN_RIDE.replace(
        "{rideId}",
        rideId
      );
      const body = {
        quoteId: quoteId,
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
      console.error("Join ride error:", error);
      throw error;
    }
  }

  async getAvailableRides(
    startTime = null,
    endTime = null,
    page = 0,
    size = 20
  ) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      if (startTime) params.append("startTime", startTime);
      if (endTime) params.append("endTime", endTime);

      const response = await this.apiService.get(
        `${ENDPOINTS.RIDES.AVAILABLE}?${params.toString()}`
      );
      return response;
    } catch (error) {
      console.error("Get available rides error:", error);
      throw error;
    }
  }

  async getRiderRequests(riderId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      if (status) params.append("status", status);

      const endpoint = `${
        ENDPOINTS.RIDE_REQUESTS.GET_BY_RIDER
      }/${riderId}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get rider requests error:", error);
      throw error;
    }
  }

  async cancelRequest(requestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.CANCEL.replace(
        "{requestId}",
        requestId
      );
      const response = await this.apiService.delete(endpoint);
      return response;
    } catch (error) {
      console.error("Cancel request error:", error);
      throw error;
    }
  }

  // ========== DRIVER SERVICES ==========

  // Driver decision APIs
  // Create shared ride (Driver)
  async createSharedRide(rideData) {
    try {
      console.log("Creating shared ride:", rideData);
      const response = await this.apiService.post(
        ENDPOINTS.RIDES.CREATE,
        rideData
      );
      return response;
    } catch (error) {
      console.error("Create shared ride error:", error);
      throw error;
    }
  }

  async getBroadcastingRequests() {
    try {
      const response = await this.apiService.get(
        ENDPOINTS.RIDE_REQUESTS.BROADCASTING
      );
      return response;
    } catch (error) {
      console.error("Get broadcasting requests error:", error);
      throw error;
    }
  }

  async acceptRideRequest(requestId, rideId, currentLocation = null) {
    try {
      console.log("📞 Accepting ride request:", { requestId, rideId });

      const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT.replace(
        "{requestId}",
        requestId
      );
      const requestBody = {
        rideId,
        // Backend requires currentDriverLocation (LatLng)
        currentDriverLocation:
          currentLocation?.latitude && currentLocation?.longitude
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }
            : null,
      };

      console.log("📤 Sending request to:", endpoint);
      console.log("📤 Request body:", requestBody);

      const response = await this.apiService.post(endpoint, requestBody);

      console.log("✅ Accept ride request success:", response);
      return response;
    } catch (error) {
      console.error("❌ Accept ride request error:", error);
      throw error;
    }
  }

  async acceptBroadcastRequest(
    requestId,
    vehicleId,
    currentLocation = null,
    startLocationId = null
  ) {
    try {
      console.log("📞 Accepting broadcast request:", {
        requestId,
        vehicleId,
        currentLocation,
        startLocationId,
      });

      const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT_BROADCAST.replace(
        "{requestId}",
        requestId
      );

      // Build request body - at least one of startLocationId or startLatLng must be provided
      const requestBody = {};
      if (startLocationId) {
        requestBody.startLocationId = startLocationId;
      }

      if (currentLocation?.latitude && currentLocation?.longitude) {
        requestBody.startLatLng = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        };
      } else {
        // Fallback: send with null location if not available
        requestBody.startLatLng = null;
      }

      console.log("📤 Sending request to:", endpoint);
      console.log("📤 Request body:", requestBody);

      const response = await this.apiService.post(endpoint, requestBody);

      console.log("✅ Accept broadcast request success:", response);
      return response;
    } catch (error) {
      console.error("❌ Accept broadcast request error:", error);
      throw error;
    }
  }

  async rejectRideRequest(requestId, reason = null) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.REJECT.replace(
        "{requestId}",
        requestId
      );
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      const response = await this.apiService.post(endpoint + params);
      return response;
    } catch (error) {
      console.error("Reject ride request error:", error);
      throw error;
    }
  }

  // Get ride by ID
  async getRideById(rideId) {
    try {
      const endpoint = ENDPOINTS.SHARED_RIDES.GET_BY_ID.replace(
        "{rideId}",
        rideId
      );
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get ride by ID error:", error);
      throw error;
    }
  }

  async getRideTrackingSnapshot(rideId) {
    try {
      if (!rideId) {
        throw new Error("rideId is required to fetch tracking snapshot");
      }
      const endpoint = ENDPOINTS.RIDE_TRACKING.SNAPSHOT.replace(
        "{rideId}",
        rideId
      );
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get ride tracking snapshot error:", error);
      throw error;
    }
  }

  // Complete ride - will auto-complete all ride requests first
  async completeRide(rideId, rideRequestId = null) {
    try {
      // First, get all ride requests to check their status
      const requests = await this.getRideRequests(rideId);
      const requestList = Array.isArray(requests)
        ? requests
        : requests?.data || requests?.content || [];

      // Complete any ONGOING requests first
      const ongoingRequests = requestList.filter(
        (req) => req.status === "ONGOING"
      );
      for (const req of ongoingRequests) {
        try {
          console.log(
            `Completing ride request ${
              req.sharedRideRequestId || req.rideRequestId
            } before completing ride...`
          );
          await this.completeRideRequestOfRide(
            rideId,
            req.sharedRideRequestId || req.rideRequestId
          );
        } catch (err) {
          console.warn(
            `Failed to complete request ${
              req.sharedRideRequestId || req.rideRequestId
            }:`,
            err
          );
        }
      }

      // Now complete the ride
      const endpoint = ENDPOINTS.SHARED_RIDES.COMPLETE.replace(
        "{rideId}",
        rideId
      );
      const payload = { rideId };
      if (rideRequestId !== null && rideRequestId !== undefined) {
        payload.rideRequestId = rideRequestId;
      }
      const response = await this.apiService.post(endpoint, payload);
      return response;
    } catch (error) {
      console.error("Complete ride error:", error);
      throw error;
    }
  }

  // Cancel ride
  async cancelRide(rideId, reason = null) {
    try {
      const endpoint = ENDPOINTS.SHARED_RIDES.CANCEL.replace(
        "{rideId}",
        rideId
      );
      const body = reason ? { reason } : {};
      const response = await this.apiService.post(endpoint, body);
      return response;
    } catch (error) {
      console.error("Cancel ride error:", error);
      throw error;
    }
  }

  // Ride management APIs
  async startRide(rideId) {
    try {
      const endpoint = ENDPOINTS.RIDES.START.replace("{rideId}", rideId);
      const response = await this.apiService.post(endpoint, { rideId });
      return response;
    } catch (error) {
      console.error("Start ride error:", error);
      throw error;
    }
  }

  // Start a ride request (CONFIRMED -> ONGOING) - called when driver picks up passenger
  async startRideRequestOfRide(rideId, rideRequestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.START_REQUEST;
      const response = await this.apiService.post(endpoint, {
        rideId,
        rideRequestId,
      });
      return response;
    } catch (error) {
      console.error("Start ride request error:", error);
      throw error;
    }
  }

  // Complete a ride request (ONGOING -> COMPLETED) - called when driver drops off passenger
  async completeRideRequestOfRide(rideId, rideRequestId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.COMPLETE_REQUEST;
      const response = await this.apiService.post(endpoint, {
        rideId,
        rideRequestId,
      });
      return response;
    } catch (error) {
      console.error("Complete ride request error:", error);
      throw error;
    }
  }

  async createRide(
    vehicleId,
    startLocationId,
    endLocationId,
    startLatLng,
    endLatLng,
    scheduledDepartureTime
  ) {
    try {
      const response = await this.apiService.post(ENDPOINTS.RIDES.CREATE, {
        vehicleId,
        startLocationId,
        endLocationId,
        startLatLng: {
          latitude: startLatLng.latitude,
          longitude: startLatLng.longitude,
        },
        endLatLng: {
          latitude: endLatLng.latitude,
          longitude: endLatLng.longitude,
        },
        scheduledDepartureTime,
      });
      return response;
    } catch (error) {
      console.error("Create ride error:", error);
      throw error;
    }
  }

  async getDriverRides(driverId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      if (status) params.append("status", status);

      const endpoint = `${
        ENDPOINTS.RIDES.GET_BY_DRIVER
      }/${driverId}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get driver rides error:", error);
      throw error;
    }
  }

  // Get rides for logged-in driver (no driverId needed)
  async getMyRides(
    status = null,
    page = 0,
    size = 20,
    sortBy = "createdAt",
    sortDir = "desc"
  ) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sortBy: sortBy,
        sortDir: sortDir,
      });

      if (status) params.append("status", status);

      const endpoint = `${ENDPOINTS.RIDES.GET_MY_RIDES}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get my rides error:", error);
      throw error;
    }
  }

  async getMyCompletedRides(
    page = 0,
    size = 20,
    sortBy = "completedAt",
    sortDir = "desc"
  ) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        sortBy: sortBy,
        sortDir: sortDir,
      });

      const endpoint = `${ENDPOINTS.RIDES.MY_COMPLETED_RIDES}?${params.toString()}`;
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get my completed rides error:", error);
      throw error;
    }
  }

  async getRideRequests(rideId, status = null, page = 0, size = 20) {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });

      if (status) params.append("status", status);

      const endpoint = ENDPOINTS.RIDE_REQUESTS.GET_BY_RIDE.replace(
        "{rideId}",
        rideId
      );
      const response = await this.apiService.get(
        `${endpoint}?${params.toString()}`
      );
      return response;
    } catch (error) {
      console.error("Get ride requests error:", error);
      throw error;
    }
  }

  async acceptRequest(requestId, rideId) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.ACCEPT.replace(
        "{requestId}",
        requestId
      );
      const response = await this.apiService.post(endpoint, {
        rideId: rideId,
      });
      return response;
    } catch (error) {
      console.error("Accept request error:", error);
      throw error;
    }
  }

  async rejectRequest(requestId, reason) {
    try {
      const endpoint = ENDPOINTS.RIDE_REQUESTS.REJECT.replace(
        "{requestId}",
        requestId
      );
      const params = new URLSearchParams({
        reason: reason,
      });

      const response = await this.apiService.post(
        `${endpoint}?${params.toString()}`
      );
      return response;
    } catch (error) {
      console.error("Reject request error:", error);
      throw error;
    }
  }

  // ========== SHARED SERVICES ==========

  async getRideDetails(rideId) {
    try {
      const endpoint = ENDPOINTS.RIDES.DETAILS.replace("{rideId}", rideId);
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get ride details error:", error);
      throw error;
    }
  }

  async getRequestDetails(requestId) {
    try {
      // Validate requestId
      if (!requestId || requestId === 'undefined' || requestId === 'null' || requestId === '{requestId}') {
        console.error("❌ Invalid requestId:", requestId);
        throw new Error("Invalid request ID");
      }
      
      const endpoint = ENDPOINTS.RIDE_REQUESTS.DETAILS.replace(
        "{requestId}",
        requestId
      );
      const response = await this.apiService.get(endpoint);
      return response;
    } catch (error) {
      console.error("Get request details error:", error);
      
      // If request not found (404), clear active ride from storage
      if (error?.message?.includes('not found') || error?.message?.includes('Không tìm thấy')) {
        console.warn('⚠️ Request not found, clearing from storage');
        try {
          const activeRideService = require('./activeRideService').default;
          await activeRideService.clearActiveRide();
        } catch (clearError) {
          console.error('Failed to clear active ride:', clearError);
        }
      }
      
      throw error;
    }
  }

  // ========== UTILITY METHODS ==========

  formatRideStatus(status) {
    const statusMap = {
      SCHEDULED: "Đã lên lịch",
      ONGOING: "Đang diễn ra",
      COMPLETED: "Hoàn thành",
      CANCELLED: "Đã hủy",
    };
    return statusMap[status] || status;
  }

  formatRequestStatus(status) {
    const statusMap = {
      PENDING: "Chờ xác nhận",
      CONFIRMED: "Đã xác nhận",
      ONGOING: "Đang diễn ra",
      COMPLETED: "Hoàn thành",
      CANCELLED: "Đã hủy",
      EXPIRED: "Đã hết hạn",
    };
    return statusMap[status] || status;
  }

  getStatusColor(status) {
    const colorMap = {
      SCHEDULED: "#FF9800",
      PENDING: "#FF9800",
      CONFIRMED: "#4CAF50",
      ONGOING: "#2196F3",
      COMPLETED: "#4CAF50",
      CANCELLED: "#F44336",
      EXPIRED: "#9E9E9E",
    };
    return colorMap[status] || "#666";
  }

  formatCurrency(amount) {
    if (typeof amount !== "number") {
      amount = parseFloat(amount) || 0;
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatDateTime(dateString) {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("vi-VN") +
      " " +
      date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  }
}

const rideService = new RideService();
export default rideService;
