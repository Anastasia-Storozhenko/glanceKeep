/* global setTimeout */
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  StatusBar,
  Linking,
  Alert,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as ImagePicker from 'expo-image-picker';
import { X, Zap, Mic, ZapOff, Camera } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, FONT_SIZE, FONTS, GLOW } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '../navigation/types';
import { ENV } from '../constants/env';
import { getActiveLanguage } from '../i18n';
import { persistPhoto } from '../services/mediaStorage';
import { useRecognitionJobStore } from '../stores/recognitionJobStore';
import * as Sentry from '@sentry/react-native';
import { PermissionDeniedScreen } from '../components/PermissionDeniedScreen';

type CapturePhotoProps = NativeStackScreenProps<RootStackParamList, 'CapturePhoto'>;
type PermissionState = 'checking' | 'granted' | 'denied';
type FlashMode = 'off' | 'auto' | 'on';

export const CapturePhoto = ({ navigation }: CapturePhotoProps) => {
  const { t } = useTranslation();

  const { startRecognition } = useRecognitionJobStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [lastPhotoUri, setLastPhotoUri] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isShutterEffect, setIsShutterEffect] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);

  const [libraryPermission, requestLibraryPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });
  const cameraRef = useRef<CameraView>(null);
  const permissionState: PermissionState =
    permission === null ? 'checking' : permission.granted ? 'granted' : 'denied';
  const canAskAgain = permission?.canAskAgain ?? true;

  const [flash, setFlash] = useState<FlashMode>('auto');

  const cycleFlash = () => {
    setFlash((f) => (f === 'off' ? 'auto' : f === 'auto' ? 'on' : 'off'));
  };

  useEffect(() => {
    if (!ENV.FEATURE_FLAGS.ENABLE_PHOTO_CAPTURE) {
      navigation.goBack();
    }
  }, [navigation]);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void requestPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [permission, requestPermission]);

  const recognizeAndNavigate = (uri: string, startedAt = Date.now()) => {
    const recognitionJobId = startRecognition({
      source: 'photo',
      mediaUri: uri,
      locale: getActiveLanguage(),
      startedAt,
    });

    navigation.navigate('ConfirmSave', {
      source: 'photo',
      uri,
      title: '',
      locationText: '',
      tags: [],
      confidence: 0,
      recognitionJobId,
    });
    setIsRecognizing(false);
  };

  const handleMainPermissionAction = async () => {
    if (!permission?.granted) {
      if (!permission?.canAskAgain) {
        await Linking.openSettings();
        return;
      }
      await requestPermission();
      if (!libraryPermission?.granted && libraryPermission?.canAskAgain) {
        await requestLibraryPermission();
      }
    }
  };

  useEffect(() => {
    const loadLastPhoto = async () => {
      if (Platform.OS === 'web') return;
      try {
        const res = await MediaLibrary.getPermissionsAsync(false, ['photo']);
        if (res.status === 'granted') {
          const assets = await MediaLibrary.getAssetsAsync({
            first: 1,
            sortBy: [[MediaLibrary.SortBy.creationTime, false]],
            mediaType: [MediaLibrary.MediaType.photo],
          });
          if (assets?.assets?.length > 0) {
            setLastPhotoUri(assets.assets[0].uri);
          }
        }
      } catch (err) {
        console.log('MediaLibrary load error:', err);
      }
    };
    loadLastPhoto();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current && isCameraReady) {
      const startedAt = Date.now();
      setIsRecognizing(true);

      try {
        setIsShutterEffect(true);
        setTimeout(() => setIsShutterEffect(false), 100);

        const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });

        if (photo) {
          let recognitionUri = photo.uri;

          try {
            const resize = photo.width >= photo.height ? { width: 1024 } : { height: 1024 };
            const compressedPhoto = await manipulateAsync(photo.uri, [{ resize }], {
              compress: 0.6,
              format: SaveFormat.JPEG,
            });
            recognitionUri = compressedPhoto.uri;
          } catch (error) {
            console.log('Photo compression failed:', error);
            Sentry.captureException(error);
          }

          try {
            recognitionUri = await persistPhoto(recognitionUri);
          } catch (error) {
            console.log('Photo persistence failed:', error);
            Sentry.captureException(error);
          }

          setLastPhotoUri(recognitionUri);
          if (Platform.OS !== 'web' && libraryPermission?.granted) {
            void MediaLibrary.saveToLibraryAsync(recognitionUri).catch((error) => {
              console.log('MediaLibrary save error:', error);
            });
          }
          void recognizeAndNavigate(recognitionUri, startedAt);
        }
      } catch (e) {
        console.error(e);
        setIsShutterEffect(false);
        setIsRecognizing(false);
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsRecognizing(true);
        const asset = result.assets[0];
        const startedAt = Date.now();
        let recognitionUri = asset.uri;

        try {
          const resize = asset.width >= asset.height ? { width: 1024 } : { height: 1024 };
          const compressedPhoto = await manipulateAsync(asset.uri, [{ resize }], {
            compress: 0.6,
            format: SaveFormat.JPEG,
          });
          recognitionUri = compressedPhoto.uri;
        } catch (error) {
          console.log('Photo compression failed:', error);
          Sentry.captureException(error);
        }

        try {
          recognitionUri = await persistPhoto(recognitionUri);
        } catch (error) {
          console.log('Photo persistence failed:', error);
          Sentry.captureException(error);
        }

        void recognizeAndNavigate(recognitionUri, startedAt);
      }
    } catch (err) {
      setIsRecognizing(false);
      console.error('Gallery picker error:', err);
      Alert.alert(
        t('screens.capturePhoto.galleryAccessTitle'),
        t('screens.capturePhoto.galleryAccessMessage'),
        [{ text: t('screens.capturePhoto.ok') }],
      );
    }
  };
  if (!ENV.FEATURE_FLAGS.ENABLE_PHOTO_CAPTURE) {
    return null;
  }

  if (permissionState === 'checking') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.ember} />
      </View>
    );
  }

  if (permissionState === 'denied') {
    return (
      <PermissionDeniedScreen
        icon={<Camera color={COLORS.ink} size={30} />}
        titleKey="screens.capturePhoto.title"
        explanationKey="screens.capturePhoto.cameraAccessRequired"
        canAskAgain={canAskAgain}
        onPrimaryPress={handleMainPermissionAction}
        onClose={() => navigation.goBack()}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={StyleSheet.absoluteFill}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          flash={flash}
          onCameraReady={() => setIsCameraReady(true)}
        />

        {isShutterEffect && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: COLORS.white, opacity: 0.8, zIndex: 10 },
            ]}
          />
        )}
        {isRecognizing && (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0,0,0,0.5)',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 20,
              },
            ]}
          >
            <ActivityIndicator size="large" color={COLORS.ember} />
          </View>
        )}
      </View>

      <SafeAreaView style={styles.uiOverlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconCircle}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('screens.capturePhoto.close')}
          >
            <X color={COLORS.white} size={22} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconCircle}
            onPress={cycleFlash}
            accessibilityRole="button"
            accessibilityLabel={t(`screens.capturePhoto.flash.${flash}`)}
            hitSlop={8}
          >
            {flash === 'on' && <Zap color={COLORS.ember} size={20} fill={COLORS.ember} />}
            {flash === 'auto' && (
              <View style={styles.flashAutoWrap}>
                <Zap color={COLORS.ember} size={20} />
                <Text style={styles.flashAutoLabel}>A</Text>
              </View>
            )}
            {flash === 'off' && <ZapOff color={COLORS.white} size={20} />}
          </TouchableOpacity>
        </View>

        <View style={styles.viewfinderContainer} pointerEvents="none">
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.hintText}>{t('screens.capturePhoto.centerHint')}</Text>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.galleryPreview}
            onPress={pickImage}
            disabled={isRecognizing}
          >
            {lastPhotoUri ? (
              <Image
                source={{ uri: lastPhotoUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={{ flex: 1, backgroundColor: COLORS.ink2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.captureButtonOuter,
              (!isCameraReady || isRecognizing || !ENV.FEATURE_FLAGS.ENABLE_PHOTO_CAPTURE) && {
                opacity: 0.5,
              },
            ]}
            onPress={takePicture}
            disabled={!isCameraReady || isRecognizing || !ENV.FEATURE_FLAGS.ENABLE_PHOTO_CAPTURE}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>

          {ENV.FEATURE_FLAGS.ENABLE_VOICE_CAPTURE ? (
            <TouchableOpacity
              style={styles.iconCircle}
              onPress={() => navigation.navigate('CaptureVoice')}
            >
              <Mic color={COLORS.white} size={22} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 48, height: 48 }} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.ink,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  uiOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 260,
    height: 260,
    marginBottom: SPACING.xl,
  },
  hintText: {
    color: COLORS.textDim,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZE.body,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.ember,
    borderWidth: 2.5,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: RADIUS.m * 2,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: RADIUS.m * 2,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: RADIUS.m * 2,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: RADIUS.m * 2,
  },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.l,
  },
  galleryPreview: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.ink2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.inkLine,
  },
  captureButtonOuter: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.full,
    borderWidth: 4,
    borderColor: GLOW.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ember,
  },

  actionLabel: {
    color: COLORS.text,
    fontFamily: FONTS.bodyMedium,
    fontSize: FONT_SIZE.body,
    lineHeight: 20,
  },

  flashAutoWrap: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashAutoLabel: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    fontSize: 9,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.ember,
  },
});
