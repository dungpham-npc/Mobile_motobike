import { Platform, StyleSheet } from 'react-native';
import { colors } from '../theme/designTokens';

/**
 * Neumorphism shadow styles giống CleanCard
 * Sử dụng cho tất cả các card components để có shadow nhất quán
 */
export const neumorphismShadow = {
  // Shadow soft (lớp ngoài)
  shadowSoft: {
    backgroundColor: colors.background,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.75,
    shadowRadius: 16,
    shadowOffset: { width: -5, height: -5 },
  },
  // Shadow depth (lớp trong)
  shadowDepth: {
    backgroundColor: colors.background,
    shadowColor: 'rgba(163, 177, 198, 0.65)',
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 8, height: 10 },
    overflow: 'hidden',
    ...Platform.select({
      android: {
        elevation: 6,
      },
    }),
  },
};

/**
 * Helper function để tạo card container style với neumorphism shadow
 */
export const createCardContainerStyle = (borderRadius = 16, additionalStyles = {}) => ({
  ...neumorphismShadow.shadowSoft,
  borderRadius,
  ...additionalStyles,
});

/**
 * Helper function để tạo card inner style với neumorphism shadow
 */
export const createCardInnerStyle = (borderRadius = 16, additionalStyles = {}) => ({
  ...neumorphismShadow.shadowDepth,
  borderRadius,
  ...additionalStyles,
});


