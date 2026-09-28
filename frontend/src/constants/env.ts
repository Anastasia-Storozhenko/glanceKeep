import Constants from 'expo-constants';

interface AppExtraConfig {
  apiBaseUrl?: string;
  featureFlags?: {
    enablePhotoCapture?: boolean;
    enableVoiceCapture?: boolean;
    enableLocation?: boolean;
  };
}

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtraConfig;

export const ENV = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? '',
  FEATURE_FLAGS: {
    ENABLE_PHOTO_CAPTURE: extra.featureFlags?.enablePhotoCapture ?? true,
    ENABLE_VOICE_CAPTURE: extra.featureFlags?.enableVoiceCapture ?? true,
    ENABLE_LOCATION: extra.featureFlags?.enableLocation ?? true,
  },
} as const;

export default ENV;
