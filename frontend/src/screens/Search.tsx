import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  AppState,
  Linking,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Mic, Square, Camera, Search as SearchIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme';
import { useSQLiteContext } from 'expo-sqlite';
import { searchItems } from '../services/itemRepository';
import { Item } from '../types/item';
import type { TFunction } from 'i18next';
import pluralize from 'pluralize';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { getActiveLanguage } from '../i18n';
import { recognitionProvider, RecognitionProviderError } from '../services/recognition';
import { useUsageStore } from '../stores/usageStore';
import {
  getUkrainianPossessive,
  getUkrainianRelativeTime,
  isCyrillicText,
  withUkLocationPreposition,
} from '../utils/naturalLanguage';
import { ENV } from '../constants/env';

type SearchProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
type PermissionState = 'checking' | 'granted' | 'denied';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

const LOCATION_PREPOSITIONS = [
  'in',
  'on',
  'at',
  'under',
  'near',
  'inside',
  'behind',
  'above',
  'beside',
  'between',
  'next to',
  'by',
  'on top of',
];

function hasLeadingPreposition(location: string): boolean {
  const normalized = location.toLowerCase().trim();
  return LOCATION_PREPOSITIONS.some((prep) => new RegExp(`^${prep}\\b`, 'i').test(normalized));
}

function getRelativeTime(dateString: string, t: TFunction): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInHours < 1) return t('screens.search.justNow');
  if (diffInHours < 24) return t('screens.search.hoursAgo', { count: diffInHours });
  if (diffInDays === 1) return t('screens.search.yesterday');
  if (diffInDays < 7) return t('screens.search.daysAgo', { count: diffInDays });
  return past.toLocaleDateString();
}

