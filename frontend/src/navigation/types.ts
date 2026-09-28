type ConfirmAiParams = {
  title: string;
  locationText: string;
  tags: string[];
  recognitionJobId: string;
  aiTitle?: string;
  aiLocation?: string;
  aiTags?: string[];
  isAiLoading?: boolean;
  confidence?: number;
  matchedItem?: {
    id: string;
    title: string;
    lastLocation: string;
    createdAt: string;
  } | null;
  geoText?: string;
  geoLat?: number | null;
  geoLng?: number | null;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  CapturePhoto: undefined;
  CaptureVoice: undefined;
  ConfirmSave:
    | ({
        source: 'photo';
        uri: string;
        title: string;
        locationText: string;
        tags: string[];
      } & ConfirmAiParams)
    | ({
        source: 'voice';
        audioUri: string;
        transcript: string | null;
      } & ConfirmAiParams);
  Search: { initialQuery?: string } | undefined;
  ItemDetail: { itemId: string };
  Paywall: undefined;
  ManageSubscription: undefined;
  Settings: undefined;
  Login: undefined;
};
