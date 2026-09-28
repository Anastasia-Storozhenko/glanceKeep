import Feather from '@expo/vector-icons/Feather';
import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { COLORS } from '../../theme';

const ICON_GLYPHS = {
  camera: 'camera',
  mic: 'mic',
  search: 'search',
  stop: 'square',
  pin: 'map-pin',
  tag: 'tag',
  check: 'check',
  x: 'x',
  settings: 'settings',
  free: 'circle',
  premium: 'star',
} as const;

export const ICON_SIZES = {
  small: 16,
  medium: 20,
  large: 24,
} as const;

export type IconName = keyof typeof ICON_GLYPHS | 'chevron';
export type IconSize = keyof typeof ICON_SIZES | number;
export type ChevronDirection = 'up' | 'right' | 'down' | 'left';

export type IconProps = {
  name: IconName;
  size?: IconSize;
  color?: string;
  chevronDirection?: ChevronDirection;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

function getGlyph(name: IconName, chevronDirection: ChevronDirection) {
  return name === 'chevron' ? (`chevron-${chevronDirection}` as const) : ICON_GLYPHS[name];
}

export function Icon({
  accessibilityLabel,
  chevronDirection = 'right',
  color = COLORS.text,
  name,
  size = 'medium',
  style,
  testID,
}: IconProps) {
  const resolvedSize = typeof size === 'number' ? size : ICON_SIZES[size];
  const isAccessible = accessibilityLabel !== undefined;

  return (
    <Feather
      accessibilityElementsHidden={!isAccessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={isAccessible ? 'image' : undefined}
      accessible={isAccessible}
      aria-hidden={!isAccessible}
      color={color}
      importantForAccessibility={isAccessible ? 'auto' : 'no-hide-descendants'}
      name={getGlyph(name, chevronDirection)}
      size={resolvedSize}
      style={style}
      testID={testID}
    />
  );
}
