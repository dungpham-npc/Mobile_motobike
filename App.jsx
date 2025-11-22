import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import authService from './src/services/authService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/auth/LoginScreen.jsx';
import RegisterScreen from './src/screens/auth/RegisterScreen.jsx';
import OTPVerificationScreen from './src/screens/auth/OTPVerificationScreen.jsx';
import ResetPasswordScreen from './src/screens/auth/ResetPasswordScreen.jsx';
import HomeScreen from './src/screens/main/HomeScreen.jsx';
import ProfileScreen from './src/screens/main/ProfileScreen.jsx';
import WalletScreen from './src/screens/main/WalletScreen.jsx';
import RideHistoryScreen from './src/screens/main/RideHistoryScreen.jsx';
import RideDetailsScreen from './src/screens/RideDetailsScreen.jsx';
import QRPaymentScreen from './src/screens/main/QRPaymentScreen.jsx';
import ProfileSwitchScreen from './src/screens/main/ProfileSwitchScreen.jsx';
import AccountVerificationScreen from './src/screens/main/AccountVerificationScreen.jsx';

// Verification Screens
import StudentVerificationScreen from './src/screens/verification/StudentVerificationScreen.jsx';
import DriverVerificationScreen from './src/screens/verification/DriverVerificationScreen.jsx';

// Profile Screens
import EditProfileScreen from './src/screens/profile/EditProfileScreen.jsx';
import ChangePasswordScreen from './src/screens/profile/ChangePasswordScreen.jsx';
// import ResetPasswordScreen from './src/screens/profile/ResetPasswordScreen.jsx';

// Ride Screens
import RideBookingScreen from './src/screens/ride/RideBookingScreen.jsx';
import RiderMatchingScreen from './src/screens/ride/RiderMatchingScreen.jsx';
import RideTrackingScreen from './src/screens/ride/RideTrackingScreen.jsx';
import RatingScreen from './src/screens/ride/RatingScreen.jsx';
import AvailableRidesScreen from './src/screens/ride/AvailableRidesScreen.jsx';

// Driver Screens
import DriverHomeScreen from './src/screens/driver/DriverHomeScreen.jsx';
import DriverDashboardScreen from './src/screens/driver/DriverDashboardScreen.jsx';
import DriverEarningsScreen from './src/screens/driver/DriverEarningsScreen.jsx';
import DriverRatingsScreen from './src/screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from './src/screens/driver/DriverProfileScreen.jsx';
import DriverRideTrackingScreen from './src/screens/driver/DriverRideTrackingScreen.jsx';
import CreateSharedRideScreen from './src/screens/driver/CreateSharedRideScreen.jsx';
import VehicleManagementScreen from './src/screens/driver/VehicleManagementScreen.jsx';
import SOSAlertScreen from './src/screens/driver/SOSAlertScreen.jsx';
import AvailableRequestsScreen from './src/screens/driver/AvailableRequestsScreen.jsx';

// Navigation & UI
import DriverTabNavigator from './src/navigation/DriverTabNavigator.jsx';
import GlassTabBar from './src/components/ui/GlassTabBar.jsx';

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
      <DriverStack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
      <DriverStack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
      <DriverStack.Screen name="DriverRatings" component={DriverRatingsScreen} />
      <DriverStack.Screen name="DriverProfile" component={DriverProfileScreen} />

      <DriverStack.Screen name="SOSAlert" component={SOSAlertScreen} />
      <DriverStack.Screen name="DriverTest" component={DriverTestScreen} />
    </DriverStack.Navigator>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8);
  const tabBarOffset = 52;

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
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Wallet') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
      tabBar={(props) => <GlassTabBar {...props} />}
      sceneContainerStyle={{
        paddingBottom: tabBarOffset + bottomSafe,
        backgroundColor: 'transparent',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="History" component={RideHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeApp();
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

  if (isLoading) {
    return (
      <PaperProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isAuthenticated ? (authService.isDriver() ? "DriverMain" : "Main") : "Login"}>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="OTPVerification" 
                component={OTPVerificationScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="ResetPassword" 
                component={ResetPasswordScreen} 
                options={{ headerShown: false }}
              />
          <Stack.Screen 
            name="Main" 
            component={MainTabs} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RideDetails" 
            component={RideDetailsScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverHome" 
            component={DriverHomeScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverMain" 
            component={DriverTabNavigator} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverDashboard" 
            component={DriverDashboardScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverEarnings" 
            component={DriverEarningsScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverRatings" 
            component={DriverRatingsScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverProfile" 
            component={DriverProfileScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="SOSAlert" 
            component={SOSAlertScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="QRPayment" 
            component={QRPaymentScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ProfileSwitch" 
            component={ProfileSwitchScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AccountVerification" 
            component={AccountVerificationScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="StudentVerification" 
            component={StudentVerificationScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverVerification" 
            component={DriverVerificationScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="EditProfile" 
            component={EditProfileScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ChangePassword" 
            component={ChangePasswordScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RideBooking" 
            component={RideBookingScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RiderMatching" 
            component={RiderMatchingScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RideTracking" 
            component={RideTrackingScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="RatingScreen" 
            component={RatingScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AvailableRides" 
            component={AvailableRidesScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DriverRideTracking" 
            component={DriverRideTrackingScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="CreateSharedRide" 
            component={CreateSharedRideScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="VehicleManagement" 
            component={VehicleManagementScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="AvailableRequests" 
            component={AvailableRequestsScreen} 
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
