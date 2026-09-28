import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Globe, ChevronDown, Check, X } from 'lucide-react-native';
import { OnboardingCarousel, type OnboardingSteps } from '../components/OnboardingCarousel';
import { markOnboardingCompleted } from '../services/onboardingStorage';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../theme';
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
];

export const Onboarding = ({ navigation }: any) => {
  const { t, i18n } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isLangPickerOpen, setIsLangPickerOpen] = useState(false);

  const currentLangCode = i18n.language?.startsWith('uk') ? 'uk' : 'en';
  const currentLang =
    SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  const handleSelectLanguage = async (code: string) => {
    try {
      await i18n.changeLanguage(code);
    } catch (err) {
      console.warn('Failed to change language:', err);
    } finally {
      setIsLangPickerOpen(false);
    }
  };

  const finishOnboarding = async () => {
    try {
      await markOnboardingCompleted();
    } catch {
      // Storage failure must not trap the user in onboarding
    }
    navigation.replace('Home');
  };

  const steps: OnboardingSteps = [
    <OnboardingStep
      key="first"
      description={t('screens.onboarding.steps.first.description')}
      eyebrow={t('screens.onboarding.steps.first.eyebrow')}
      number="01"
      title={t('screens.onboarding.steps.first.title')}
    />,
    <OnboardingStep
      key="second"
      description={t('screens.onboarding.steps.second.description')}
      eyebrow={t('screens.onboarding.steps.second.eyebrow')}
      number="02"
      title={t('screens.onboarding.steps.second.title')}
    />,
    <OnboardingStep
      key="third"
      description={t('screens.onboarding.steps.third.description')}
      eyebrow={t('screens.onboarding.steps.third.eyebrow')}
      number="03"
      title={t('screens.onboarding.steps.third.title')}
    />,
  ];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <OnboardingCarousel
        completeLabel={t('screens.onboarding.getStarted')}
        nextLabel={t('screens.onboarding.next')}
        onComplete={() => void finishOnboarding()}
        onSkip={() => void finishOnboarding()}
        progressLabel={(currentStep, totalSteps) =>
          t('screens.onboarding.progress', { currentStep, totalSteps })
        }
        skipLabel={t('screens.onboarding.skip')}
        steps={steps}
        onStepChange={(stepIndex: number) => setCurrentStepIndex(stepIndex)}
        headerLeft={
          currentStepIndex === 0 ? (
            <TouchableOpacity
              style={styles.langPill}
              activeOpacity={0.7}
              onPress={() => setIsLangPickerOpen(true)}
              testID="language-switcher-pill"
            >
              <Globe color={COLORS.textDim} size={15} style={{ marginRight: 6 }} />
              <Text style={styles.langPillText}>{currentLang.nativeName}</Text>
              <ChevronDown color={COLORS.textDim} size={14} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          ) : null
        }
      />

      <Modal
        visible={isLangPickerOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsLangPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsLangPickerOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderTitleRow}>
                <Globe color={COLORS.ember} size={18} style={{ marginRight: 8 }} />
                <Text style={styles.sheetTitle}>{t('common.language')}</Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setIsLangPickerOpen(false)}
                hitSlop={8}
              >
                <X color={COLORS.textDim} size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.languagesList}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = currentLang.code === lang.code;

                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[styles.langOptionItem, isSelected && styles.langOptionItemSelected]}
                    activeOpacity={0.7}
                    onPress={() => void handleSelectLanguage(lang.code)}
                  >
                    <View>
                      <Text
                        style={[
                          styles.langOptionTitle,
                          isSelected && styles.langOptionTitleSelected,
                        ]}
                      >
                        {lang.nativeName}
                      </Text>
                      <Text style={styles.langOptionSub}>{t(`common.languages.${lang.code}`)}</Text>
                    </View>

                    {isSelected && (
                      <View style={styles.checkCircle}>
                        <Check color={COLORS.ink} size={14} strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

type OnboardingStepProps = {
  description: string;
  eyebrow: string;
  number: string;
  title: string;
};

function OnboardingStep({ description, eyebrow, number, title }: OnboardingStepProps) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepNumber}>{number}</Text>
      <Text style={styles.stepEyebrow}>{eyebrow}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.ink,
    flex: 1,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  langPillText: {
    color: COLORS.white,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  stepContent: {
    alignItems: 'center',
    maxWidth: 340,
  },
  stepNumber: {
    color: COLORS.ember,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.caption,
    letterSpacing: 2,
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  stepEyebrow: {
    color: COLORS.ember,
    fontFamily: FONTS.bodySemiBold,
    fontSize: FONT_SIZE.label,
    letterSpacing: 1.5,
    lineHeight: 18,
    marginBottom: SPACING.s,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  stepTitle: {
    color: COLORS.text,
    fontFamily: FONTS.headline,
    fontSize: FONT_SIZE.headline,
    lineHeight: 38,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  stepDescription: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.sub,
    lineHeight: 23,
    maxWidth: 320,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0c0f17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  sheetHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    color: COLORS.white,
    fontFamily: FONTS.headline,
    fontSize: 18,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languagesList: {
    gap: 10,
  },
  langOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.m,
    paddingVertical: 14,
  },
  langOptionItemSelected: {
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
    borderColor: 'rgba(0, 240, 255, 0.35)',
  },
  langOptionTitle: {
    color: COLORS.white,
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
  },
  langOptionTitleSelected: {
    color: COLORS.ember,
  },
  langOptionSub: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.ember,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
