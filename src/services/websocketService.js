// services/websocketService.js
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { API_CONFIG, ENDPOINTS } from '../config/api';
import authService from './authService';

class WebSocketService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5; // Increase retry attempts
    this.baseRetryDelay = 2000; // Start with 2 seconds
    this.subscriptions = new Map();
    this.messageHandlers = new Map();
    this.connectionPromise = null;

    // PATCH: keep constants here for clarity
    this.HEARTBEAT_MS = 10000;
    this.CONNECTION_TIMEOUT_MS = 30000;
  }

  generateSubscriptionKey(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  // Initialize WebSocket connection
  async connect() {
    // Prevent multiple concurrent connections
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (outerResolve, outerReject) => {
      let timeoutId = null; // PATCH: keep local timer, do not reassign resolve/reject
      try {
        // Get valid token (will refresh if expired)
        const token = await authService.getValidToken();
        if (!token) {
          outerReject(new Error('No authentication token available'));
          return;
        }

        // Disconnect existing connection first
        this.disconnect();

        // Build base URLs
        const baseUrl = API_CONFIG.CURRENT.BASE_URL.replace('/api/v1', '');
        const wsBaseUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');

        // PATCH: ưu tiên native trước, SockJS sau (fallback)
        const endpoints = [
          // Native WebSocket endpoint (backend /ws-native + STOMP)
          { url: `${wsBaseUrl}${ENDPOINTS.WEBSOCKET.ENDPOINT || '/ws-native'}?token=${encodeURIComponent(token)}`, type: 'websocket', token },
          // SockJS endpoint (backend /ws có withSockJS)
          { url: `${baseUrl}/ws?token=${encodeURIComponent(token)}`, type: 'sockjs', token },
        ];

        const tryConnect = (endpointIndex) => {
          if (endpointIndex >= endpoints.length) {
            outerReject(new Error('All WebSocket endpoints failed'));
            return;
          }

          const endpoint = endpoints[endpointIndex];
          const wsUrl = endpoint.url;
          const connectionType = endpoint.type;

          console.log(`🔄 WebSocket attempt ${endpointIndex + 1}/${endpoints.length}:`, wsUrl);
          console.log(`🔄 Connection type: ${connectionType}`);
          console.log('Auth token:', token ? token.substring(0, 20) + '...' : 'null');

          // Configure client based on connection type
          const clientConfig = {
            // NOTE: Spring đang đọc token ở query, vẫn giữ headers để không phá API cũ
            connectHeaders: {
              Authorization: `Bearer ${token}`,
            },
            debug: (str) => {
              if (__DEV__) {
                console.log('STOMP Debug:', str);
                if (str.includes('>>> CONNECT')) {
                  console.log('📤 Sending STOMP CONNECT frame...');
                } else if (str.includes('<<< CONNECTED')) {
                  console.log('📥 Received STOMP CONNECTED frame');
                } else if (str.includes('<<< ERROR')) {
                  console.log('❌ Received STOMP ERROR frame');
                } else if (str.includes('<<< RECEIPT')) {
                  console.log('📥 Received STOMP RECEIPT frame');
                }
              }
            },
            // Ta tự quản reconnect ở ngoài, không dùng reconnectDelay của lib (giữ = 0)
            reconnectDelay: 0,
            heartbeatIncoming: this.HEARTBEAT_MS,
            heartbeatOutgoing: this.HEARTBEAT_MS,
            beforeConnect: () => {
              console.log('🤝 Preparing WebSocket handshake...');
            },

            // PATCH: tương thích RN + Spring
            forceBinaryWSFrames: true,
            appendMissingNULLonIncoming: true,
          };

          // PATCH: dùng webSocketFactory cho cả 2 kiểu; khi có factory thì KHÔNG set brokerURL
          if (connectionType === 'sockjs') {
            console.log('🔌 Using SockJS connection');
            clientConfig.webSocketFactory = () => {
              // Không truyền headers ở đây: SockJS RN không hỗ trợ header handshake.
              // Token đã có trong query string (wsUrl)
              return new SockJS(wsUrl);
            };
          } else {
            console.log('🔌 Using native WebSocket connection');
            clientConfig.webSocketFactory = () => new WebSocket(wsUrl, ['v12.stomp']); // ép subprotocol STOMP 1.2
          }

          this.client = new Client(clientConfig);

          this.client.onConnect = (frame) => {
            console.log('✅ WebSocket connected successfully:', frame);
            console.log('🔗 STOMP session ID:', frame.headers?.['session'] || 'N/A');
            console.log('🔗 STOMP server:', frame.headers?.['server'] || 'N/A');
            console.log('🔗 STOMP version:', frame.headers?.['version'] || 'N/A');
            console.log('🔗 Connection established at:', new Date().toISOString());

            this.isConnected = true;
            this.reconnectAttempts = 0;

            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            this.connectionPromise = null;

            outerResolve(frame);
          };

          this.client.onDisconnect = (frame) => {
            console.log('🔌 WebSocket disconnected:', frame);
            this.isConnected = false;
            this.subscriptions.clear();
            this.connectionPromise = null;
          };

          this.client.onStompError = (frame) => {
            console.error(`❌ STOMP error (endpoint ${endpointIndex + 1}):`, frame);
            console.error('❌ STOMP error headers:', frame.headers);
            console.error('❌ STOMP error body:', frame.body);
            this.isConnected = false;

            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // Try next endpoint
            console.log(`🔄 Trying next endpoint due to STOMP error...`);
            try {
              this.client?.deactivate();
            } catch {}
            tryConnect(endpointIndex + 1);
          };

          this.client.onWebSocketError = (error) => {
            console.error(`❌ WebSocket error (endpoint ${endpointIndex + 1}):`, error);
            console.error('❌ WebSocket error details:', {
              type: error?.type,
              code: error?.code,
              reason: error?.reason,
              message: error?.message,
            });
            this.isConnected = false;

            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // Try next endpoint
            console.log(`🔄 Trying next endpoint...`);
            try {
              this.client?.deactivate();
            } catch {}
            tryConnect(endpointIndex + 1);
          };

          // PATCH: connection timeout đúng cách
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          timeoutId = setTimeout(() => {
            console.error(`⏰ WebSocket connection timeout after ${this.CONNECTION_TIMEOUT_MS / 1000} seconds`);
            this.isConnected = false;
            try {
              this.client?.deactivate();
            } catch {}
            outerReject(new Error(`Connection timeout after ${this.CONNECTION_TIMEOUT_MS / 1000} seconds`));
          }, this.CONNECTION_TIMEOUT_MS);

          // Activate the client
          console.log('🚀 Activating STOMP client...');
          this.client.activate();
        };

        // Start trying to connect
        tryConnect(0);
      } catch (error) {
        console.error('Connection setup error:', error);
        this.connectionPromise = null;
        if (timeoutId) clearTimeout(timeoutId);
        outerReject(error);
      }
    });

    return this.connectionPromise;
  }

  // Disconnect from WebSocket
  disconnect() {
    console.log('🔌 Disconnecting WebSocket...');

    if (this.client) {
      try {
        // Unsubscribe from all subscriptions
        this.subscriptions.forEach((subscription, key) => {
          try {
            subscription.unsubscribe();
            console.log(`✅ Unsubscribed from ${key}`);
          } catch (error) {
            console.warn(`⚠️ Error unsubscribing from ${key}:`, error);
          }
        });
        this.subscriptions.clear();
        this.messageHandlers.clear();

        // Deactivate client
        this.client.deactivate();
        console.log('✅ STOMP client deactivated');
      } catch (error) {
        console.warn('⚠️ Error during disconnect:', error);
      }
    }

    this.client = null;
    this.isConnected = false;
    this.connectionPromise = null;
    console.log('✅ WebSocket disconnected completely');
  }

  // Subscribe to driver ride offers
  subscribeToDriverOffers(callback, key) {
    if (!this.isConnected || !this.client) {
      throw new Error('WebSocket not connected');
    }

    const destination = ENDPOINTS.WEBSOCKET.DRIVER_QUEUE;
    console.log('📡 Subscribing to driver offers:', destination);

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        console.log('🎯 [WebSocket] Raw message received:', message);
        console.log('🎯 [WebSocket] Message body:', message.body);
        
        const data = JSON.parse(message.body);
        console.log('📨 [WebSocket] Received driver offer:', JSON.stringify(data, null, 2));
        console.log('📨 [WebSocket] Offer data type:', typeof data);
        console.log('📨 [WebSocket] Offer data keys:', Object.keys(data));
        console.log('📨 [WebSocket] totalFare:', data.totalFare, 'Type:', typeof data.totalFare);
        console.log('📨 [WebSocket] proposalRank:', data.proposalRank, 'rideId:', data.rideId);
        
        if (callback) {
          console.log('📨 [WebSocket] Calling driver offer callback');
          callback(data);
        } else {
          console.log('⚠️ [WebSocket] No callback provided for driver offer');
        }
      } catch (error) {
        console.error('❌ [WebSocket] Error parsing driver offer message:', error);
        console.error('❌ [WebSocket] Raw message:', message);
      }
    });

    const subscriptionKey = key || this.generateSubscriptionKey('driver-offers');
    this.subscriptions.set(subscriptionKey, subscription);
    this.messageHandlers.set(subscriptionKey, callback);

    return subscriptionKey;
  }

  // Subscribe to rider matching updates
  subscribeToRiderMatching(callback, key) {
    if (!this.isConnected || !this.client) {
      throw new Error('WebSocket not connected');
    }

    const destination = ENDPOINTS.WEBSOCKET.RIDER_QUEUE;
    console.log('📡 Subscribing to rider matching:', destination);

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('📨 [WebSocket] Received rider matching update:', JSON.stringify(data, null, 2));
        console.log('📨 [WebSocket] Status:', data.status, 'RequestId:', data.requestId, 'RideId:', data.rideId);
        callback(data);
      } catch (error) {
        console.error('❌ [WebSocket] Error parsing rider matching message:', error);
        console.error('❌ [WebSocket] Raw message body:', message.body);
      }
    });

    const subscriptionKey = key || this.generateSubscriptionKey('rider-matching');
    this.subscriptions.set(subscriptionKey, subscription);
    this.messageHandlers.set(subscriptionKey, callback);

    return subscriptionKey;
  }

  // Subscribe to general notifications
  subscribeToNotifications(callback, key) {
    if (!this.isConnected || !this.client) {
      throw new Error('WebSocket not connected');
    }

    const destination = '/user/queue/notifications';
    console.log('📡 Subscribing to notifications:', destination);

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('🔔 Received notification:', data);
        callback(data);
      } catch (error) {
        console.error('❌ Error parsing notification message:', error);
      }
    });

    const subscriptionKey = key || this.generateSubscriptionKey('notifications');
    this.subscriptions.set(subscriptionKey, subscription);
    this.messageHandlers.set(subscriptionKey, callback);

    return subscriptionKey;
  }

  // Connect as rider
  async connectAsRider(onRideMatching, onNotification) {
    try {
      await this.connect();

      // Subscribe to rider-specific queues
      this.subscribeToRiderMatching(onRideMatching);
      this.subscribeToNotifications(onNotification);

      console.log('✅ Rider connected and subscribed to all queues');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect as rider:', error);
      throw error;
    }
  }

  // Connect as driver
  async connectAsDriver(onRideOffer, onNotification) {
    try {
      await this.connect();

      // Subscribe to driver-specific queues
      this.subscribeToDriverOffers(onRideOffer);
      this.subscribeToNotifications(onNotification);

      console.log('✅ Driver connected and subscribed to all queues');

      // Send test message to verify connection (like in HTML demo)
      setTimeout(() => {
        if (this.client && this.client.connected) {
          console.log('📤 Sending test message to /app/test...');
          this.client.publish({
            destination: '/app/test',
            body: JSON.stringify({
              message: 'Driver connected from mobile app',
              timestamp: new Date().toISOString(),
              type: 'driver_connection_test',
            }),
          });
        }
      }, 1000);

      return true;
    } catch (error) {
      console.error('❌ Failed to connect as driver:', error);
      throw error;
    }
  }

  // Subscribe to ride tracking updates
  subscribeToRideTracking(rideId, callback) {
    if (!this.isConnected || !this.client) {
      throw new Error('WebSocket not connected');
    }

    const destination = ENDPOINTS.WEBSOCKET.RIDE_TRACKING.replace('{rideId}', rideId);
    console.log('📡 Subscribing to ride tracking:', destination);

    const subscription = this.client.subscribe(destination, (message) => {
      try {
        const data = JSON.parse(message.body);
        console.log('📨 [WebSocket] Received ride tracking update:', JSON.stringify(data, null, 2));
        console.log('📨 [WebSocket] RideId:', data.rideId, 'CurrentLat:', data.currentLat, 'CurrentLng:', data.currentLng);
        if (callback) {
          callback(data);
        }
      } catch (error) {
        console.error('❌ [WebSocket] Error parsing ride tracking message:', error);
        console.error('❌ [WebSocket] Raw message body:', message.body);
      }
    });

    const subscriptionKey = `ride-tracking-${rideId}`;
    this.subscriptions.set(subscriptionKey, subscription);
    this.messageHandlers.set(subscriptionKey, callback);

    return subscriptionKey;
  }

  // Unsubscribe from ride tracking
  unsubscribeFromRideTracking(rideId) {
    const subscriptionKey = `ride-tracking-${rideId}`;
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      try {
        subscription.unsubscribe();
        this.subscriptions.delete(subscriptionKey);
        this.messageHandlers.delete(subscriptionKey);
        console.log(`✅ Unsubscribed from ride tracking for ride ${rideId}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ride tracking:`, error);
      }
    }
  }

  // Unsubscribe from a destination
  unsubscribe(key) {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      try {
        subscription.unsubscribe();
        this.subscriptions.delete(key);
        this.messageHandlers.delete(key);
        console.log(`✅ Unsubscribed from ${key}`);
      } catch (error) {
        console.error(`❌ Error unsubscribing from ${key}:`, error);
      }
    }
  }

  // Send message to server
  sendMessage(destination, message) {
    if (!this.isConnected || !this.client) {
      throw new Error('WebSocket not connected');
    }

    console.log('📤 Sending message to:', destination, message);
    this.client.publish({
      destination: destination,
      body: JSON.stringify(message),
    });
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions.keys()),
      hasClient: !!this.client,
    };
  }

  // Force cleanup (for debugging)
  forceCleanup() {
    console.log('🧹 Force cleanup WebSocket service...');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connectionPromise = null;
  }
}

const websocketService = new WebSocketService();
export default websocketService;
