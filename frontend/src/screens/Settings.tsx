import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenStub } from './ScreenStub';

export const Settings = ({ navigation }: any) => {
  const { t } = useTranslation();

  return (
    <ScreenStub
      title={t('screens.settings.title')}
      actions={[
        {
          label: t('screens.settings.logIn'),
          onPress: () => navigation.navigate('Login'),
        },
        {
          label: t('screens.settings.upgrade'),
          onPress: () => navigation.navigate('Paywall'),
        },
        {
          label: t('screens.settings.backHome'),
          onPress: () => navigation.navigate('Home'),
        },
      ]}
    />
  );
};
