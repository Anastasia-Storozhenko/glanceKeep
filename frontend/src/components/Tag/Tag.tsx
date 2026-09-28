import React, { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type View,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../../theme';

type SharedTagProps = Omit<PressableProps, 'children' | 'onPress'> & {
  label: string;
  textStyle?: StyleProp<TextStyle>;
};

type StaticTagProps = SharedTagProps & {
  variant?: 'static';
  onPress?: never;
  selected?: never;
};

type SelectableTagProps = SharedTagProps & {
  variant: 'selectable';
  onPress: NonNullable<PressableProps['onPress']>;
  selected: boolean;
};

export type TagProps = StaticTagProps | SelectableTagProps;

export const Tag = forwardRef<View, TagProps>(function Tag(
  {
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    disabled = false,
    hitSlop,
    label,
    onPress,
    selected,
    style,
    textStyle,
    variant = 'static',
    ...props
  },
  ref,
) {
  const isSelectable = variant === 'selectable';
  const isDisabled = disabled === true;
  const isSelected = isSelectable && selected === true;

  return (
    <Pressable
      {...props}
      ref={ref}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={isSelectable ? (accessibilityRole ?? 'button') : accessibilityRole}
      accessibilityState={
        isSelectable
          ? { ...accessibilityState, disabled: isDisabled, selected: isSelected }
          : accessibilityState
      }
      disabled={isSelectable ? isDisabled : undefined}
      hitSlop={isSelectable ? (hitSlop ?? SPACING.s) : hitSlop}
      onPress={isSelectable ? onPress : undefined}
      style={(state) => [
        styles.tag,
        isSelected && styles.selectedTag,
        isSelectable && state.pressed && styles.pressedTag,
        isSelectable && isDisabled && styles.disabledTag,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        style={[styles.label, isSelected && styles.selectedLabel, textStyle]}
      >
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tag: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.ink2,
    borderColor: COLORS.inkLine,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: '100%',
    minHeight: 28,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  selectedTag: {
    backgroundColor: COLORS.ember,
    borderColor: COLORS.ember,
  },
  pressedTag: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  disabledTag: {
    opacity: 0.45,
  },
  label: {
    color: COLORS.textDim,
    flexShrink: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.caption,
    lineHeight: 18,
  },
  selectedLabel: {
    color: COLORS.ink,
  },
});
