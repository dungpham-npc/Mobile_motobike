import React from 'react';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Platform, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DriverHomeScreen from '../screens/driver/DriverHomeScreen.jsx';
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen.jsx';
import DriverRideHistoryScreen from '../screens/driver/DriverRideHistoryScreen.jsx';
import DriverRatingsScreen from '../screens/driver/DriverRatingsScreen.jsx';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen.jsx';

const Tab = createBottomTabNavigator();

// Custom Tab Bar Component giống như rider
const CustomDriverTabBar = ({ state, descriptors, navigation, insets }) => {
  const bottomSafe = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 6);
  const baseHeight = Platform.OS === 'ios' ? 64 : 56;
  const bottomOffset = 16;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: bottomOffset + bottomSafe,
        left: '50%',
        marginLeft: -120,
        width: 240,
        height: baseHeight,
        borderRadius: 24,
        backgroundColor: 'transparent',
        // Shadow depth (neumorphism style - giống CleanCard)
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
          // Shadow soft (neumorphism style - giống CleanCard)
          shadowColor: '#FFFFFF',
          shadowOpacity: 0.75,
          shadowRadius: 16,
          shadowOffset: { width: -5, height: -5 },
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
          paddingHorizontal: 12,
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
          if (route.name === 'Earnings') {
            iconName = 'attach-money';
          } else if (route.name === 'DriverHistory') {
            iconName = 'history';
          } else if (route.name === 'DriverProfile') {
            iconName = 'person';
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 8,
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

// Wrapper component - không cần thêm padding vì các screen đã tự xử lý trong scrollContent
const withDriverTabBarPadding = (Component) => {
  return (props) => {
    return <Component {...props} />;
  };
};

const DriverTabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomDriverTabBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Tab.Screen
        name="DriverHome"
        component={withDriverTabBarPadding(DriverHomeScreen)}
        options={{ tabBarLabel: 'Trang chủ' }}
      />
      <Tab.Screen
        name="Earnings"
        component={withDriverTabBarPadding(DriverEarningsScreen)}
        options={{ tabBarLabel: 'Thu nhập' }}
      />
      <Tab.Screen
        name="DriverHistory"
        component={withDriverTabBarPadding(DriverRideHistoryScreen)}
        options={{ tabBarLabel: 'Lịch sử' }}
      />
      <Tab.Screen
        name="DriverProfile"
        component={withDriverTabBarPadding(DriverProfileScreen)}
        options={{ tabBarLabel: 'Hồ sơ' }}
      />
    </Tab.Navigator>
  );
};

export default DriverTabNavigator;
