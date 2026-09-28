import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View, type PressableProps, type View as NativeView } from 'react-native';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../../theme';
import { Card, type CardProps } from '../Card';
import { Icon } from '../Icon';

type SharedStatCardProps = Omit<CardProps, 'accessibilityLabel' | 'children'> & {
  itemsKept: number;
  tokensUsed: number;
  planLabel?: string;
  requestsLabel?: string;
  tokensLabel?: string;
  itemsLabel?: string;
  accessibilityLabel?: string;
  onPress: NonNullable<PressableProps['onPress']>;
};

type FreeStatCardProps = SharedStatCardProps & {
  variant: 'free';
  requestsUsed: number;
  requestLimit: number;
  paidRequestsText?: never;
};

type PaidStatCardProps = SharedStatCardProps & {
  variant: 'paid';
  paidRequestsText?: string;
  requestsUsed?: never;
  requestLimit?: never;
};

export type StatCardProps = FreeStatCardProps | PaidStatCardProps;

function toNonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export const StatCard = forwardRef<NativeView, StatCardProps>(function StatCard(
  {
    accessibilityHint,
    accessibilityLabel,
    disabled = false,
    itemsKept,
    itemsLabel,
    onPress,
    paidRequestsText,
    planLabel,
    requestLimit: freeRequestLimit,
    requestsLabel,
    requestsUsed: freeRequestsUsed,
    style,
    tokensLabel,
    tokensUsed,
    variant,
    ...props
  },
  ref,
) {
  const { t } = useTranslation();
  const isFree = variant === 'free';
  const resolvedPlanLabel =
    planLabel ?? t(isFree ? 'components.statCard.free' : 'components.statCard.premium');
  const resolvedRequestsLabel = requestsLabel ?? t('components.statCard.requestsLeft');
  const resolvedTokensLabel = tokensLabel ?? t('components.statCard.tokensUsed');
  const resolvedItemsLabel = itemsLabel ?? t('components.statCard.itemsKept');
  const resolvedPaidRequestsText = paidRequestsText ?? t('components.statCard.unlimited');
  const resolvedTokensUsed = toNonNegativeInteger(tokensUsed);
  const resolvedItemsKept = toNonNegativeInteger(itemsKept);
  const requestsUsed = isFree ? toNonNegativeInteger(freeRequestsUsed ?? 0) : 0;
  const requestLimit = isFree ? toNonNegativeInteger(freeRequestLimit ?? 0) : 0;
  const requestsLeft = Math.max(requestLimit - requestsUsed, 0);
  const progress = requestLimit > 0 ? Math.min(requestsUsed / requestLimit, 1) : 0;
  const requestsValue = isFree ? String(requestsLeft) : resolvedPaidRequestsText;
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    `${resolvedPlanLabel}. ${requestsValue} ${resolvedRequestsLabel}. ${resolvedTokensUsed} ${resolvedTokensLabel}. ${resolvedItemsKept} ${resolvedItemsLabel}.`;

  return (
    <Card
      {...props}
      ref={ref}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={resolvedAccessibilityLabel}
      disabled={disabled}
      onPress={onPress}
      style={(state) => [
        styles.card,
        isFree ? styles.freeCard : styles.paidCard,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.planIcon, !isFree && styles.paidPlanIcon]}>
          <Icon
            color={isFree ? COLORS.textDim : COLORS.ink}
            name={isFree ? 'free' : 'premium'}
            size="small"
          />
        </View>

        <Text numberOfLines={1} style={[styles.planLabel, !isFree && styles.paidPlanLabel]}>
          {resolvedPlanLabel}
        </Text>

        <Icon color={isFree ? COLORS.textDim : COLORS.ember} name="chevron" size="small" />
      </View>

      <View style={styles.stats}>
        <Stat value={requestsValue} label={resolvedRequestsLabel} paid={!isFree} wide />
        <View style={styles.divider} />
        <Stat value={String(resolvedTokensUsed)} label={resolvedTokensLabel} paid={!isFree} />
        <View style={styles.divider} />
        <Stat value={String(resolvedItemsKept)} label={resolvedItemsLabel} paid={!isFree} />
      </View>

      {isFree && (
        <View
          accessibilityElementsHidden
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          style={styles.progressTrack}
        >
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </Card>
  );
});

type StatProps = {
  value: string;
  label: string;
  paid: boolean;
  wide?: boolean;
};

function Stat({ label, paid, value, wide = false }: StatProps) {
  return (
    <View style={[styles.stat, wide && styles.wideStat]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        numberOfLines={1}
        style={[styles.value, paid && styles.paidValue]}
      >
        {value}
      </Text>
      <Text numberOfLines={2} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: SPACING.m,
    minHeight: 156,
    overflow: 'hidden',
  },
  freeCard: {
    borderColor: COLORS.inkLine,
  },
  paidCard: {
    borderColor: COLORS.emberDeep,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.s,
  },
  planIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.ink,
    borderColor: COLORS.inkLine,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  paidPlanIcon: {
    backgroundColor: COLORS.ember,
    borderColor: COLORS.ember,
  },
  planLabel: {
    color: COLORS.text,
    flex: 1,
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZE.sub,
    lineHeight: 22,
  },
  paidPlanLabel: {
    color: COLORS.white,
  },
  stats: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    gap: SPACING.xs,
    minWidth: 0,
  },
  wideStat: {
    flex: 1.5,
  },
  divider: {
    backgroundColor: COLORS.inkLine,
    marginHorizontal: SPACING.s,
    width: StyleSheet.hairlineWidth,
  },
  value: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: 18,
    lineHeight: 24,
  },
  paidValue: {
    color: COLORS.ember,
  },
  label: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.label,
    lineHeight: 17,
  },
  progressTrack: {
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.full,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.full,
    height: '100%',
  },
});
