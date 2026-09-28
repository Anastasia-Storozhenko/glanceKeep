import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenStub } from './ScreenStub';

export const ManageSubscription = ({ navigation }: any) => {
  const { t } = useTranslation();

  return (
    <ScreenStub
      title={t('screens.manageSubscription.title')}
      actions={[
        {
          label: t('screens.manageSubscription.backHome'),
          onPress: () => navigation.navigate('Home'),
        },
        {
          label: t('screens.manageSubscription.backSettings'),
          onPress: () => navigation.navigate('Settings'),
        },
      ]}
    />
  );
};
