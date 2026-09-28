import 'i18next';
import { en } from './locales/en';

declare module 'i18next' {
  export interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: typeof en;
    returnNull: false;
  }
}
