import React from 'react';
import { View, StyleSheet, Pressable, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../theme/designTokens';

const iconMap = {
  Home: 'home',
  Wallet: 'account-balance-wallet',
  Messages: 'forum',
  History: 'history',
  Profile: 'person',
};

const SHOW_FAB = false;

const GlassTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();

  const handleFabPress = () => {
    const fabRoute = state.routes.find((r) => r.name === 'QRPayment');
    if (fabRoute) {
      navigation.navigate('QRPayment');
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 26),
        },
      ]}
    >
      <View style={styles.bar}>
        <BlurView intensity={40} tint="light" style={styles.barBackground}>
          <View style={styles.barStroke} />
        </BlurView>
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const isFabPlaceholder = SHOW_FAB && route.name === 'QRPayment';
            if (isFabPlaceholder) {
              return null;
            }

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

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ pressed }) => [
                  styles.tabButton,
                  isFocused && styles.tabButtonActive,
                  pressed && !isFocused && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.tabInner, isFocused && styles.tabInnerActive]}>
                  {isFocused ? (
                    <BlurView intensity={46} tint="light" style={styles.blurFill}>
                      <LinearGradient
                        colors={['rgba(255,255,255,0.7)', 'rgba(59,130,246,0.12)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.activeBackground}
                      >
                        <View style={styles.activeStroke} />
                      </LinearGradient>
                    </BlurView>
                  ) : (
                    <BlurView intensity={24} tint="light" style={styles.blurFill}>
                      <View style={styles.inactiveBackground} />
                    </BlurView>
                  )}
                  <Icon
                    name={iconMap[route.name] || 'circle'}
                    size={20}
                    color={isFocused ? colors.accent : colors.textSecondary}
                  />
                </View>
              </Pressable>
            );
          })}
          {SHOW_FAB && (
            <TouchableOpacity style={styles.fabButton} onPress={handleFabPress} activeOpacity={0.85}>
              <View style={styles.fabShadow} />
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.fabInner}
              >
                <Icon name="add" size={26} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -2,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  bar: {
    width: '92%',
    borderRadius: radii.xl,
    backgroundColor: 'transparent',
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  barBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  barStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
  },
  tabButtonActive: {
    shadowColor: 'rgba(59,130,246,0.28)',
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  tabInner: {
    minWidth: 54,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tabInnerActive: {
    borderRadius: 26,
  },
  blurFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
  },
  inactiveBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.55)',
    pointerEvents: 'none',
  },
  activeBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  activeStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    pointerEvents: 'none',
  },
  fabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 27,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(59,130,246,0.45)',
        shadowOpacity: 1,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 14 },
    }),
  },
  fabInner: {
    width: '92%',
    height: '92%',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GlassTabBar;
