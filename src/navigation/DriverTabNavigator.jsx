import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DriverHomeScreen from '../screens/driver/DriverHomeScreen.jsx';
import DriverRideHistoryScreen from '../screens/driver/DriverRideHistoryScreen.jsx';
import DriverRatingsScreen from '../screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen.jsx';

const Tab = createBottomTabNavigator();

const DriverTabNavigator = () => {
  const insets = useSafeAreaInsets();
  const extraBottomSpace = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);
  const baseHeight = Platform.OS === 'ios' ? 64 : 56;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'DriverHome') {
            iconName = 'home';
          } else if (route.name === 'DriverRideHistory') {
            iconName = 'history';
          } else if (route.name === 'Ratings') {
            iconName = 'star';
          } else if (route.name === 'DriverProfile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
        tabBarStyle: {
          height: baseHeight + extraBottomSpace,
          paddingBottom: extraBottomSpace,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
      })}
    >
      <Tab.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ tabBarLabel: 'Trang chủ' }}
      />
      <Tab.Screen
        name="DriverRideHistory"
        component={DriverRideHistoryScreen}
        options={{ tabBarLabel: 'Lịch sử' }}
      />
      <Tab.Screen
        name="Ratings"
        component={DriverRatingsScreen}
        options={{ tabBarLabel: 'Đánh giá' }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ tabBarLabel: 'Hồ sơ' }}
      />
    </Tab.Navigator>
  );
};

export default DriverTabNavigator;
