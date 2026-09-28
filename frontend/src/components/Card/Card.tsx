import React, { forwardRef } from 'react';
import { Platform, Pressable, StyleSheet, type PressableProps, type View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../theme';

export type CardProps = Omit<PressableProps, 'children'> & {
  children: NonNullable<PressableProps['children']>;
};

export const Card = forwardRef<View, CardProps>(function Card(
  { accessibilityRole, accessibilityState, children, disabled = false, onPress, style, ...props },
  ref,
) {
  const isInteractive = typeof onPress === 'function';
  const isDisabled = disabled === true;

  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityRole={isInteractive ? (accessibilityRole ?? 'button') : accessibilityRole}
      accessibilityState={
        isInteractive ? { ...accessibilityState, disabled: isDisabled } : accessibilityState
      }
      disabled={isInteractive ? isDisabled : undefined}
      onPress={onPress}
      style={(state) => [
        styles.card,
        isInteractive && state.pressed && styles.pressed,
        isInteractive && isDisabled && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.ink2,
    borderColor: COLORS.inkLine,
    borderRadius: RADIUS.m,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SPACING.m,
    ...Platform.select({
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: `0 8px 24px ${COLORS.inkLine}`,
      },
    }),
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
