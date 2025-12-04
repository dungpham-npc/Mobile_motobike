import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/utils/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator, Platform, Linking } from 'react-native';
import { colors } from './src/theme/designTokens';
import authService from './src/services/authService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Authentication Screens
import LoginScreen from './src/screens/auth/LoginScreen.jsx';
import DriverLoginScreen from './src/screens/auth/DriverLoginScreen.jsx';
import RegisterScreen from './src/screens/auth/RegisterScreen.jsx';
import OTPVerificationScreen from './src/screens/auth/OTPVerificationScreen.jsx';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen.jsx';

// Rider Screens
import HomeScreen from './src/screens/main/HomeScreen.jsx';
import WalletScreen from './src/screens/main/WalletScreen.jsx';
import ProfileScreen from './src/screens/main/ProfileScreen.jsx';
import RideHistoryScreen from './src/screens/main/RideHistoryScreen.jsx';
import RideDetailsScreen from './src/screens/RideDetailsScreen.jsx';
import QRPaymentScreen from './src/screens/main/QRPaymentScreen.jsx';
import SwitchModeScreen from './src/screens/profile/SwitchModeScreen.jsx';
import AccountVerificationScreen from './src/screens/profile/AccountVerificationScreen.jsx';
import RideBookingScreen from './src/screens/ride/RideBookingScreen.jsx';
import RideTrackingScreen from './src/screens/ride/RideTrackingScreen.jsx';
import RiderMatchingScreen from './src/screens/ride/RiderMatchingScreen.jsx';
import BrowseRidesScreen from './src/screens/ride/BrowseRidesScreen.jsx';
import RideRatingScreen from './src/screens/ride/RideRatingScreen.jsx';
import NotificationsScreen from './src/screens/main/NotificationsScreen.jsx';

// Profile Screens
import EditProfileScreen from './src/screens/profile/EditProfileScreen.jsx';
import ChangePasswordScreen from './src/screens/profile/ChangePasswordScreen.jsx';

// Verification Screens
import StudentVerificationScreen from './src/screens/verification/StudentVerificationScreen.jsx';
import DriverVerificationScreen from './src/screens/verification/DriverVerificationScreen.jsx';

// Driver Screens
import DriverTestScreen from './src/screens/driver/DriverTestScreen.jsx';
import CreateSharedRideScreen from './src/screens/driver/CreateSharedRideScreen.jsx';
import VehicleManagementScreen from './src/screens/driver/VehicleManagementScreen.jsx';
import AddVehicleScreen from './src/screens/driver/AddVehicleScreen.jsx';
import EditVehicleScreen from './src/screens/driver/EditVehicleScreen.jsx';
import DriverRideTrackingScreen from './src/screens/driver/DriverRideTrackingScreen.jsx';
import DriverRideDetailsScreen from './src/screens/driver/DriverRideDetailsScreen.jsx';
import DriverRideHistoryScreen from './src/screens/driver/DriverRideHistoryScreen.jsx';
import DriverCompletionScreen from './src/screens/driver/DriverCompletionScreen.jsx';
import DriverDashboardScreen from './src/screens/driver/DriverDashboardScreen.jsx';
import DriverEarningsScreen from './src/screens/driver/DriverEarningsScreen.jsx';
import DriverRatingsScreen from './src/screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from './src/screens/driver/DriverProfileScreen.jsx';
import SOSAlertScreen from './src/screens/driver/SOSAlertScreen.jsx';

// Navigation & UI
import DriverTabNavigator from './src/navigation/DriverTabNavigator.jsx';
import CustomTabBar from './src/components/CustomTabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const DriverStack = createNativeStackNavigator();

