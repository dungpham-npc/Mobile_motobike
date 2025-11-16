import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DriverHomeScreen from '../screens/driver/DriverHomeScreen.jsx';
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen.jsx';
import DriverRatingsScreen from '../screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen.jsx';

const Tab = createBottomTabNavigator();

const DriverTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'DriverHome') {
            iconName = 'home';
          } else if (route.name === 'Earnings') {
            iconName = 'attach-money';
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
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
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
        name="Earnings" 
        component={DriverEarningsScreen}
        options={{ tabBarLabel: 'Thu nhập' }}
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