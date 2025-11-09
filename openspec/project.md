# Project Context

## Purpose
Motorbike Sharing System for University Students (MSSUS) - Mobile Application. A React Native (Expo) mobile app that enables university students to:
- Register and verify accounts (student and driver KYC verification)
- Discover, request, and share motorbike rides with real-time matching
- Track rides live via GPS with real-time location updates
- Receive in-app notifications via WebSocket and Firebase Cloud Messaging (FCM)
- Manage wallets with top-ups (PayOS integration), payouts, and transaction history
- View ride history, earnings, and ratings
- Access driver dashboard for creating and managing shared rides
- Use SOS alerts and emergency contacts

## Tech Stack
- **Framework**: React Native 0.81.5 with Expo SDK 54.0.21
- **React**: React 19.1.0
- **Navigation**: 
  - `@react-navigation/native` ^6.1.9
  - `@react-navigation/native-stack` ^6.9.17
  - `@react-navigation/bottom-tabs` ^6.5.11
- **UI Libraries**:
  - `react-native-paper` ^5.11.6 (Material Design components)
  - `react-native-vector-icons` ^10.0.3 (Material Icons)
  - `expo-linear-gradient` ~15.0.7 (Gradient backgrounds)
  - `react-native-animatable` ^1.4.0 (Animations)
  - `lottie-react-native` ~7.3.1 (Lottie animations)
- **Real-time Communication**:
  - `@stomp/stompjs` ^7.2.1 (STOMP over WebSocket)
  - `sockjs-client` ^1.6.1 (SockJS fallback)
- **Expo Modules**:
  - `expo-location` ~19.0.7 (GPS tracking)
  - `expo-notifications` ~0.32.12 (Push notifications)
  - `expo-image-picker` ~17.0.8 (Image selection)
  - `expo-contacts` ~15.0.9 (Emergency contacts)
  - `@react-native-async-storage/async-storage` 2.2.0 (Local storage)
  - `expo-task-manager` ~14.0.7 (Background tasks)
- **Maps & Location**:
  - Goong Maps API (via custom `GoongMap` component and `goongService.js`)
- **Payment Integration**:
  - PayOS payment gateway (via backend API)
  - QR code generation: `react-native-qrcode-svg` ^6.3.0
- **State Management**: React Hooks (useState, useEffect, useContext)
- **TypeScript**: TypeScript 5.9.2 (config present, primarily JSX source files)

## Project Conventions

### Code Style
- **File Organization**:
  - Components: `src/components/` (reusable UI components)
  - Screens: `src/screens/` (organized by feature: auth, main, driver, ride, profile, verification)
  - Services: `src/services/` (API, WebSocket, FCM, Location, Payment, etc.)
  - Config: `src/config/` (API endpoints, environment configs)
  - Navigation: `src/navigation/` (navigation setup)
  - Theme: `src/theme/designTokens.js` (design tokens, colors, typography)
  - Utils: `src/utils/` (utility functions)
- **Naming Conventions**:
  - Components: PascalCase (e.g., `ModernButton.jsx`, `WalletScreen.jsx`)
  - Services: camelCase with "Service" suffix (e.g., `authService.js`, `paymentService.js`)
  - Files: camelCase for utilities, PascalCase for components/screens
  - Constants: UPPER_SNAKE_CASE in config files
- **Component Structure**:
  - Functional components with React Hooks
  - Props destructuring at function signature
  - Inline styles via StyleSheet.create() or theme tokens
  - Use of `LinearGradient`, `Animatable`, and custom UI components

### Architecture Patterns
- **Service Layer Pattern**:
  - API calls centralized in service modules (`src/services/*.js`)
  - Base API service (`api.js`) handles authentication, token refresh, error handling
  - Specialized services: `authService.js`, `paymentService.js`, `rideService.js`, `websocketService.js`, etc.
- **Configuration Management**:
  - API endpoints defined in `src/config/api.js` with environment-based base URLs
  - Demo mode support for offline development (`API_CONFIG.DEV.DEMO_MODE`)
  - Deep link scheme: `mssus://` (configured in `app.json`)
- **Navigation**:
  - Stack navigation for main app flow
  - Tab navigation for driver dashboard
  - Deep linking support for payment callbacks (`mssus://payment/success`, `mssus://payment/cancel`)
- **Real-time Communication**:
  - WebSocket client with STOMP protocol for ride matching, offers, notifications
  - Fallback mechanism: native WebSocket → SockJS
  - JWT token authentication via query parameter
  - FCM integration for push notifications
- **State Management**:
  - Local state with `useState` and `useEffect`
  - Context API for global state (if needed)
  - AsyncStorage for persistent data (tokens, user data, saved bank accounts)

### Testing Strategy
- **Manual Testing**:
  - Test guides: `RIDE_MATCHING_TEST_GUIDE.md`, `WEBSOCKET_GUIDE.md`, `TEST_FLOW_GUIDE.md`
  - API integration testing: `API_INTEGRATION.md`
  - Goong Maps setup: `GOONG_MAPS_SETUP.md`
- **Development Mode**:
  - Demo mode available when backend is unavailable
  - Mock data in `src/data/` for testing
  - Test panels: `FCMTestPanel.jsx`, `WebSocketTestPanel.jsx`
- **Error Handling**:
  - Centralized error handling in API service
  - User-friendly error messages in Vietnamese
  - Network error detection and retry logic

