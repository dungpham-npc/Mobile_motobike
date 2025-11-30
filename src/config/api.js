// API Configuration
export const API_CONFIG = {
  // Development - Use your computer's IP address instead of localhost
  // To find your IP: Windows: ipconfig | Mac/Linux: ifconfig
  DEV: {
    BASE_URL: "http://192.168.2.4:8080/api/v1", // Android emulator
    // Alternative IPs to try:
    // BASE_URL: 'http://192.168.1.XXX:8081/api/v1', // Replace XXX with your IP
    // BASE_URL: 'http://172.20.10.2:8081/api/v1', // iOS simulator
    TIMEOUT: 10000,
    DEMO_MODE: true, // Enable demo mode when backend is not available
  },

  // Production (update when deployed)
  // PROD: {
  //   BASE_URL: 'https://your-production-api.com/api/v1',
  //   TIMEOUT: 15000,
  //   DEMO_MODE: false,
  // },

  // Current environment
  get CURRENT() {
    return __DEV__ ? this.DEV : this.PROD;
  },
};

// Demo data for testing when backend is not available
export const DEMO_USERS = {
  STUDENT: {
    email: "student@university.edu.vn",
    password: "123456",
    userData: {
      user: {
        user_id: 1,
        user_type: "rider",
        email: "student@university.edu.vn",
        phone: "0987654321",
        full_name: "Nguyen Van A",
        student_id: "SE123456",
        profile_photo_url: "https://via.placeholder.com/100",
        is_active: true,
        email_verified: true,
        phone_verified: true,
      },
      rider_profile: {
        emergency_contact: "0987654320",
        rating_avg: 4.5,
        total_rides: 15,
        total_spent: 450000,
        preferred_payment_method: "wallet",
      },
      wallet: {
        wallet_id: 1,
        cached_balance: 150000,
        pending_balance: 0,
        is_active: true,
      },
    },
  },

  DRIVER: {
    email: "driver@university.edu.vn",
    password: "123456",
    userData: {
      user: {
        user_id: 2,
        user_type: "driver",
        email: "driver@university.edu.vn",
        phone: "0987654322",
        full_name: "Tran Thi B",
        student_id: "SE123457",
        profile_photo_url: "https://via.placeholder.com/100",
        is_active: true,
        email_verified: true,
        phone_verified: true,
      },
      driver_profile: {
        license_number: "B2-123456",
        status: "active",
        rating_avg: 4.8,
        total_shared_rides: 150,
        total_earned: 2500000,
        commission_rate: 0.15,
        is_available: true,
        max_passengers: 1,
      },
      wallet: {
        wallet_id: 2,
        cached_balance: 450000,
        pending_balance: 25000,
        is_active: true,
      },
    },
  },
};