function DriverMainStack() {
  return (
    <DriverStack.Navigator screenOptions={{ headerShown: false }}>
      <DriverStack.Screen name="DriverTabs" component={DriverTabNavigator} />
      <DriverStack.Screen name="DriverRideTracking" component={DriverRideTrackingScreen} />
      <DriverStack.Screen name="DriverRideDetails" component={DriverRideDetailsScreen} />
      <DriverStack.Screen name="DriverRideHistory" component={DriverRideHistoryScreen} />
      <DriverStack.Screen name="DriverCompletion" component={DriverCompletionScreen} />
      <DriverStack.Screen name="CreateSharedRide" component={CreateSharedRideScreen} />
      <DriverStack.Screen name="VehicleManagement" component={VehicleManagementScreen} />
      <DriverStack.Screen name="AddVehicle" component={AddVehicleScreen} />
      <DriverStack.Screen name="EditVehicle" component={EditVehicleScreen} />
      <DriverStack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
      <DriverStack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
      <DriverStack.Screen name="DriverRatings" component={DriverRatingsScreen} />
      <DriverStack.Screen name="DriverProfile" component={DriverProfileScreen} />

      <DriverStack.Screen name="SOSAlert" component={SOSAlertScreen} />
      <DriverStack.Screen name="DriverTest" component={DriverTestScreen} />
    </DriverStack.Navigator>
  );
}

// Wrapper component để thêm padding bottom cho các screen
const withTabBarPadding = (Component) => {
  return (props) => {
    return <Component {...props} />;
  };
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          insets={insets}
          iconMap={{
            Home: 'home',
            Wallet: 'account-balance-wallet',
            History: 'history',
            Profile: 'person',
          }}
        />
      )}
      sceneContainerStyle={{
        paddingBottom: 0,
        backgroundColor: 'transparent',
      }}
    >
      <Tab.Screen
        name="Home"
        component={withTabBarPadding(HomeScreen)}
        options={{ tabBarLabel: 'Trang chủ' }}
      />
      <Tab.Screen
        name="Wallet"
        component={withTabBarPadding(WalletScreen)}
        options={{ tabBarLabel: 'Ví tiền' }}
      />
      <Tab.Screen
        name="History"
        component={withTabBarPadding(RideHistoryScreen)}
        options={{ tabBarLabel: 'Lịch sử' }}
      />
      <Tab.Screen
        name="Profile"
        component={withTabBarPadding(ProfileScreen)}
        options={{ tabBarLabel: 'Hồ sơ' }}
      />
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
  }, []);

  // Handle PayOS deep links: mssus-iat-rs-app://wallet/topup/success|cancel
  useEffect(() => {
    const handleDeepLink = (eventOrUrl) => {
      const url = typeof eventOrUrl === 'string' ? eventOrUrl : eventOrUrl?.url;
      if (!url) return;

      try {
        if (url.includes('wallet/topup/success')) {
          // Điều hướng về tab Wallet, có thể truyền trạng thái nếu cần
          navigationRef.current?.navigate('Main', {
            screen: 'Wallet',
            params: { topupStatus: 'success' },
          });
        } else if (url.includes('wallet/topup/cancel')) {
          navigationRef.current?.navigate('Main', {
            screen: 'Wallet',
            params: { topupStatus: 'cancel' },
          });
        }
      } catch (e) {
        console.error('Deep link handling error:', e);
      }
    };

    // Xử lý URL khi app được mở từ trạng thái đóng (cold start)
    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handleDeepLink(initialUrl);
        }
      } catch (e) {
        console.error('Error getting initial URL:', e);
      }
    })();

    // Lắng nghe URL khi app đang mở
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription?.remove?.();
    };
  }, []);

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
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="Login"
            screenOptions={{ headerShown: false }}
          >
            {/* Auth */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

            {/* Rider / Shared */}
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="RideBooking" component={RideBookingScreen} />
            <Stack.Screen name="BrowseRides" component={BrowseRidesScreen} />
            <Stack.Screen name="RideTracking" component={RideTrackingScreen} />
            <Stack.Screen name="RiderMatching" component={RiderMatchingScreen} />
            <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
            <Stack.Screen name="RideRating" component={RideRatingScreen} />
            <Stack.Screen name="QRPayment" component={QRPaymentScreen} />
            <Stack.Screen name="SwitchMode" component={SwitchModeScreen} />
            <Stack.Screen name="AccountVerification" component={AccountVerificationScreen} />
            <Stack.Screen name="StudentVerification" component={StudentVerificationScreen} />
            <Stack.Screen name="DriverVerification" component={DriverVerificationScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />

            {/* Driver */}
            <Stack.Screen name="DriverMain" component={DriverMainStack} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}


