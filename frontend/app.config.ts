import { ExpoConfig, ConfigContext } from 'expo/config';

const APP_VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_DEV = APP_VARIANT === 'development';
const IS_PREVIEW = APP_VARIANT === 'preview';

const BASE_IDENTIFIER = 'co.skynix.glancekeep';

function getUniqueIdentifier(): string {
  if (IS_DEV) return `${BASE_IDENTIFIER}.dev`;
  if (IS_PREVIEW) return `${BASE_IDENTIFIER}.preview`;
  return BASE_IDENTIFIER;
}

function getAppName(baseName: string): string {
  if (IS_DEV) return `${baseName} (Dev)`;
  if (IS_PREVIEW) return `${baseName} (Preview)`;
  return baseName;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(config.name ?? 'GlanceKeep'),
  slug: config.slug ?? 'glancekeep',
  ios: {
    ...config.ios,
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    ...config.android,
    package: getUniqueIdentifier(),
  },
  extra: {
    ...config.extra,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    featureFlags: {
      enablePhotoCapture: process.env.FEATURE_PHOTO_CAPTURE !== 'false',
      enableVoiceCapture: process.env.FEATURE_VOICE_CAPTURE !== 'false',
      enableLocation: process.env.FEATURE_LOCATION !== 'false',
    },
  },
});
