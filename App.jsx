import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/utils/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator, Linking, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from './src/theme/designTokens';
import authService from './src/services/authService';

// Authentication Screens
import LoginScreen from './src/screens/auth/LoginScreen.jsx';
import RegisterScreen from './src/screens/auth/RegisterScreen.jsx';
import OTPVerificationScreen from './src/screens/auth/OTPVerificationScreen.jsx';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen.jsx';

// Rider Screens
import HomeScreen from './src/screens/main/HomeScreen.jsx';
import ProfileScreen from './src/screens/main/ProfileScreen.jsx';
import WalletScreen from './src/screens/main/WalletScreen.jsx';
import RideHistoryScreen from './src/screens/main/RideHistoryScreen.jsx';
import RideDetailsScreen from './src/screens/RideDetailsScreen.jsx';
import QRPaymentScreen from './src/screens/main/QRPaymentScreen.jsx';
import ProfileSwitchScreen from './src/screens/main/ProfileSwitchScreen.jsx';
import RideBookingScreen from './src/screens/ride/RideBookingScreen.jsx';
import RideTrackingScreen from './src/screens/ride/RideTrackingScreen.jsx';
import RiderMatchingScreen from './src/screens/ride/RiderMatchingScreen.jsx';

// Profile Screens
import EditProfileScreen from './src/screens/profile/EditProfileScreen.jsx';
import ChangePasswordScreen from './src/screens/profile/ChangePasswordScreen.jsx';

// Verification Screens
import StudentVerificationScreen from './src/screens/verification/StudentVerificationScreen.jsx';
import DriverVerificationScreen from './src/screens/verification/DriverVerificationScreen.jsx';

// Driver Screens
import DriverHomeScreen from './src/screens/driver/DriverHomeScreen.jsx';
import DriverTestScreen from './src/screens/driver/DriverTestScreen.jsx';
import CreateSharedRideScreen from './src/screens/driver/CreateSharedRideScreen.jsx';
import VehicleManagementScreen from './src/screens/driver/VehicleManagementScreen.jsx';
import DriverRideTrackingScreen from './src/screens/driver/DriverRideTrackingScreen.jsx';
import DriverDashboardScreen from './src/screens/driver/DriverDashboardScreen.jsx';
import DriverEarningsScreen from './src/screens/driver/DriverEarningsScreen.jsx';
import DriverRatingsScreen from './src/screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from './src/screens/driver/DriverProfileScreen.jsx';
import SOSAlertScreen from './src/screens/driver/SOSAlertScreen.jsx';

// Navigation & UI
import DriverTabNavigator from './src/navigation/DriverTabNavigator.jsx';
import GlassTabBar from './src/components/ui/GlassTabBar.jsx';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = 'home';

          if (route.name === 'Wallet') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
      })}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="History" component={RideHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeApp();
    setupDeepLinkHandling();
  }, []);

  const setupDeepLinkHandling = () => {
    // Handle deep links when app is opened from a closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle deep links when app is already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription?.remove();
    };
  };

  const handleDeepLink = (url) => {
    console.log('App: Deep link received:', url);
    
    // Payment callbacks are handled by QRPaymentScreen
    // This handler is for general navigation
    if (url.startsWith('mssus://payment/')) {
      // Payment callbacks will be handled by QRPaymentScreen if it's mounted
      // Otherwise, navigate to wallet screen
      if (navigationRef.current) {
        const isAuth = authService.isAuthenticated();
        if (isAuth) {
          navigationRef.current.navigate('Wallet');
        }
      }
    }
  };

  const initializeApp = async () => {
    try {
      await authService.init();
      setIsAuthenticated(authService.isAuthenticated());
    } catch (error) {
      console.error('App initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !fontsLoaded) {
    return (
      <PaperProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </PaperProvider>
    );
  }

  return (
      <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer 
          ref={navigationRef}
          linking={{
            prefixes: ['mssus://'],
            config: {
              screens: {
                Wallet: 'wallet',
                QRPayment: 'payment',
              },
            },
          }}
        >
          <Stack.Navigator
            initialRouteName={
              isAuthenticated
                ? authService.isDriver()
                  ? 'DriverMain'
                  : 'Main'
                : 'Login'
            }
            screenOptions={{ headerShown: false }}
          >
            {/* Auth */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

            {/* Rider / Shared */}
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="RideBooking" component={RideBookingScreen} />
            <Stack.Screen name="RideTracking" component={RideTrackingScreen} />
            <Stack.Screen name="RiderMatching" component={RiderMatchingScreen} />
            <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
            <Stack.Screen name="QRPayment" component={QRPaymentScreen} />
            <Stack.Screen name="ProfileSwitch" component={ProfileSwitchScreen} />
            <Stack.Screen name="StudentVerification" component={StudentVerificationScreen} />
            <Stack.Screen name="DriverVerification" component={DriverVerificationScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

            {/* Driver */}
            <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
            <Stack.Screen name="DriverMain" component={DriverTabNavigator} />
            <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
            <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
            <Stack.Screen name="DriverRatings" component={DriverRatingsScreen} />
            <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
            <Stack.Screen name="SOSAlert" component={SOSAlertScreen} />
            <Stack.Screen name="DriverTest" component={DriverTestScreen} />
            <Stack.Screen name="CreateSharedRide" component={CreateSharedRideScreen} />
            <Stack.Screen name="VehicleManagement" component={VehicleManagementScreen} />
            <Stack.Screen name="DriverRideTracking" component={DriverRideTrackingScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

