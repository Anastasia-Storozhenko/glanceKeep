import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { getActiveLanguage } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { useRecognitionJobStore } from '../stores/recognitionJobStore';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING, GLOW } from '../theme';
import { ENV } from '../constants/env';
import { Mic } from 'lucide-react-native';
import { PermissionDeniedScreen } from '../components/PermissionDeniedScreen';

type CaptureVoiceProps = NativeStackScreenProps<RootStackParamList, 'CaptureVoice'>;
type PermissionState = 'checking' | 'granted' | 'denied';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
  isMeteringEnabled: true,
};

const SPEECH_LEVEL_THRESHOLD_DB = -45;
const SILENCE_LEVEL_THRESHOLD_DB = -50;
const MIN_SPEECH_DURATION_MS = 400;
const AUTO_STOP_SILENCE_DURATION_MS = 1600;

const BAR_COUNT = 5;
const GLOW_SIZE = 220;

function formatDuration(durationMillis: number) {
  const totalSeconds = Math.floor(durationMillis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getSpeechRecognitionLocale(lang: string): string {
  const normalized = lang.toLowerCase();
  if (normalized.startsWith('uk')) {
    return 'uk-UA';
  }
  return 'en-US';
}

function GlowCircle({ active }: { active: boolean }) {
  if (!active) {
    return null;
  }

  const center = GLOW_SIZE / 2;

  return (
    <Svg height={GLOW_SIZE} width={GLOW_SIZE} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={GLOW.secondary} stopOpacity={0.45} />
          <Stop offset="60%" stopColor={GLOW.secondary} stopOpacity={0.15} />
          <Stop offset="100%" stopColor={GLOW.secondary} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={center} cy={center} r={center} fill="url(#glow)" />
    </Svg>
  );
}

function WaveformPulse({ active }: { active: boolean }) {
  const [bars] = useState(() => Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.3)));
  const loopRefs = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (!active) {
      loopRefs.current.forEach((loop) => loop.stop());
      bars.forEach((bar) => bar.setValue(0.3));
      return;
    }

    loopRefs.current = bars.map((bar, index) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 90),
          Animated.timing(bar, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(bar, {
            toValue: 0.25,
            duration: 320,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      loop.start();
      return loop;
    });

    return () => {
      loopRefs.current.forEach((loop) => loop.stop());
    };
  }, [active, bars]);

  return (
    <View style={styles.pulseWrap}>
      <GlowCircle active={active} />
      {active ? (
        <View style={styles.barsRow}>
          {bars.map((bar, index) => (
            <Animated.View
              key={index}
              style={[
                styles.bar,
                {
                  height: bar.interpolate({
                    inputRange: [0.25, 1],
                    outputRange: [10, 48],
                  }),
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Mic color={COLORS.ember} size={30} />
      )}
    </View>
  );
}

function BlinkingCursor() {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.Text style={[styles.cursor, { opacity }]}>|</Animated.Text>;
}

export function CaptureVoice({ navigation }: CaptureVoiceProps) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!ENV.FEATURE_FLAGS.ENABLE_VOICE_CAPTURE) {
      navigation.goBack();
    }
  }, [navigation]);

  const { startRecognition } = useRecognitionJobStore();
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const [permissionState, setPermissionState] = useState<PermissionState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const finishRequestedRef = useRef(false);
  const speechStartedAtRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const silenceStartedAtRef = useRef<number | null>(null);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript;
    if (typeof text === 'string') {
      setPartialTranscript(text);
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.log('Speech recognition preview error:', event.error, event.message);
    setError(`Speech error: ${event.error} ${event.message ?? ''}`);
  });

  const applyPermission = useCallback((granted: boolean, askAgain: boolean) => {
    setCanAskAgain(askAgain);
    setPermissionState(granted ? 'granted' : 'denied');

    if (granted) {
      setError(null);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const refreshPermission = async () => {
      try {
        const permission = await AudioModule.getRecordingPermissionsAsync();

        if (isMounted) {
          applyPermission(permission.granted, permission.canAskAgain);
        }
      } catch {
        if (isMounted) {
          setPermissionState('denied');
          setError(t('screens.captureVoice.permissionError'));
        }
      }
    };

    void refreshPermission();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermission();
      }
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        //ignore
      }
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, [applyPermission, t]);

  const requestPermission = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    applyPermission(permission.granted, permission.canAskAgain);
    return permission.granted;
  }, [applyPermission]);

  const startRecording = useCallback(async () => {
    if (!ENV.FEATURE_FLAGS.ENABLE_VOICE_CAPTURE) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setPartialTranscript('');

    try {
      let permission = await AudioModule.getRecordingPermissionsAsync();
      applyPermission(permission.granted, permission.canAskAgain);

      if (!permission.granted) {
        const granted = await requestPermission();

        if (!granted) {
          permission = await AudioModule.getRecordingPermissionsAsync();
          applyPermission(permission.granted, permission.canAskAgain);

          if (!permission.canAskAgain) {
            await Linking.openSettings();
            return;
          }

          setError(t('screens.captureVoice.permissionDenied'));
          return;
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync();
      finishRequestedRef.current = false;
      speechStartedAtRef.current = null;
      speechDetectedRef.current = false;
      silenceStartedAtRef.current = null;
      audioRecorder.record();

      try {
        const speechPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        const recognitionLocale = getSpeechRecognitionLocale(getActiveLanguage());

        if (speechPermission.granted) {
          ExpoSpeechRecognitionModule.start({
            lang: recognitionLocale,
            interimResults: true,
            continuous: true,
          });
        } else {
          console.log('Speech recognition permission not granted:', speechPermission);
        }
      } catch (speechError) {
        console.log('Live transcript preview unavailable:', speechError);
      }
    } catch {
      setError(t('screens.captureVoice.recordingError'));
    } finally {
      setIsBusy(false);
    }
  }, [applyPermission, audioRecorder, requestPermission, t]);

  const finishRecording = useCallback(async () => {
    if (finishRequestedRef.current) {
      return;
    }

    finishRequestedRef.current = true;
    setIsBusy(true);
    setError(null);
    const startedAt = Date.now();

    try {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (speechError) {
        console.log('Error stopping live transcript preview:', speechError);
      }

      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? audioRecorder.getStatus().url;

      if (!uri) {
        throw new Error('Recording URI is unavailable.');
      }
      await setAudioModeAsync({ allowsRecording: false }).catch((error) => {
        console.log('Unable to reset audio mode:', error);
      });
      const recognitionJobId = startRecognition({
        locale: getActiveLanguage(),
        mediaUri: uri,
        source: 'voice',
        startedAt,
      });

      navigation.navigate('ConfirmSave', {
        source: 'voice',
        audioUri: uri,
        locationText: '',
        tags: [],
        title: '',
        transcript: null,
        confidence: 0,
        recognitionJobId,
      });
    } catch (requestError) {
      finishRequestedRef.current = false;
      const detail = requestError instanceof Error ? ` ${requestError.message}` : '';
      setError(`${t('screens.captureVoice.saveError')}${detail}`);
    } finally {
      setIsBusy(false);
      setPartialTranscript('');
    }
  }, [audioRecorder, navigation, startRecognition, t]);

  const isRecording = recorderState.isRecording || audioRecorder.isRecording;

  useEffect(() => {
    const metering = recorderState.metering;
    const durationMillis = recorderState.durationMillis;

    if (
      !isRecording ||
      typeof metering !== 'number' ||
      !Number.isFinite(metering) ||
      finishRequestedRef.current
    ) {
      return;
    }

    if (!speechDetectedRef.current) {
      if (metering >= SPEECH_LEVEL_THRESHOLD_DB) {
        speechStartedAtRef.current ??= durationMillis;

        if (durationMillis - speechStartedAtRef.current >= MIN_SPEECH_DURATION_MS) {
          speechDetectedRef.current = true;
        }
      } else {
        speechStartedAtRef.current = null;
      }

      return;
    }

    if (metering > SILENCE_LEVEL_THRESHOLD_DB) {
      silenceStartedAtRef.current = null;
      return;
    }

    silenceStartedAtRef.current ??= durationMillis;

    if (durationMillis - silenceStartedAtRef.current >= AUTO_STOP_SILENCE_DURATION_MS) {
      void finishRecording();
    }
  }, [finishRecording, isRecording, recorderState.durationMillis, recorderState.metering]);

  const isPermissionBlocked = permissionState === 'denied' && !canAskAgain;
  const statusText = isRecording
    ? t('screens.captureVoice.recording')
    : isBusy
      ? t('screens.captureVoice.recognizing')
      : permissionState === 'checking'
        ? t('screens.captureVoice.checkingPermission')
        : permissionState === 'denied'
          ? t('screens.captureVoice.permissionDenied')
          : t('screens.captureVoice.ready');
  const actionLabel = isRecording
    ? t('screens.captureVoice.stopRecording')
    : isPermissionBlocked
      ? t('screens.captureVoice.openSettings')
      : t('screens.captureVoice.startRecording');

  const handleClose = async () => {
    if (isBusy) {
      return;
    }

    if (isRecording && !finishRequestedRef.current) {
      finishRequestedRef.current = true;
      setIsBusy(true);

      try {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch (speechError) {
          console.log('Error stopping live transcript preview:', speechError);
        }
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        finishRequestedRef.current = false;
        setError(t('screens.captureVoice.saveError'));
        setIsBusy(false);
        return;
      }
    }

    navigation.goBack();
  };

  const handlePrimaryPress = () => {
    if (isBusy || permissionState === 'checking') {
      return;
    }

    if (isRecording) {
      void finishRecording();
      return;
    }

    void startRecording();
  };

  if (permissionState === 'denied') {
    return (
      <PermissionDeniedScreen
        icon={<Mic color={COLORS.ink} size={30} />}
        titleKey="screens.captureVoice.title"
        explanationKey="screens.captureVoice.microphoneAccessRequired"
        canAskAgain={canAskAgain}
        onPrimaryPress={() => (canAskAgain ? void startRecording() : void Linking.openSettings())}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable
          accessibilityHint={t('screens.captureVoice.closeHint')}
          accessibilityLabel={t('screens.captureVoice.close')}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          hitSlop={12}
          onPress={() => void handleClose()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
            isBusy && styles.disabled,
          ]}
          testID="voice-close-button"
        >
          <Icon color={COLORS.text} name="x" size="large" />
        </Pressable>

        <Text
          accessibilityLabel={t('screens.captureVoice.durationAccessibilityLabel', {
            duration: formatDuration(recorderState.durationMillis),
          })}
          style={styles.timerTop}
        >
          {formatDuration(recorderState.durationMillis)}
        </Text>

        <WaveformPulse active={isRecording} />

        <Text accessibilityRole="header" style={styles.title}>
          {isRecording
            ? t('screens.captureVoice.recordingPrompt')
            : t('screens.captureVoice.title')}
        </Text>

        {isRecording ? (
          <View style={styles.transcriptBox}>
            <Text accessibilityLiveRegion="polite" style={styles.transcriptText}>
              "{partialTranscript}
              <BlinkingCursor />"
            </Text>
          </View>
        ) : (
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, isRecording && styles.recordingDot]} />
            <Text accessibilityLiveRegion="polite" style={styles.statusText}>
              {statusText}
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        {isRecording ? (
          <Text style={styles.pauseHint}>{t('screens.captureVoice.pauseToFinish')}</Text>
        ) : null}

        <View style={!isRecording ? styles.readyActionContainer : styles.recordingActionContainer}>
          <Pressable
            accessibilityHint={
              isRecording
                ? t('screens.captureVoice.stopRecordingHint')
                : isPermissionBlocked
                  ? t('screens.captureVoice.openSettingsHint')
                  : t('screens.captureVoice.startRecordingHint')
            }
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            accessibilityState={{
              disabled: isBusy || permissionState === 'checking',
            }}
            disabled={isBusy || permissionState === 'checking'}
            onPress={handlePrimaryPress}
            style={({ pressed }) => [
              styles.recordButton,
              pressed && styles.pressed,
              (isBusy || permissionState === 'checking') && styles.disabled,
            ]}
            testID={isRecording ? 'voice-stop-button' : 'voice-record-button'}
          >
            {isBusy || permissionState === 'checking' ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Icon color={COLORS.ink} name={isRecording ? 'stop' : 'mic'} size={30} />
            )}
          </Pressable>

          {!isRecording && <Text style={styles.actionLabel}>{actionLabel}</Text>}
        </View>

        {error ? (
          <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },
  bar: {
    backgroundColor: COLORS.ember,
    borderRadius: RADIUS.s,
    marginHorizontal: 3,
    width: 6,
  },
  barsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 48,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: (GLOW_SIZE - 48) / 2,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADIUS.full,
    height: 48,
    justifyContent: 'center',
    left: SPACING.l,
    position: 'absolute',
    top: SPACING.m,
    width: 48,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    gap: SPACING.l,
    justifyContent: 'center',
    padding: SPACING.l,
  },
  cursor: {
    color: COLORS.ember,
    fontFamily: FONTS.mono,
  },
  disabled: {
    opacity: 0.45,
  },
  errorText: {
    color: COLORS.danger,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
    lineHeight: 21,
    maxWidth: 320,
    textAlign: 'center',
  },
  pauseHint: {
    color: COLORS.textDim,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.label,
    letterSpacing: 1,
    textTransform: 'lowercase',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  pulseWrap: {
    alignItems: 'center',
    height: GLOW_SIZE,
    justifyContent: 'center',
    position: 'relative',
    width: GLOW_SIZE,
  },
  recordButton: {
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
  readyActionContainer: {
    alignItems: 'center',
    gap: 10,
    transform: [{ translateY: 48 }],
  },

  recordingActionContainer: {
    alignItems: 'center',
  },

  recordingDot: {
    backgroundColor: COLORS.danger,
  },
  safeArea: {
    backgroundColor: COLORS.ink,
    flex: 1,
  },
  spacer: {
    flex: 1,
    maxHeight: SPACING.xl,
  },
  statusContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.s,
  },
  statusDot: {
    backgroundColor: COLORS.textDim,
    borderRadius: RADIUS.full,
    height: 8,
    width: 8,
  },
  statusText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },
  timerTop: {
    color: COLORS.textDim,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.label,
    position: 'absolute',
    right: SPACING.l,
    top: SPACING.m,
  },
  title: {
    color: COLORS.text,
    fontFamily: FONTS.headline,
    fontSize: 24,
    lineHeight: 32,
    maxWidth: 320,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  transcriptBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.m,
    borderWidth: 1,
    maxWidth: 320,
    minHeight: 72,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  transcriptText: {
    color: COLORS.text,
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.body,
    lineHeight: 22,
  },
});
