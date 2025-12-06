import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors, gradients, radii, spacing, typography, shadows } from '../theme/designTokens';

const ModernButton = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'medium',
  icon,
  loading = false,
  disabled = false,
  style,
  ...props 
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'outline':
        return styles.outlineButton;
      case 'ghost':
        return styles.ghostButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'ghost':
        return styles.ghostText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'medium':
        return styles.mediumButton;
      case 'large':
        return styles.largeButton;
      default:
        return styles.mediumButton;
    }
  };

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        style={[styles.primaryWrapper, style]}
        {...props}
      >
        <LinearGradient
          colors={
            disabled
              ? ['rgba(148,163,184,0.4)', 'rgba(148,163,184,0.25)']
              : gradients.pillActive
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.gradientButton, getSizeStyle()]}
        >
          <View style={styles.buttonContent}>
            {loading && <Icon name="hourglass-empty" size={20} color="#fff" />}
            {icon && !loading && <Icon name={icon} size={20} color="#fff" />}
            <Text style={[getTextStyle(), icon && styles.textWithIcon]}>
              {loading ? 'Đang xử lý...' : title}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[getButtonStyle(), getSizeStyle(), disabled && styles.disabled, style]}
      {...props}
    >
      <View style={styles.buttonContent}>
        {loading && <Icon name="hourglass-empty" size={20} color={getTextStyle().color} />}
        {icon && !loading && <Icon name={icon} size={20} color={getTextStyle().color} />}
        <Text style={[getTextStyle(), icon && styles.textWithIcon]}>
          {loading ? 'Đang xử lý...' : title}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryWrapper: {
    alignSelf: 'stretch',
    borderRadius: radii.xl,
    overflow: 'hidden',
    ...shadows.floating,
  },
  secondaryButton: {
    backgroundColor: colors.glassLight,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: 'rgba(163,177,198,0.45)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ghostButton: {
    backgroundColor: 'transparent',
    borderRadius: radii.xl,
  },
  gradientButton: {
    borderRadius: radii.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  mediumButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  largeButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 56,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#fff',
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  outlineText: {
    color: colors.primary,
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  ghostText: {
    color: colors.primary,
    fontSize: typography.body,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ModernButton;
