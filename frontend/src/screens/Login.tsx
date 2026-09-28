import { useTranslation } from 'react-i18next';
import { ScreenStub } from './ScreenStub';

export const Login = ({ navigation }: any) => {
  const { t } = useTranslation();

  return (
    <ScreenStub
      title={t('screens.login.title')}
      actions={[
        {
          label: t('screens.login.continueWithAccount'),
          onPress: () => navigation.navigate('Settings'),
        },
        {
          label: t('screens.login.continueWithoutAccount'),
          onPress: () => navigation.navigate('Home'),
        },
      ]}
    />
  );
};
