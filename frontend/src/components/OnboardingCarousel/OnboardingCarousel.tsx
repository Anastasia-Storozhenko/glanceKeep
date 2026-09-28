import React, { useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import { COLORS, FONTS, FONT_SIZE, SPACING } from '../../theme';
import { Button } from '../Button';

const STEP_COUNT = 3;

export type OnboardingSteps = readonly [ReactNode, ReactNode, ReactNode];

export type OnboardingCarouselProps = Omit<
  ScrollViewProps,
  | 'children'
  | 'contentContainerStyle'
  | 'horizontal'
  | 'onMomentumScrollEnd'
  | 'onScroll'
  | 'pagingEnabled'
  | 'ref'
> & {
  steps: OnboardingSteps;
  skipLabel: string;
  nextLabel: string;
  completeLabel: string;
  // eslint-disable-next-line no-unused-vars
  progressLabel: (currentStep: number, totalSteps: number) => string;
  onSkip: () => void;
  onComplete: () => void;
  // eslint-disable-next-line no-unused-vars
  onStepChange?: (stepIndex: number) => void;
  headerLeft?: ReactNode;
};

export function OnboardingCarousel({
  completeLabel,
  headerLeft,
  nextLabel,
  onComplete,
  onSkip,
  onStepChange,
  progressLabel,
  skipLabel,
  steps,
  style,
  ...scrollViewProps
}: OnboardingCarouselProps) {
  const { width } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollX] = useState(() => new Animated.Value(0));
  const [activeStep, setActiveStep] = useState(0);
  const isLastStep = activeStep === STEP_COUNT - 1;

  const updateActiveStep = (nextStep: number) => {
    if (nextStep === activeStep) {
      return;
    }

    setActiveStep(nextStep);
    onStepChange?.(nextStep);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextStep = Math.max(
      0,
      Math.min(STEP_COUNT - 1, Math.round(event.nativeEvent.contentOffset.x / width)),
    );

    updateActiveStep(nextStep);
  };

  const handlePrimaryAction = () => {
    if (isLastStep) {
      onComplete();
      return;
    }

    const nextStep = activeStep + 1;
    scrollViewRef.current?.scrollTo({ animated: true, x: nextStep * width, y: 0 });
    updateActiveStep(nextStep);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeftContainer}>{headerLeft}</View>
        {isLastStep ? (
          <View style={styles.skipButton} />
        ) : (
          <Pressable
            accessibilityRole="button"
            hitSlop={SPACING.s}
            onPress={onSkip}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={styles.skipLabel}>{skipLabel}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        {...scrollViewProps}
        ref={scrollViewRef}
        alwaysBounceHorizontal={false}
        bounces={false}
        decelerationRate="fast"
        disableIntervalMomentum
        horizontal
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={[styles.carousel, style]}
      >
        {steps.map((step, index) => (
          <View key={index} style={[styles.step, { width }]}>
            {step}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View
          accessibilityLabel={progressLabel(activeStep + 1, STEP_COUNT)}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          accessibilityValue={{ max: STEP_COUNT, min: 1, now: activeStep + 1 }}
          accessible
          style={styles.dots}
        >
          {steps.map((_, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

            return (
              <Animated.View
                key={index}
                accessible={false}
                style={[
                  styles.dot,
                  {
                    backgroundColor: scrollX.interpolate({
                      extrapolate: 'clamp',
                      inputRange,
                      outputRange: [COLORS.textDim, COLORS.ember, COLORS.textDim],
                    }),
                    opacity: scrollX.interpolate({
                      extrapolate: 'clamp',
                      inputRange,
                      outputRange: [0.45, 1, 0.45],
                    }),
                    transform: [
                      {
                        scale: scrollX.interpolate({
                          extrapolate: 'clamp',
                          inputRange,
                          outputRange: [1, 1.25, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>

        <Button
          onPress={handlePrimaryAction}
          title={isLastStep ? completeLabel : nextLabel}
          variant="primary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.ink,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
  },
  headerLeftContainer: {
    justifyContent: 'center',
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: SPACING.s,
  },
  skipLabel: {
    color: COLORS.textDim,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.65,
  },
  carousel: {
    flex: 1,
  },
  step: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  footer: {
    gap: SPACING.l,
    paddingBottom: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
  },
  dots: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SPACING.s,
    minHeight: 24,
  },
  dot: {
    backgroundColor: COLORS.textDim,
    borderRadius: 4,
    height: 8,
    opacity: 0.45,
    width: 8,
  },
});
