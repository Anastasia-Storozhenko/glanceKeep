import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../theme';

type Props = {
  icon: React.ReactNode;
  titleKey: string;
  explanationKey: string;
  canAskAgain: boolean;
  onPrimaryPress: () => void;
  onClose: () => void;
};

export function PermissionDeniedScreen({
  icon,
  titleKey,
  explanationKey,
  canAskAgain,
  onPrimaryPress,
  onClose,
}: Props) {
  const { t } = useTranslation();

  const actionLabel = canAskAgain
    ? t('common.permissionDenied.grantAccess')
    : t('common.permissionDenied.openSettings');

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        hitSlop={12}
      >
        <X color={COLORS.white} size={22} />
      </TouchableOpacity>

      <Text accessibilityRole="header" style={styles.title}>
        {t(titleKey)}
      </Text>

      <View style={styles.instructionBox}>
        <View style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.explanationText}>{t(explanationKey)}</Text>
        </View>
      </View>

      <View style={styles.actionGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onPrimaryPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          {icon}
        </TouchableOpacity>

        <Text style={styles.actionLabel}>{actionLabel}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.full,
    height: 48,
    justifyContent: 'center',
    left: SPACING.l,
    position: 'absolute',
    top: SPACING.xxl,
    width: 48,
    zIndex: 10,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.headline,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
  },
  instructionBox: {
    width: '100%',
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5D6AD2',
    marginTop: 6,
    marginRight: 12,
  },
  explanationText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
    flex: 1,
    lineHeight: 20,
  },
  actionGroup: {
    alignItems: 'center',
    gap: SPACING.m,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
    elevation: 8,
    height: 76,
    justifyContent: 'center',
    shadowColor: COLORS.ember,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    width: 76,
  },
  actionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
    textAlign: 'center',
  },
});
