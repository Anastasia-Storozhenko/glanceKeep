import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MoreHorizontal,
  MapPin,
  Pencil,
  Share2,
  Trash2,
  Camera,
  Volume2,
  X,
  Plus,
  Check,
  Navigation as NavigationIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { COLORS, SPACING, RADIUS, FONTS } from '../theme';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteItem, getItem, upsertItem } from '../services/itemRepository';
import { useItemStore } from '../stores/itemStore';
import type { Item } from '../types/item';
import type { TFunction } from 'i18next';
import * as Location from 'expo-location';
import { ENV } from '../constants/env';

type ItemDetailProps = NativeStackScreenProps<RootStackParamList, 'ItemDetail'>;

function getRelativeTime(dateString: string, t: TFunction): string {
  if (!dateString) return '';
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

export const ItemDetail = ({ route, navigation }: ItemDetailProps) => {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { itemId } = route.params;
  const { refreshItems } = useItemStore();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [geoAddress, setGeoAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!ENV.FEATURE_FLAGS.ENABLE_LOCATION) return;
    if (item?.geo?.lat && item?.geo?.lng) {
      Location.reverseGeocodeAsync({
        latitude: item.geo.lat,
        longitude: item.geo.lng,
      })
        .then((places) => {
          if (places && places.length > 0) {
            const place = places[0];
            const city = place.city || place.subregion || place.region || '';
            const street = place.street
              ? `${place.street}${place.streetNumber ? `, ${place.streetNumber}` : ''}`
              : '';
            const formatted = [street, city].filter(Boolean).join(', ');
            setGeoAddress(formatted || `${item.geo!.lat.toFixed(4)}, ${item.geo!.lng.toFixed(4)}`);
          }
        })
        .catch(() => {
          setGeoAddress(`${item.geo!.lat.toFixed(4)}, ${item.geo!.lng.toFixed(4)}`);
        });
    }
  }, [item?.geo]);

  useEffect(() => {
    let isMounted = true;

    const loadItem = async () => {
      try {
        const found = await getItem(db, itemId);
        if (isMounted) {
          setItem(found ?? null);
          if (found) {
            setEditTitle(found.title);
            setEditLocation(found.locationText || '');
            setEditTags(found.tags || []);
          }
        }
      } catch (error) {
        console.error('Failed to load item:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void loadItem();

    return () => {
      isMounted = false;
    };
  }, [db, itemId]);

  const handleOpenMap = () => {
    if (!item?.geo) return;
    const { lat, lng } = item.geo;
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(item.title);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latLng}`);
      });
    }
  };

  const handleOpenEdit = () => {
    if (!item) return;
    setEditTitle(item.title);
    setEditLocation(item.locationText || '');
    setEditTags(item.tags || []);
    setIsAddingTag(false);
    setTagInput('');
    setIsEditModalOpen(true);
  };

  const handleRemoveTag = (indexToRemove: number) => {
    setEditTags((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmitTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
    setIsAddingTag(false);
  };

  const handleSaveEdit = async () => {
    if (!item || !editTitle.trim()) {
      Alert.alert(t('common.error'), t('screens.itemDetail.titleRequired'));
      return;
    }

    const trimmedTitle = editTitle.trim();
    const trimmedLocation = editLocation.trim();
    const originalTags = item.tags || [];
    const isTitleChanged = trimmedTitle !== item.title.trim();
    const isLocationChanged = trimmedLocation !== (item.locationText || '').trim();
    const isTagsChanged = JSON.stringify(editTags) !== JSON.stringify(originalTags);
    const hasRealChanges = isTitleChanged || isLocationChanged || isTagsChanged;
    if (!hasRealChanges) {
      setIsEditModalOpen(false);
      return;
    }
    setIsSaving(true);
    try {
      const updatedItem: Item = {
        ...item,
        title: trimmedTitle,
        locationText: trimmedLocation,
        tags: editTags,
        updatedAt: new Date().toISOString(),
      };

      await upsertItem(db, updatedItem);
      await refreshItems();
      setItem(updatedItem);
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Failed to update item:', error);
      Alert.alert(t('common.error'), t('screens.itemDetail.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    try {
      const locationPart = item.locationText ? `\n Location: ${item.locationText}` : '';
      const tagsPart =
        item.tags && item.tags.length > 0
          ? `\n Tags: ${item.tags.map((t) => `#${t.replace(/\s+/g, '_')}`).join(' ')}`
          : '';

      await Share.share({
        title: item.title,
        message: ` ${item.title}${locationPart}${tagsPart}\n\nSaved with GlanceKeep`,
        url: item.mediaUri ? item.mediaUri : undefined,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(t('screens.itemDetail.deleteTitle'), t('screens.itemDetail.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(db, itemId);
            await refreshItems();
            navigation.goBack();
          } catch (error) {
            console.error('Failed to delete item:', error);
            Alert.alert(t('common.error'), t('screens.itemDetail.deleteError'));
          }
        },
      },
    ]);
  };

  const handleMoreMenu = () => {
    Alert.alert(
      item?.title || t('screens.itemDetail.itemActions'),
      undefined,
      [
        { text: t('common.edit'), onPress: handleOpenEdit },
        { text: t('common.share'), onPress: handleShare },
        { text: t('common.delete'), style: 'destructive', onPress: handleDelete },
        { text: t('common.cancel'), style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const handleAskGlanceKeep = () => {
    if (!item) return;
    navigation.navigate('Search', { initialQuery: item.title });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.ember} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>{t('screens.itemDetail.notFound')}</Text>
        <TouchableOpacity style={styles.backHomeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backHomeText}>{t('screens.itemDetail.backHome')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroWrapper}>
        {item.source === 'photo' && item.mediaUri ? (
          <Image source={{ uri: item.mediaUri }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            {item.source === 'voice' ? (
              <Volume2 color={COLORS.textDim} size={56} strokeWidth={1.5} />
            ) : (
              <Camera color={COLORS.textDim} size={56} strokeWidth={1.5} />
            )}
          </View>
        )}

        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity
            style={styles.circleIconButton}
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft color={COLORS.white} size={20} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.circleIconButton}
            activeOpacity={0.7}
            onPress={handleMoreMenu}
          >
            <MoreHorizontal color={COLORS.white} size={20} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{item.title.toUpperCase()}</Text>

        <View style={styles.metaRow}>
          <MapPin color={COLORS.textDim} size={15} style={{ marginRight: 4 }} />
          <Text style={styles.locationText}>
            {item.locationText || t('screens.home.locationNotSet')}
          </Text>
          <Text style={styles.dotSeparator}>•</Text>
          <Text style={styles.timeText}>
            {' '}
            {getRelativeTime(item.updatedAt || item.createdAt, t)}
          </Text>
        </View>

        {ENV.FEATURE_FLAGS.ENABLE_LOCATION && item.geo && (
          <TouchableOpacity style={styles.geoBadge} activeOpacity={0.7} onPress={handleOpenMap}>
            <NavigationIcon color={COLORS.ember} size={14} style={{ marginRight: 6 }} />
            <Text numberOfLines={1} style={styles.geoBadgeText}>
              {geoAddress || `${item.geo.lat.toFixed(4)}, ${item.geo.lng.toFixed(4)}`}
            </Text>
            <Text style={styles.geoMapLink}>{t('screens.itemDetail.openMap')}</Text>
          </TouchableOpacity>
        )}

        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsWrapper}>
            {item.tags.map((tag, idx) => (
              <View key={`${tag}-${idx}`} style={styles.tagBadge}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={handleOpenEdit}>
            <Pencil color={COLORS.white} size={20} />
            <Text style={styles.actionCardLabel}>{t('common.edit')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} activeOpacity={0.7} onPress={handleShare}>
            <Share2 color={COLORS.white} size={20} />
            <Text style={styles.actionCardLabel}>{t('common.share')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, styles.deleteCard]}
            activeOpacity={0.7}
            onPress={handleDelete}
          >
            <Trash2 color={COLORS.danger} size={20} />
            <Text style={[styles.actionCardLabel, styles.deleteCardLabel]}>
              {t('common.delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.askButton}
          activeOpacity={0.8}
          onPress={handleAskGlanceKeep}
        >
          <Text style={styles.askButtonText}>{t('screens.itemDetail.askAboutThis')}</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('screens.itemDetail.editItemTitle')}</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setIsEditModalOpen(false)}
              >
                <X color={COLORS.white} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalFieldGroup}>
                <Text style={styles.inputLabel}>{t('screens.confirmSave.labelWhat')}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholderTextColor={COLORS.textDim}
                    selectTextOnFocus
                  />
                  <Pencil size={18} color={COLORS.textDim} />
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.inputLabel}>{t('screens.confirmSave.labelWhere')}</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.modalInput}
                    value={editLocation}
                    onChangeText={setEditLocation}
                    placeholderTextColor={COLORS.textDim}
                    selectTextOnFocus
                  />
                  <Pencil size={18} color={COLORS.textDim} />
                </View>
              </View>

              <View style={styles.modalFieldGroup}>
                <Text style={styles.inputLabel}>{t('screens.confirmSave.labelTags')}</Text>
                <View style={styles.tagsList}>
                  {editTags.map((tag, index) => (
                    <TouchableOpacity
                      key={`${tag}-${index}`}
                      style={styles.tagPill}
                      activeOpacity={0.7}
                      onPress={() => handleRemoveTag(index)}
                    >
                      <Text style={styles.tagPillText}>{tag} ✕</Text>
                    </TouchableOpacity>
                  ))}

                  {isAddingTag ? (
                    <View style={[styles.tagPill, styles.tagInputPill]}>
                      <TextInput
                        autoFocus
                        style={styles.tagInput}
                        value={tagInput}
                        onChangeText={setTagInput}
                        onBlur={handleSubmitTag}
                        onSubmitEditing={handleSubmitTag}
                        placeholder="..."
                        placeholderTextColor={COLORS.textDim}
                        returnKeyType="done"
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.tagPill, styles.addTagPill]}
                      activeOpacity={0.7}
                      onPress={() => setIsAddingTag(true)}
                    >
                      <Plus size={14} color={COLORS.textDim} />
                      <Text style={styles.addTagText}>{t('screens.confirmSave.addTag')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={COLORS.ink} />
                  ) : (
                    <>
                      <Check color={COLORS.ink} size={18} style={{ marginRight: 6 }} />
                      <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundContainer: {
    flex: 1,
    backgroundColor: COLORS.ink,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  notFoundText: {
    color: COLORS.white,
    fontFamily: FONTS.headline,
    fontSize: 18,
    marginBottom: SPACING.m,
  },
  backHomeBtn: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.ink2,
    borderRadius: RADIUS.full,
  },
  backHomeText: {
    color: COLORS.ember,
    fontFamily: FONTS.bodyMedium,
  },

  heroWrapper: {
    width: '100%',
    height: 320,
    backgroundColor: '#0c0f17',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
  },
  circleIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: 110,
  },
  title: {
    color: COLORS.white,
    fontFamily: FONTS.headline,
    fontSize: 24,
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  locationText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  dotSeparator: {
    color: COLORS.textDim,
    marginHorizontal: 8,
    fontSize: 12,
  },
  timeText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: 14,
  },

  tagsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.xl,
  },
  tagBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: COLORS.ember,
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },

  actionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.xl,
  },
  actionCard: {
    flex: 1,
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionCardLabel: {
    color: COLORS.white,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  deleteCard: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  deleteCardLabel: {
    color: COLORS.danger,
  },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.ink,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  askButton: {
    height: 52,
    backgroundColor: '#002b30',
    borderWidth: 1,
    borderColor: COLORS.ember,
    justifyContent: 'center',
    alignItems: 'center',
  },
  askButtonText: {
    color: COLORS.ember,
    fontFamily: FONTS.headline,
    fontSize: 15,
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0c0f17',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  modalTitle: {
    color: COLORS.white,
    fontFamily: FONTS.headline,
    fontSize: 18,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalFieldGroup: {
    marginTop: SPACING.m,
  },
  inputLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ink2,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    height: 54,
  },
  modalInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    fontFamily: FONTS.bodyMedium,
  },

  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  tagPillText: {
    color: '#00F0FF',
    fontSize: 13,
    fontFamily: FONTS.bodyMedium,
  },
  addTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  addTagText: {
    color: COLORS.textDim,
    fontSize: 13,
    marginLeft: 6,
  },
  tagInputPill: {
    borderWidth: 1,
    borderColor: '#00F0FF',
    minWidth: 70,
  },
  tagInput: {
    color: '#00F0FF',
    fontSize: 13,
    padding: 0,
    height: 18,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: SPACING.xl,
    paddingBottom: SPACING.s,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalCancelText: {
    color: COLORS.textDim,
    fontFamily: FONTS.bodyMedium,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: COLORS.ember,
  },
  modalSaveText: {
    color: COLORS.ink,
    fontFamily: FONTS.bodySemiBold,
  },
  geoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 240, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    borderRadius: RADIUS.s,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: SPACING.l,
  },
  geoBadgeText: {
    flex: 1,
    color: COLORS.white,
    fontFamily: FONTS.body,
    fontSize: 13,
  },
  geoMapLink: {
    color: COLORS.ember,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginLeft: 8,
  },
});
