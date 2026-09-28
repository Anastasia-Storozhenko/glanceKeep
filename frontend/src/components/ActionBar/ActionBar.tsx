import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewProps,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, GLOW, RADIUS, SPACING } from '../../theme';
import { Icon, type IconName } from '../Icon';

type ActionKey = 'search' | 'voice' | 'photo';

type ActionButtonProps = {
  action: ActionKey;
  disabled: boolean;
  icon: IconName;
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  primary?: boolean;
  testID?: string;
};

export type ActionBarProps = Omit<ViewProps, 'children'> & {
  onSearchPress: NonNullable<PressableProps['onPress']>;
  onVoicePress: NonNullable<PressableProps['onPress']>;
  onPhotoPress: NonNullable<PressableProps['onPress']>;
  searchLabel?: string;
  voiceLabel?: string;
  photoLabel?: string;
  disabled?: boolean;
  searchDisabled?: boolean;
  voiceDisabled?: boolean;
  photoDisabled?: boolean;
};

function ActionButton({
  action,
  disabled,
  icon,
  label,
  onPress,
  primary = false,
  testID,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={SPACING.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        pressed && styles.pressedAction,
        disabled && styles.disabledAction,
      ]}
      testID={testID ? `${testID}-${action}` : undefined}
    >
      <View style={[styles.iconContainer, primary && styles.primaryIconContainer]}>
        <Icon
          color={primary ? COLORS.ink : COLORS.textDim}
          name={icon}
          size={primary ? 28 : 'large'}
        />
      </View>
      <Text
        allowFontScaling
        numberOfLines={1}
        style={[styles.label, primary && styles.primaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const ActionBar = forwardRef<View, ActionBarProps>(function ActionBar(
  {
    disabled = false,
    onPhotoPress,
    onSearchPress,
    onVoicePress,
    photoDisabled = false,
    photoLabel,
    searchDisabled = false,
    searchLabel,
    style,
    testID,
    voiceDisabled = false,
    voiceLabel,
    ...props
  },
  ref,
) {
  const { t } = useTranslation();
  const resolvedSearchLabel = searchLabel ?? t('components.actionBar.search');
  const resolvedVoiceLabel = voiceLabel ?? t('components.actionBar.voice');
  const resolvedPhotoLabel = photoLabel ?? t('components.actionBar.photo');

  return (
    <View {...props} ref={ref} style={[styles.container, style]} testID={testID}>
      <ActionButton
        action="search"
        disabled={disabled || searchDisabled}
        icon="search"
        label={resolvedSearchLabel}
        onPress={onSearchPress}
        testID={testID}
      />
      <ActionButton
        action="voice"
        disabled={disabled || voiceDisabled}
        icon="mic"
        label={resolvedVoiceLabel}
        onPress={onVoicePress}
        testID={testID}
      />
      <ActionButton
        action="photo"
        disabled={disabled || photoDisabled}
        icon="camera"
        label={resolvedPhotoLabel}
        onPress={onPhotoPress}
        primary
        testID={testID}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.ink2,
    borderTopColor: COLORS.inkLine,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingBottom: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
  },
  action: {
    alignItems: 'center',
    flex: 1,
    gap: SPACING.xs,
    justifyContent: 'flex-end',
    minHeight: 68,
    minWidth: 0,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  pressedAction: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  disabledAction: {
    opacity: 0.4,
  },
  iconContainer: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  primaryIconContainer: {
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
    height: 52,
    shadowColor: COLORS.ember,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    width: 52,
    elevation: 8,
  },
  label: {
    color: COLORS.textDim,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.label,
    lineHeight: 18,
    maxWidth: '100%',
  },
  primaryLabel: {
    color: COLORS.ember,
    textShadowColor: GLOW.secondary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
});