export const Search = ({ route, navigation }: SearchProps) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { updateRecognitionUsage } = useUsageStore();

  const [results, setResults] = useState<Item[]>([]);
  const audioRecorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const [, setPermissionState] = useState<PermissionState>('checking');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [query, setQuery] = useState(route?.params?.initialQuery ?? '');
  const [prevInitialQuery, setPrevInitialQuery] = useState(route?.params?.initialQuery);

  if (route?.params?.initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(route?.params?.initialQuery);
    setQuery(route?.params?.initialQuery ?? '');
  }

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const isRecording = recorderState.isRecording || audioRecorder.isRecording;

  const applyPermission = useCallback((granted: boolean, askAgain: boolean) => {
    setCanAskAgain(askAgain);
    setPermissionState(granted ? 'granted' : 'denied');
    if (granted) {
      setVoiceError(null);
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
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    };
  }, [applyPermission]);

  const requestPermission = useCallback(async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    applyPermission(permission.granted, permission.canAskAgain);
    return permission.granted;
  }, [applyPermission]);

  const startRecording = async () => {
    setIsBusy(true);
    setVoiceError(null);
    setQuery('');
    setResults([]);

    try {
      let permission = await AudioModule.getRecordingPermissionsAsync();
      applyPermission(permission.granted, permission.canAskAgain);

      if (!permission.granted) {
        const granted = await requestPermission();
        if (!granted) {
          if (!canAskAgain) {
            Alert.alert(
              t('screens.captureVoice.permissionDenied'),
              t('screens.captureVoice.openSettingsHint'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('screens.captureVoice.openSettings'),
                  onPress: () => void Linking.openSettings(),
                },
              ],
            );
            return;
          }
          setVoiceError(t('screens.captureVoice.permissionDenied'));
          return;
        }
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setVoiceError(t('screens.captureVoice.recordingError'));
    } finally {
      setIsBusy(false);
    }
  };

  const finishRecording = async () => {
    setIsBusy(true);
    setVoiceError(null);
    const startedAt = Date.now();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri ?? audioRecorder.getStatus().url;
      await setAudioModeAsync({ allowsRecording: false });

      if (!uri) {
        throw new Error('Recording URI is unavailable');
      }

      const recognitionLocale = getActiveLanguage();
      const recognition = await recognitionProvider.recognize({
        locale: recognitionLocale,
        mediaUri: uri,
        source: 'voice',
        startedAt,
      });

      updateRecognitionUsage(recognition.usage);

      const recognizedText = recognition.result?.transcript || recognition.result?.title || '';
      if (recognizedText.trim()) {
        setQuery(recognizedText.trim());
      } else {
        setVoiceError(t('screens.search.noSpeechDetected'));
      }
    } catch (error) {
      console.error('Voice search error:', error);
      if (error instanceof RecognitionProviderError) {
        setVoiceError(
          error.code === 'monthly_limit_reached'
            ? t('screens.captureVoice.monthlyLimitReached')
            : error.message,
        );
      } else {
        setVoiceError(t('screens.captureVoice.recognitionError'));
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleVoiceButtonPress = () => {
    if (isBusy) return;

    if (isRecording) {
      void finishRecording();
    } else {
      void startRecording();
    }
  };

  const performSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }
      const foundItems = await searchItems(db, trimmed);
      setResults(foundItems);
    },
    [db],
  );

  useEffect(() => {
    const triggerSearch = async () => {
      await performSearch(query);
    };
    void triggerSearch();
  }, [query, performSearch]);

  const renderAiSentence = () => {
    if (results.length === 0) return null;
    const first = results[0];

    if (isCyrillicText(first.title)) {
      const possessive = getUkrainianPossessive(first.title);
      const location = withUkLocationPreposition(first.locationText);
      return (
        <View style={styles.aiResponseBox}>
          <View style={styles.aiHeader}>
            <View style={styles.aiDot} />
            <Text style={styles.aiBrand}>GLANCEKEEP</Text>
          </View>
          <Text style={styles.aiSpeech}>
            {possessive} <Text style={styles.boldHighlight}>{first.title}</Text>{' '}
            <Text style={styles.boldHighlight}>{location}</Text>
            <Text style={styles.timeMeta}>
              {' '}
              — збережено {getUkrainianRelativeTime(first.updatedAt || first.createdAt)}
            </Text>
          </Text>
        </View>
      );
    }

    const isPlural = pluralize.isPlural(first.title.trim());
    const verb = isPlural ? 'are' : 'is';
    const connector = hasLeadingPreposition(first.locationText) ? '' : 'in ';
    return (
      <View style={styles.aiResponseBox}>
        <View style={styles.aiHeader}>
          <View style={styles.aiDot} />
          <Text style={styles.aiBrand}>GLANCEKEEP</Text>
        </View>
        <Text style={styles.aiSpeech}>
          {t('screens.search.aiAnswerStart')}
          <Text style={styles.boldHighlight}>{first.title}</Text>
          <Text style={styles.aiSpeech}>
            {' '}
            {verb === 'is' ? t('screens.search.verbIs') : t('screens.search.verbAre')}
          </Text>
          {connector ? <Text style={styles.aiSpeech}>{` ${connector}`}</Text> : null}
          <Text style={styles.boldHighlight}>{first.locationText}</Text>
          <Text style={styles.timeMeta}>
            {' '}
            — {t('screens.search.saved')}{' '}
            {getRelativeTime(first.updatedAt || first.createdAt, t).toLowerCase()}
          </Text>
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.white} size={24} />
        </TouchableOpacity>

        <View style={[styles.searchBarWrapper, isRecording && styles.searchBarRecording]}>
          <SearchIcon color={COLORS.textDim} size={18} style={{ marginLeft: 16 }} />
          <TextInput
            style={styles.input}
            placeholder={
              isRecording
                ? t('screens.captureVoice.recording')
                : isBusy
                  ? t('screens.captureVoice.recognizing')
                  : t('screens.search.searchPlaceholder')
            }
            placeholderTextColor={isRecording ? COLORS.danger : COLORS.textDim}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            editable={!isRecording && !isBusy}
          />
          {ENV.FEATURE_FLAGS.ENABLE_VOICE_CAPTURE && (
            <TouchableOpacity
              style={[
                styles.voiceButton,
                isRecording && styles.voiceButtonRecording,
                isBusy && styles.voiceButtonBusy,
              ]}
              onPress={handleVoiceButtonPress}
              activeOpacity={0.7}
              disabled={isBusy}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={COLORS.ember} />
              ) : isRecording ? (
                <Square color={COLORS.white} size={16} fill={COLORS.white} />
              ) : (
                <Mic color={COLORS.ember} size={18} />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {voiceError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{voiceError}</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          results.length === 0 && {
            flexGrow: 1,
            justifyContent: 'center',
          },
        ]}
        ListHeaderComponent={renderAiSentence()}
        ListEmptyComponent={() =>
          query.trim().length > 0 ? (
            <View
              style={[
                styles.noResultsContainer,
                isKeyboardVisible && styles.noResultsContainerKeyboard,
              ]}
            >
              <Text style={styles.noResultsText}>{t('screens.search.noMatches', { query })}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <View>
            {index === 0 && <Text style={styles.sectionTitle}>{t('screens.search.matches')}</Text>}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.resultCard}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
            >
              <View style={styles.itemIconBox}>
                {item.source === 'photo' ? (
                  <Camera color={COLORS.textDim} size={20} />
                ) : (
                  <Mic color={COLORS.textDim} size={20} />
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle}>
                  {item.title} — <Text style={{ color: COLORS.white }}>{item.locationText}</Text>
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.itemMetaText}>
                    {item.source === 'photo'
                      ? t('components.actionBar.photo')
                      : t('components.actionBar.voice')}
                  </Text>
                  <View style={styles.dotSeparator} />
                  <Text style={styles.itemMetaText}>
                    {getRelativeTime(item.updatedAt || item.createdAt, t).toLowerCase()}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.s }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ink2,
    borderRadius: RADIUS.full,
    height: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchBarRecording: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontFamily: FONTS.body,
    fontSize: 16,
    marginLeft: 10,
  },
  voiceButton: {
    marginRight: 6,
    width: 36,
    height: 36,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: COLORS.danger,
    transform: [{ scale: 1.05 }],
  },
  voiceButtonBusy: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  errorContainer: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.s,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  listContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 40,
  },
  aiResponseBox: {
    marginTop: SPACING.m,
    marginBottom: SPACING.xl,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    borderRadius: 0,
    backgroundColor: 'rgba(0, 240, 255, 0.08)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.ember,
  },
  aiBrand: {
    color: COLORS.ember,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  aiSpeech: {
    color: COLORS.white,
    fontFamily: FONTS.headline,
    fontSize: 21,
    lineHeight: 28,
  },
  sectionTitle: {
    color: COLORS.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 16,
    marginTop: SPACING.s,
    textTransform: 'uppercase',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 0,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.white,
    fontFamily: FONTS.bodyMedium,
    fontSize: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  itemMetaText: {
    color: COLORS.textDim,
    fontSize: 13,
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.textDim,
    marginHorizontal: 12,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  noResultsContainerKeyboard: {
    transform: [{ translateY: -120 }],
  },
  noResultsText: {
    color: COLORS.textDim,
    fontFamily: FONTS.headline,
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
  },
  boldHighlight: {
    fontWeight: 'bold',
    color: COLORS.ember,
  },
  timeMeta: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '400',
  },
});
