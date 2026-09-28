import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ArrowLeft, Pencil, MapPin, Plus, Mic } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme';
import { useSQLiteContext } from 'expo-sqlite';
import * as Crypto from 'expo-crypto';
import { getItems } from '../services/itemRepository';
import { Item } from '../types/item';
import { useItemStore } from '../stores/itemStore';
import { useRecognitionJobStore } from '../stores/recognitionJobStore';
import { ENV } from '../constants/env';

type ConfirmSaveProps = NativeStackScreenProps<RootStackParamList, 'ConfirmSave'>;

export const ConfirmSave = ({ route, navigation }: ConfirmSaveProps) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { saveItem } = useItemStore();
  const { attachSavedItem, jobs } = useRecognitionJobStore();

  const { source } = route.params;
  const recognitionJob = jobs[route.params.recognitionJobId];
  const recognitionStatus = recognitionJob?.status ?? 'pending';
  const geoText = recognitionJob?.geo?.text ?? route.params.geoText;
  const uri = source === 'photo' ? route.params.uri : route.params.audioUri;
  const transcript =
    source === 'voice'
      ? (recognitionJob?.result?.transcript ?? route.params.transcript)
      : undefined;

  const [title, setTitle] = useState(route.params.title ?? '');
  const [location, setLocation] = useState(route.params.locationText ?? '');
  const [tags, setTags] = useState<string[]>(route.params.tags ?? []);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const [potentialMatch, setPotentialMatch] = useState<Item | null>(null);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const itemIdRef = useRef(Crypto.randomUUID());
  const titleEditedRef = useRef(false);
  const locationEditedRef = useRef(false);
  const tagsEditedRef = useRef(false);

  useEffect(() => {
    if (recognitionStatus !== 'recognized' || !recognitionJob?.result) return;

    if (!titleEditedRef.current) setTitle(recognitionJob.result.title);
    if (!locationEditedRef.current) setLocation(recognitionJob.result.locationText);
    if (!tagsEditedRef.current) setTags(recognitionJob.result.tags);
  }, [recognitionJob?.result, recognitionStatus]);

  useEffect(() => {
    const checkForMatch = async () => {
      if (!title.trim()) return;

      const existingItems = await getItems(db);
      const match = existingItems.find(
        (item) => item.title.toLowerCase() === title.trim().toLowerCase(),
      );

      if (match) {
        setPotentialMatch(match);
      } else {
        setPotentialMatch(null);
        setIsUpdateMode(false);
      }
    };
    checkForMatch();
  }, [title, db]);

  const handleAddTag = () => {
    setIsAddingTag(true);
  };

  const submitTag = () => {
    if (tagInput.trim()) {
      tagsEditedRef.current = true;
      setTags([...tags, tagInput.trim()]);
    }
    setTagInput('');
    setIsAddingTag(false);
  };

  const handleSave = async () => {
    try {
      const itemToSave: Item = {
        id: isUpdateMode && potentialMatch ? potentialMatch.id : itemIdRef.current,
        source: source,
        title: title.trim(),
        description: '',
        locationText: location.trim(),
        mediaUri: uri,
        tags: tags,
        transcript: transcript || null,
        aiConfidence: recognitionJob?.result?.confidence ?? route.params.confidence ?? 0,
        createdAt:
          isUpdateMode && potentialMatch ? potentialMatch.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus:
          recognitionStatus === 'processing' || recognitionStatus === 'pending'
            ? 'pending'
            : 'local',
        geo: ENV.FEATURE_FLAGS.ENABLE_LOCATION
          ? recognitionJob?.geo !== null && recognitionJob?.geo !== undefined
            ? { lat: recognitionJob.geo.lat, lng: recognitionJob.geo.lng }
            : route.params.geoLat != null && route.params.geoLng != null
              ? { lat: route.params.geoLat, lng: route.params.geoLng }
              : isUpdateMode && potentialMatch
                ? potentialMatch.geo
                : null
          : null,
      };
      await saveItem(itemToSave);
      await attachSavedItem(route.params.recognitionJobId, itemToSave, {
        locationText: locationEditedRef.current,
        tags: tagsEditedRef.current,
        title: titleEditedRef.current,
      });

      console.log(' Success: Item saved', itemToSave.id);
      navigation.navigate('Home');
    } catch (error) {
      console.error(' Save failed', error);
    }
  };
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft color={COLORS.white} size={22} />
          </TouchableOpacity>

          <View style={styles.aiStatus}>
            <View
              style={[styles.aiDot, recognitionStatus !== 'recognized' && styles.fallbackDot]}
            />
            <Text style={styles.aiText}>
              {recognitionStatus === 'processing'
                ? t('screens.confirmSave.processingStatus')
                : recognitionStatus === 'pending'
                  ? t('screens.confirmSave.pendingStatus')
                  : recognitionStatus === 'recognized'
                    ? t('screens.confirmSave.aiStatus')
                    : t('screens.confirmSave.fallbackStatus')}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mediaContainer}>
            {source === 'photo' ? (
              <Image source={{ uri }} style={styles.previewImage} contentFit="cover" />
            ) : (
              <View style={styles.voicePreview}>
                <View style={styles.voiceIconCircle}>
                  <Mic color={COLORS.ember} size={32} />
                </View>
                {transcript ? <Text style={styles.transcript}>{transcript}</Text> : null}
              </View>
            )}
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('screens.confirmSave.labelWhat')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={(value) => {
                    titleEditedRef.current = true;
                    setTitle(value);
                  }}
                  placeholderTextColor={COLORS.textDim}
                  selectTextOnFocus={true}
                />
                <Pencil size={18} color={COLORS.textDim} />
              </View>
            </View>

            {potentialMatch && !isUpdateMode && (
              <View style={styles.matchHintContainer}>
                <Text style={styles.matchHintText}>
                  {t('screens.confirmSave.matchHint', { title: potentialMatch.title })}
                </Text>
                <View style={styles.matchActions}>
                  <TouchableOpacity onPress={() => setIsUpdateMode(true)}>
                    <Text style={styles.matchActionButton}>
                      {t('screens.confirmSave.matchYes')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginLeft: 20 }}
                    onPress={() => setPotentialMatch(null)}
                  >
                    <Text style={[styles.matchActionButton, { color: COLORS.textDim }]}>
                      {t('screens.confirmSave.matchNo')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('screens.confirmSave.labelWhere')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={(value) => {
                    locationEditedRef.current = true;
                    setLocation(value);
                  }}
                  placeholderTextColor={COLORS.textDim}
                  selectTextOnFocus={true}
                />
                <Pencil size={18} color={COLORS.textDim} />
              </View>
            </View>

            <View style={styles.tagsSection}>
              <Text style={styles.label}>{t('screens.confirmSave.labelTags')}</Text>
              <View style={styles.tagsList}>
                {tags.map((tag, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.tagPill}
                    onPress={() => {
                      tagsEditedRef.current = true;
                      setTags(tags.filter((_, i) => i !== index));
                    }}
                  >
                    <Text style={styles.tagText}>{tag} ✕</Text>
                  </TouchableOpacity>
                ))}
                {isAddingTag ? (
                  <View style={[styles.tagPill, styles.tagInputPill]}>
                    <TextInput
                      autoFocus
                      style={styles.tagInput}
                      value={tagInput}
                      onChangeText={setTagInput}
                      onBlur={submitTag}
                      onSubmitEditing={submitTag}
                      placeholder="..."
                      placeholderTextColor={COLORS.textDim}
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.tagPill, styles.addTagPill]}
                    onPress={handleAddTag}
                  >
                    <Plus size={16} color={COLORS.textDim} />
                    <Text style={styles.addTagText}>{t('screens.confirmSave.addTag')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {ENV.FEATURE_FLAGS.ENABLE_LOCATION && (
              <View style={styles.locationContainer}>
                <MapPin size={16} color={geoText ? COLORS.ember : COLORS.textDim} />
                <Text style={[styles.locationText, geoText && { color: COLORS.white }]}>
                  {geoText || t('screens.confirmSave.locationAutoSaved')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.keepButton} onPress={handleSave}>
            <Text style={styles.keepButtonText}>{t('screens.confirmSave.keepIt')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.retakeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retakeButtonText}>
              {source === 'photo'
                ? t('screens.confirmSave.retakePhoto')
                : t('screens.confirmSave.retakeVoice')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    height: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  aiStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F0FF',
    marginRight: 10,
  },
  fallbackDot: {
    backgroundColor: COLORS.textDim,
  },
  aiText: {
    color: '#8E8E93',
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 40,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.ink2,
    overflow: 'hidden',
    marginVertical: SPACING.m,
  },
  previewImage: {
    flex: 1,
  },
  voicePreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceDuration: {
    color: COLORS.white,
    fontFamily: FONTS.mono,
    fontSize: 24,
    marginTop: 10,
  },
  transcript: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: SPACING.s,
    paddingHorizontal: SPACING.l,
    textAlign: 'center',
  },
  form: {
    gap: SPACING.l,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: COLORS.textDim,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ink2,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    height: 58,
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONTS.bodyMedium,
  },
  tagsSection: {
    marginTop: SPACING.s,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  tagPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  tagText: {
    color: '#00F0FF',
    fontSize: 14,
  },
  addTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  addTagText: {
    color: COLORS.textDim,
    fontSize: 14,
    marginLeft: 6,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
    gap: 8,
  },
  locationText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontFamily: FONTS.body,
  },
  footer: {
    padding: SPACING.l,
    alignItems: 'center',
    backgroundColor: COLORS.ink,
  },
  keepButton: {
    backgroundColor: '#00F0FF',
    width: '100%',
    height: 64,
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00F0FF',
    shadowRadius: 20,
    shadowOpacity: 0.6,
  },
  keepButtonText: {
    color: COLORS.ink,
    fontSize: 20,
    fontFamily: FONTS.headline,
    fontWeight: '900',
    letterSpacing: 2,
  },
  retakeButton: {
    marginTop: 20,
    paddingVertical: 10,
  },
  retakeButtonText: {
    color: '#8E8E93',
    fontSize: 16,
    fontFamily: FONTS.body,
  },
  matchHintContainer: {
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    padding: 12,
    borderRadius: RADIUS.s,
    marginTop: -8,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#00F0FF',
  },
  matchHintText: {
    color: COLORS.textDim,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  matchActions: {
    flexDirection: 'row',
    marginTop: 8,
  },
  matchActionButton: {
    color: '#00F0FF',
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  tagInputPill: {
    borderWidth: 1,
    borderColor: '#00F0FF',
    minWidth: 60,
  },
  tagInput: {
    color: '#00F0FF',
    fontSize: 14,
    padding: 0,
    height: 20,
  },
});
