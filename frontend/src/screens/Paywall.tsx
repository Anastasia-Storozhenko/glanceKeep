import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const colors = {
  background: '#050608',
  surface: '#0B0F14',
  surfaceSelected: 'rgba(45, 212, 224, 0.04)',
  border: '#161D26',
  borderSelected: '#2DD4E0',
  accent: '#2DD4E0',
  textPrimary: '#F1F5F9',
  textSecondary: '#8592A3',
  closeBg: '#121820',
  badgeBg: '#2DD4E0',
  badgeText: '#050608',
  checkCircleBg: 'rgba(45, 212, 224, 0.12)',
};

type PlanId = 'yearly' | 'monthly';
type PaywallReason = 'limit_reached' | 'manual';

interface PaywallProps {
  navigation: any;
  route?: { params?: { reason?: PaywallReason } };
}

interface PlanConfig {
  id: PlanId;
  nameKey: string;
  priceKey: string;
  subtextKey: string;
  badgeKey?: string;
}

const PLAN_CONFIG: PlanConfig[] = [
  {
    id: 'yearly',
    nameKey: 'screens.paywall.plans.yearly.name',
    priceKey: 'screens.paywall.plans.yearly.price',
    subtextKey: 'screens.paywall.plans.yearly.subtext',
    badgeKey: 'screens.paywall.plans.yearly.badge',
  },
  {
    id: 'monthly',
    nameKey: 'screens.paywall.plans.monthly.name',
    priceKey: 'screens.paywall.plans.monthly.price',
    subtextKey: 'screens.paywall.plans.monthly.subtext',
  },
];

export const Paywall: React.FC<PaywallProps> = ({ navigation, route }) => {
  const { t } = useTranslation();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  const reason: PaywallReason = route?.params?.reason ?? 'limit_reached';

  const handleClose = () => {
    navigation.goBack();
  };

  const handleContinue = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert(t('screens.paywall.successTitle'), t('screens.paywall.subscribeSuccess'), [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    }, 600);
  };

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    // eslint-disable-next-line no-undef
    setTimeout(() => {
      setIsRestoring(false);
      Alert.alert(t('screens.paywall.restoreTitle'), t('screens.paywall.restoreSuccess'));
    }, 600);
  };

  const benefits = t('screens.paywall.benefits', { returnObjects: true }) as string[];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View>
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.mainContent}>
            <Text style={styles.title}>{t(`screens.paywall.reasons.${reason}.title`)}</Text>

            <Text style={styles.subtitle}>{t(`screens.paywall.reasons.${reason}.subtitle`)}</Text>

            <View style={styles.benefitsList}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <View style={styles.plansContainer} accessibilityRole="radiogroup">
              {PLAN_CONFIG.map((plan) => {
                const isSelected = selectedPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlan(plan.id)}
                    style={({ pressed }) => [
                      styles.planCard,
                      isSelected ? styles.planCardSelected : styles.planCardDefault,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.planInfo}>
                      <View style={styles.planTitleRow}>
                        <Text style={styles.planName}>{t(plan.nameKey)}</Text>
                        {plan.badgeKey && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{t(plan.badgeKey)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.planSubtext}>{t(plan.subtextKey)}</Text>
                    </View>
                    <Text style={styles.planPrice}>{t(plan.priceKey)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              (pressed || isProcessing) && styles.pressed,
            ]}
            onPress={handleContinue}
            disabled={isProcessing}
            accessibilityRole="button"
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.continueButtonText}>{t('screens.paywall.continue')}</Text>
            )}
          </Pressable>

          <View style={styles.footerLinks}>
            <Text style={styles.footerSecondaryText}>{t('screens.paywall.footerCancel')} </Text>
            <Pressable
              onPress={handleRestore}
              hitSlop={10}
              disabled={isRestoring}
              accessibilityRole="link"
            >
              <Text style={styles.restoreLink}>
                {isRestoring ? t('screens.paywall.restoring') : t('screens.paywall.restore')}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) + 4 : 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 52 : 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'flex-end',
    paddingTop: 4,
    paddingBottom: 4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#8A99AD',
    fontSize: 13,
    fontWeight: '700',
  },
  mainContent: {
    marginTop: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13.5,
    lineHeight: 19,
    marginTop: 8,
  },
  benefitsList: {
    marginTop: 14,
    gap: 10,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.checkCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  benefitText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
  plansContainer: {
    marginTop: 16,
    gap: 10,
  },
  planCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  planCardDefault: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  planCardSelected: {
    borderWidth: 1.5,
    borderColor: colors.borderSelected,
    backgroundColor: colors.surfaceSelected,
  },
  planInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: colors.badgeBg,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  badgeText: {
    color: colors.badgeText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  planSubtext: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  planPrice: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 10,
  },
  footer: {
    marginTop: 16,
    paddingTop: 4,
  },
  continueButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: colors.background,
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  footerSecondaryText: {
    color: colors.textSecondary,
    fontSize: 12.5,
  },
  restoreLink: {
    color: colors.textSecondary,
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
  },
});
