import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initializeItemDatabase } from './src/services/itemRepository';
import { hasCompletedOnboarding } from './src/services/onboardingStorage';
import { ItemStoreProvider } from './src/stores/itemStore';
import { UsageStoreProvider } from './src/stores/usageStore';
import { RecognitionJobStoreProvider } from './src/stores/recognitionJobStore';
import { FONT_ASSETS } from './src/theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://646fcda2fd523600090c972beb2d6283@o4510321706926080.ingest.us.sentry.io/4512085132181504',

  sendDefaultPii: true,

  enableLogs: true,

  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

SplashScreen.preventAutoHideAsync().catch(() => {});

export default Sentry.wrap(function App() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadOnboardingState = async () => {
      try {
        const completed = await hasCompletedOnboarding();

        if (isMounted) {
          setOnboardingCompleted(completed);
        }
      } catch {
        if (isMounted) {
          setOnboardingCompleted(false);
        }
      }
    };

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && onboardingCompleted !== null) {
      SplashScreen.hideAsync().catch(() => {
        // Startup is ready even if the native splash has already been hidden.
      });
    }
  }, [fontsLoaded, fontError, onboardingCompleted]);

  if ((!fontsLoaded && !fontError) || onboardingCompleted === null) {
    return null;
  }

  return (
    <SQLiteProvider databaseName="glancekeep.db" onInit={initializeItemDatabase}>
      <UsageStoreProvider>
        <ItemStoreProvider>
          <RecognitionJobStoreProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator initialRouteName={onboardingCompleted ? 'Home' : 'Onboarding'} />
            </NavigationContainer>
          </RecognitionJobStoreProvider>
        </ItemStoreProvider>
      </UsageStoreProvider>
    </SQLiteProvider>
  );
});