### Git Workflow
- **Branching**: 
  - `main` (production-ready)
  - `develop` (integration branch)
  - Feature branches: `feature/*`
  - Hotfix branches: `hotfix/*`
- **Commits**: Conventional commit style (e.g., `feat(wallet): add top-up functionality`)
- **PRs**: Include description, test notes, screenshots for UI changes
- **OpenSpec**: Use OpenSpec for change proposals, design documents, and specifications

## Domain Context
- **User Types**:
  - Riders: University students who need rides
  - Drivers: University students who offer rides
  - Users can have both rider and driver profiles
- **Authentication & Verification**:
  - Email/password authentication with JWT tokens
  - OTP verification for email/phone
  - Student verification (student ID)
  - Driver verification (license, documents, vehicle registration)
- **Ride Lifecycle**:
  - Rider creates booking request with pickup/dropoff locations
  - Request broadcast to nearby drivers via WebSocket
  - Driver receives offer and can accept/reject
  - Wallet hold placed when driver accepts
  - Real-time GPS tracking during ride
  - Payment captured on ride completion
  - Funds released to driver (minus commission)
- **Wallet & Payments**:
  - Wallet balance management (available, pending, frozen)
  - Top-up via PayOS (QR code or payment link)
  - Payout requests to bank accounts
  - Transaction history (TOPUP, PAYOUT, CAPTURE_FARE, etc.)
  - Saved bank accounts for quick payouts
- **Real-time Features**:
  - WebSocket destinations:
    - `/user/queue/ride-offers` (driver offers to riders)
    - `/user/queue/ride-matching` (ride match updates)
    - `/user/queue/notifications` (general notifications)
  - FCM push notifications for ride updates, payment confirmations
  - Live location tracking with background location updates
- **Maps & Location**:
  - Goong Maps integration for:
    - Address search and geocoding
    - Route calculation and directions
    - Place of Interest (POI) search
    - Map display with markers and polylines

## Important Constraints
- **API Integration**:
  - Base URL: `http://192.168.1.5:8080/api/v1` (development, configurable in `api.js`)
  - All API calls require JWT authentication
  - Token refresh handled automatically
  - Timeout: 10 seconds (configurable)
- **Deep Linking**:
  - Scheme: `mssus://` (configured in `app.json`)
  - Payment callbacks: `mssus://payment/success`, `mssus://payment/cancel`
  - Deep link handling in `App.jsx` and screen components
- **Permissions**:
  - Location (foreground and background) for ride tracking
  - Camera and photo library for verification documents
  - Contacts for emergency contacts
  - Notifications for push notifications
- **Platform Support**:
  - iOS: Supports tablets, requires iOS permissions in `Info.plist`
  - Android: Package name `com.dbao0312.mssusiatrs`, requires Android permissions
  - Web: Limited support (favicon configured)
- **Data Storage**:
  - AsyncStorage for tokens, user data, saved bank accounts
  - Secure storage for sensitive data (bank account numbers masked)
  - Location data cached for offline use
- **Third-party Services**:
  - Goong Maps: Free tier request limits
  - PayOS: Payment gateway integration via backend
  - Firebase: FCM push notifications
  - Backend API: Must be running for full functionality

## External Dependencies
- **Backend API**: Spring Boot REST API at `/api/v1`
  - Authentication endpoints
  - User profile and verification endpoints
  - Ride management endpoints
  - Wallet and payment endpoints
  - Transaction history endpoints
- **WebSocket Server**: STOMP over WebSocket
  - Endpoints: `/ws` (SockJS) and `/ws-native` (native WebSocket)
  - Authentication via JWT token query parameter
- **Goong Maps API**: 
  - Maps, geocoding, directions, places search
  - API key required (configured in `goongService.js`)
- **PayOS**: 
  - Payment gateway for top-ups
  - Webhook callbacks handled by backend
  - Payment links and QR codes generated by backend
- **Firebase Cloud Messaging (FCM)**:
  - Push notifications for ride updates, payments
  - Configured via `google-services.json` (Android)
  - Expo notifications module for cross-platform support

## Notes/Links
- **Development Guides**:
  - `README-DEV.md` - Development setup and instructions
  - `API_INTEGRATION.md` - API integration guide
  - `GOONG_MAPS_SETUP.md` - Goong Maps configuration
  - `WEBSOCKET_GUIDE.md` - WebSocket usage guide
  - `RIDE_MATCHING_TEST_GUIDE.md` - Ride matching test scenarios
  - `TEST_FLOW_GUIDE.md` - General testing flow
- **Configuration Files**:
  - `app.json` - Expo configuration (scheme, permissions, icons)
  - `package.json` - Dependencies and scripts
  - `src/config/api.js` - API endpoints and configuration
  - `src/theme/designTokens.js` - Design tokens and theme
- **Key Services**:
  - `src/services/api.js` - Base API service with auth and error handling
  - `src/services/authService.js` - Authentication and user management
  - `src/services/paymentService.js` - Wallet, top-up, payout operations
  - `src/services/websocketService.js` - WebSocket/STOMP client
  - `src/services/fcmService.js` - Firebase Cloud Messaging
  - `src/services/goongService.js` - Goong Maps API integration
  - `src/services/rideService.js` - Ride booking and management
  - `src/services/locationService.js` - Location tracking and updates


