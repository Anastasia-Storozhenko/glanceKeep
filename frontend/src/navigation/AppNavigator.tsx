import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

// Імпортуємо всі екрани
import { Onboarding } from '../screens/Onboarding';
import { Home } from '../screens/Home';
import { CapturePhoto } from '../screens/CapturePhoto';
import { CaptureVoice } from '../screens/CaptureVoice';
import { ConfirmSave } from '../screens/ConfirmSave';
import { Search } from '../screens/Search';
import { ItemDetail } from '../screens/ItemDetail';
import { Paywall } from '../screens/Paywall';
import { ManageSubscription } from '../screens/ManageSubscription';
import { Settings } from '../screens/Settings';
import { Login } from '../screens/Login';

const Stack = createNativeStackNavigator<RootStackParamList>();

type AppNavigatorProps = {
  initialRouteName: 'Onboarding' | 'Home';
};

export const AppNavigator = ({ initialRouteName }: AppNavigatorProps) => {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Onboarding" component={Onboarding} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="CapturePhoto" component={CapturePhoto} options={{ headerShown: false }} />
      <Stack.Screen name="CaptureVoice" component={CaptureVoice} />
      <Stack.Screen name="ConfirmSave" component={ConfirmSave} />
      <Stack.Screen name="Search" component={Search} />
      <Stack.Screen name="ItemDetail" component={ItemDetail} />
      <Stack.Screen name="Paywall" component={Paywall} />
      <Stack.Screen name="ManageSubscription" component={ManageSubscription} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="Login" component={Login} />
    </Stack.Navigator>
  );
};
