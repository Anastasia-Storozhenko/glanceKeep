import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, RADIUS, FONT_SIZE } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

export const Button = ({ title, onPress, variant = 'primary', style }: ButtonProps) => {
  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.primaryShadow, style]}
      >
        <LinearGradient
          colors={[COLORS.ember, COLORS.emberDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryGradient}
        >
          <Text style={styles.primaryText}>{title}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.baseButton,
        variant === 'danger' ? styles.dangerOutline : styles.secondaryButton,
        style,
      ]}
    >
      <Text style={variant === 'danger' ? styles.dangerText : styles.secondaryText}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryShadow: {
    width: '100%',
    borderRadius: RADIUS.m,
    shadowColor: COLORS.ember,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryGradient: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.m,
  },
  primaryText: {
    color: COLORS.ink,
    fontFamily: FONTS.headline,
    fontSize: FONT_SIZE.body,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  baseButton: {
    width: '100%',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.m,
    borderWidth: 1.2,
  },
  dangerOutline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.danger,
  },
  dangerText: {
    color: COLORS.danger,
    fontFamily: FONTS.body,
    fontWeight: '600',
    fontSize: FONT_SIZE.body,
  },
  secondaryButton: {
    backgroundColor: COLORS.ink2,
    borderColor: COLORS.inkLine,
  },
  secondaryText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
  },
});
