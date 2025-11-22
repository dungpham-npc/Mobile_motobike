import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './src/utils/navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
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
import ProfileScreen from './src/screens/main/ProfileScreen.jsx';
import WalletScreen from './src/screens/main/WalletScreen.jsx';
import RideHistoryScreen from './src/screens/main/RideHistoryScreen.jsx';
import RideDetailsScreen from './src/screens/RideDetailsScreen.jsx';
import QRPaymentScreen from './src/screens/main/QRPaymentScreen.jsx';
import ProfileSwitchScreen from './src/screens/main/ProfileSwitchScreen.jsx';
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

// Custom Tab Bar Component để kiểm soát chính xác background
const CustomTabBar = ({ state, descriptors, navigation, insets }) => {
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);
  const baseHeight = Platform.OS === 'ios' ? 64 : 56;
  const bottomOffset = 16;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: bottomOffset + bottomSafe,
        left: '50%',
        marginLeft: -120, // Giảm chiều dài menu bar (từ full width xuống ~240px)
        width: 240,
        height: baseHeight,
        borderRadius: 24,
        backgroundColor: 'transparent',
        // Shadow depth (neumorphism style - giống CleanCard) - đặt ở View ngoài để shadow hiển thị
        shadowColor: 'rgba(163, 177, 198, 0.65)',
        shadowOpacity: 0.32,
        shadowRadius: 18,
        shadowOffset: { width: 8, height: 10 },
        ...Platform.select({
          android: {
            elevation: 6,
          },
        }),
      }}
    >
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        <BlurView
          intensity={80}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        >
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              borderRadius: 24,
            }}
          />
        </BlurView>
      </View>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-around',
          paddingHorizontal: 12, // Giảm padding để icon gần nhau hơn
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName = 'home';
          if (route.name === 'Wallet') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8, // Giảm khoảng cách giữa các icon
              }}
              activeOpacity={0.7}
            >
              <Icon
                name={iconName}
                size={24}
                color={isFocused ? '#FFFFFF' : '#9CA3AF'}
              />
              {isFocused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#FFFFFF',
                    marginTop: 4,
                  }}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Wrapper component để thêm padding bottom cho các screen
const withTabBarPadding = (Component) => {
  return (props) => {
    return <Component {...props} />;
  };
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);
  const baseHeight = Platform.OS === 'ios' ? 64 : 56;
  const bottomOffset = 16; // Khoảng cách từ đáy màn hình

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
      tabBar={(props) => <CustomTabBar {...props} insets={insets} />}
      sceneContainerStyle={{
        paddingBottom: 0,
        backgroundColor: 'transparent',
      }}
    >
      <Tab.Screen name="Home" component={withTabBarPadding(HomeScreen)} />
      <Tab.Screen name="Wallet" component={withTabBarPadding(WalletScreen)} />
      <Tab.Screen name="History" component={withTabBarPadding(RideHistoryScreen)} />
      <Tab.Screen name="Profile" component={withTabBarPadding(ProfileScreen)} />
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
            <Stack.Screen name="ProfileSwitch" component={ProfileSwitchScreen} />
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


