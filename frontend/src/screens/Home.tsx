import React, { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Mic, Settings as SettingsIcon, Layout, MapPin } from 'lucide-react-native';
import { ActionBar } from '../components/ActionBar';
import { StatCard } from '../components/StatCard';
import type { RootStackParamList } from '../navigation/types';
import { useItemStore } from '../stores/itemStore';
import { useUsageStore } from '../stores/usageStore';
import { COLORS, FONTS, FONT_SIZE, RADIUS, SPACING } from '../theme';
import type { TFunction } from 'i18next';
import { ENV } from '../constants/env';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

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

export function Home({ navigation }: HomeProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { error, isLoading, items, refreshItems } = useItemStore();
  const { itemsKept, monthlyRequestLimit, monthlyRequestsUsed, plan, tokensUsed } = useUsageStore();

  useFocusEffect(
    useCallback(() => {
      void refreshItems();
    }, [refreshItems]),
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.topbar}>
        <Text accessibilityRole="header" style={styles.brand}>
          {t('screens.home.brand', 'GLANCEKEEP')}
        </Text>

        <Pressable
          accessibilityLabel={t('screens.home.settings')}
          accessibilityRole="button"
          hitSlop={SPACING.s}
          onPress={() => navigation.navigate('Settings')}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
        >
          <SettingsIcon color={COLORS.textDim} size={20} />
        </Pressable>
      </View>

      <FlatList
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {plan === 'free' ? (
              <>
                <StatCard
                  accessibilityHint={t('screens.home.planHint')}
                  itemsKept={itemsKept}
                  onPress={() => navigation.navigate('Paywall')}
                  requestLimit={monthlyRequestLimit}
                  requestsUsed={monthlyRequestsUsed}
                  tokensUsed={tokensUsed}
                  variant="free"
                />

                <View style={styles.adBanner}>
                  <Layout color={COLORS.textDim} size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.adBannerText}>{t('screens.home.adBanner')}</Text>
                </View>
              </>
            ) : (
              <StatCard
                accessibilityHint={t('screens.home.managePlanHint')}
                itemsKept={itemsKept}
                onPress={() => navigation.navigate('ManageSubscription')}
                tokensUsed={tokensUsed}
                variant="paid"
              />
            )}

            <Text style={styles.recentTitle}>{t('screens.home.recent')}</Text>
          </View>
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
        data={items}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            {isLoading ? (
              <>
                <ActivityIndicator color={COLORS.ember} />
                <Text style={styles.emptyDescription}>{t('screens.home.loadingItems')}</Text>
              </>
            ) : error ? (
              <>
                <Text style={styles.emptyTitle}>{t('screens.home.loadError')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void refreshItems()}
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <Text style={styles.retryLabel}>{t('screens.home.retry')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>{t('screens.home.emptyTitle')}</Text>
                <Text style={styles.emptyDescription}>{t('screens.home.emptyDescription')}</Text>
              </>
            )}
          </View>
        }
        onRefresh={() => void refreshItems()}
        refreshing={isLoading && items.length > 0}
        renderItem={({ item }) => {
          const title = item.title || t('screens.home.untitledItem');
          const location =
            item.syncStatus === 'pending' ? t('screens.home.processingItem') : item.locationText;

          return (
            <Pressable
              accessibilityLabel={t('screens.home.itemAccessibilityLabel', { location, title })}
              onPress={() => navigation.navigate('ItemDetail', { itemId: item.id })}
              style={({ pressed }) => [styles.itemCard, pressed && styles.pressedCard]}
            >
              <View style={styles.iconWrapper}>
                <View style={styles.iconContainer}>
                  {item.source === 'photo' ? (
                    <Camera color={COLORS.textDim} size={20} strokeWidth={1.75} />
                  ) : (
                    <Mic color={COLORS.textDim} size={20} strokeWidth={1.75} />
                  )}
                </View>
                {item.geo !== null && (
                  <View style={styles.geoBadge}>
                    <MapPin color="#0c0f17" size={10} strokeWidth={2.5} />
                  </View>
                )}
              </View>

              <View style={styles.itemDetails}>
                <Text numberOfLines={1} style={styles.itemTitle}>
                  {item.source === 'voice' && !location ? `"${title}"` : title}
                  {location ? (
                    <>
                      <Text style={styles.itemDash}> — </Text>
                      <Text style={styles.itemLocation}>{location}</Text>
                    </>
                  ) : null}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.source === 'photo'
                        ? (t('components.actionBar.photo') as string).toUpperCase()
                        : (t('components.actionBar.voice') as string).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.timeText}>
                    {getRelativeTime(item.updatedAt || item.createdAt, t)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        showsVerticalScrollIndicator={false}
      />

      <ActionBar
        onPhotoPress={
          ENV.FEATURE_FLAGS.ENABLE_PHOTO_CAPTURE
            ? () => navigation.navigate('CapturePhoto')
            : () => {}
        }
        onSearchPress={() => navigation.navigate('Search')}
        onVoicePress={
          ENV.FEATURE_FLAGS.ENABLE_VOICE_CAPTURE
            ? () => navigation.navigate('CaptureVoice')
            : () => {}
        }
        style={[styles.actionBar, { paddingBottom: SPACING.s + insets.bottom }]}
        testID="home-action-bar"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: COLORS.ink,
    flex: 1,
  },
  topbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  brand: {
    color: COLORS.white,
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: 2,
  },
  settingsButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.65,
  },
  pressedCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  listContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.s,
  },
  listHeader: {
    gap: SPACING.m,
    paddingBottom: SPACING.m,
  },

  adBanner: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginVertical: SPACING.xs,
  },
  adBannerText: {
    color: COLORS.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.5,
  },

  recentTitle: {
    color: COLORS.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: SPACING.s,
    textTransform: 'uppercase',
  },

  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0f17',
    padding: SPACING.m,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 14,
  },
  iconWrapper: {
    position: 'relative',
  },

  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemTitle: {
    color: COLORS.white,
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  itemLocation: {
    color: COLORS.white,
    fontFamily: FONTS.body,
    fontSize: 15,
  },
  itemDash: {
    color: COLORS.textDim,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },

  badge: {
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    color: '#00f0ff',
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  timeText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontFamily: FONTS.body,
  },

  itemSeparator: {
    height: SPACING.s,
  },

  emptyState: {
    alignItems: 'center',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.headline,
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
  },
  emptyDescription: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
    lineHeight: 21,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
  },
  retryLabel: {
    color: COLORS.ember,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  geoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0c0f17',
  },
});
