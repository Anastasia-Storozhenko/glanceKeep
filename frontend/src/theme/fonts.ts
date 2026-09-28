import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import Feather from '@expo/vector-icons/Feather';

export const FONT_ASSETS = {
  ...Feather.font,
  'InstrumentSerif-Regular': InstrumentSerif_400Regular,
  'IBMPlexSans-Regular': IBMPlexSans_400Regular,
  'IBMPlexSans-Medium': IBMPlexSans_500Medium,
  'IBMPlexSans-SemiBold': IBMPlexSans_600SemiBold,
  'IBMPlexMono-Regular': IBMPlexMono_400Regular,
} as const;

export const FONTS = {
  display: 'InstrumentSerif-Regular',
  headline: 'InstrumentSerif-Regular',
  body: 'IBMPlexSans-Regular',
  bodyMedium: 'IBMPlexSans-Medium',
  bodySemiBold: 'IBMPlexSans-SemiBold',
  mono: 'IBMPlexMono-Regular',
} as const;