// API Endpoints
export const ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    LOGOUT: "/auth/logout",
    FORGOT_PASSWORD: "/users/forgot-password",
  },

  // User Profile
  PROFILE: {
    PROFILE: "/me",
    UPDATE_PROFILE: "/users/me",
    UPDATE_PASSWORD: "/users/me/update-password",
    UPDATE_AVATAR: "/users/avatar",
    SWITCH_PROFILE: "/me/switch-profile",
    ALL_USERS: "/users/all",
  },

  // Verification - User Endpoints
  VERIFICATION: {
    STUDENT: "/me/student-verifications",
    DRIVER_LICENSE: "/me/driver-verifications/license",
    DRIVER_DOCUMENTS: "/me/driver-verifications/documents",
    DRIVER_VEHICLE_REGISTRATION:
      "/me/driver-verifications/vehicle-registration",
    // Fallback endpoints if above don't work
    DRIVER_ALT: "/verification/driver",
    STUDENT_ALT: "/verification/student",
  },

  // Verification - Admin Endpoints
  VERIFICATION_ADMIN: {
    STUDENTS_PENDING: "/verification/students/pending",
    STUDENTS_HISTORY: "/verification/students/history",
    STUDENT_DETAILS: "/verification/students",
    STUDENT_APPROVE: "/verification/students/{id}/approve",
    STUDENT_REJECT: "/verification/students/{id}/reject",
    STUDENTS_BULK_APPROVE: "/verification/students/bulk-approve",

    DRIVERS_PENDING: "/verification/drivers/pending",
    DRIVER_KYC: "/verification/drivers/{id}/kyc",
    DRIVER_APPROVE_DOCS: "/verification/drivers/{id}/approve-docs",
    DRIVER_APPROVE_LICENSE: "/verification/drivers/{id}/approve-license",
    DRIVER_APPROVE_VEHICLE: "/verification/drivers/{id}/approve-vehicle",
    DRIVER_REJECT: "/verification/drivers/{id}/reject",
    DRIVER_BACKGROUND_CHECK: "/verification/drivers/{id}/background-check",
    DRIVER_STATS: "/verification/drivers/stats",
  },

  // OTP
  OTP: {
    REQUEST: "/otp", // POST /api/v1/otp - Request OTP code
    VERIFY: "/otp/verify", // POST /api/v1/otp/verify - Verify OTP code
  },

  // Wallet & Transactions (Updated API)
  WALLET: {
    BALANCE: "/wallet/balance",
    TRANSACTIONS: "/wallet/transactions",
    TOPUP_INIT: "/wallet/topup/init",
    PAYOUT_INIT: "/wallet/payout/init",
    EARNINGS: "/wallet/earnings",
  },

  // Transaction History API (New)
  TRANSACTION: {
    USER_HISTORY: "/transaction/history/user-transactions",
    ALL: "/transaction/all", // Admin only
  },

  // PayOS Payment Integration (Keep webhook for backend)
  PAYOS: {
    WEBHOOK: "/payos/webhook",
  },

  // Ride Sharing APIs
  RIDES: {
    // Driver endpoints
    CREATE: "/rides",
    GET_BY_DRIVER: "/rides/driver",
    GET_MY_RIDES: "/rides", // Get rides for logged-in driver
    MY_COMPLETED_RIDES: "/rides/my-completed-rides", // Get completed rides for logged-in driver
    START: "/rides/{rideId}/start",
    COMPLETE: "/rides/{rideId}/complete",
    CANCEL: "/rides/{rideId}",

    // Rider endpoints
    AVAILABLE: "/rides/available",
    DETAILS: "/rides/{rideId}",
  },

  RIDE_TRACKING: {
    SNAPSHOT: "/ride-tracking/{rideId}/snapshot",
  },

  // Ride Requests APIs
  RIDE_REQUESTS: {
    // Rider endpoints
    BOOK_RIDE: "/ride-requests",
    JOIN_RIDE: "/ride-requests/rides/{rideId}",
    GET_BY_RIDER: "/ride-requests/rider",
    CANCEL: "/ride-requests/{requestId}",
    DETAILS: "/ride-requests/{requestId}",

    // Driver endpoints
    BROADCASTING: "/ride-requests/broadcasting",
    GET_BY_RIDE: "/ride-requests/rides/{rideId}",
    ACCEPT: "/ride-requests/{requestId}/accept",
    ACCEPT_BROADCAST: "/ride-requests/{requestId}/broadcast/accept",
    REJECT: "/ride-requests/{requestId}/reject",
    START_REQUEST: "/rides/start-ride-request", // Start a ride request (CONFIRMED -> ONGOING)
    COMPLETE_REQUEST: "/rides/complete", // Complete a ride request (unified endpoint)
  },

  // Shared Rides APIs
  SHARED_RIDES: {
    CREATE: "/shared-rides",
    GET_BY_ID: "/rides/{rideId}",
    GET_BY_DRIVER: "/shared-rides/driver",
    UPDATE: "/shared-rides/{rideId}",
    DELETE: "/shared-rides/{rideId}",
    COMPLETE: "/rides/complete",
    CANCEL: "/shared-rides/{rideId}/cancel",
    START: "/shared-rides/{rideId}/start",
  },

  // Quote API
  QUOTES: {
    GET_QUOTE: "/quotes",
  },

  // Locations/POI API
  LOCATIONS: {
    GET_POIS: "/locations/pois", // New POI endpoint from admin
    GET_BY_ID: "/locations/{id}",
    SEARCH: "/locations/search",
  },

  // Banks API
  BANKS: {
    ALL: "/banks",
    SUPPORTED: "/banks/supported",
    BY_BIN: "/banks/{bin}",
    VALIDATE_BIN: "/banks/validate/{bin}",
    STATS: "/banks/stats",
  },

  // FCM Push Notifications
  FCM: {
    REGISTER: "/fcm/register",
    DEACTIVATE: "/fcm/deactivate",
  },

  // Notifications
  NOTIFICATIONS: {
    LIST: "/notifications",
    DETAIL: "/notifications/{notifId}",
    MARK_READ: "/notifications/{notifId}/read",
    MARK_ALL_READ: "/notifications/read-all",
    DELETE: "/notifications/{notifId}",
    DELETE_ALL: "/notifications",
  },

  // SOS Alerts
  SOS: {
    TRIGGER: "/sos/alerts",
    MY_ALERTS: "/sos/alerts/me",
  },

  // Vehicle endpoints
  VEHICLES: {
    CREATE: "/vehicles",
    GET_ALL: "/vehicles",
    GET_BY_ID: "/vehicles/{vehicleId}",
    UPDATE: "/vehicles/{vehicleId}",
    DELETE: "/vehicles/{vehicleId}",
    GET_BY_DRIVER: "/vehicles/driver",
    GET_BY_STATUS: "/vehicles/status/{status}",
  },

  // Routes API
  ROUTES: {
    TEMPLATES: "/routes/templates",
  },

  // Ratings API
  RATINGS: {
    SUBMIT: "/ratings",
    DRIVER_HISTORY: "/ratings/driver/history",
    RIDER_HISTORY: "/ratings/rider/history",
  },

  // WebSocket endpoint (not REST)
  WEBSOCKET: {
    ENDPOINT: "/ws-native", // WebSocket endpoint
    FALLBACK_ENDPOINTS: ["/ws/websocket", "/websocket", "/ws"], // Try multiple endpoints
    DRIVER_QUEUE: "/user/queue/ride-offers",
    RIDER_QUEUE: "/user/queue/ride-matching",
    RIDE_TRACKING: "/topic/ride.tracking.{rideId}", // Real-time tracking updates
  },
};
