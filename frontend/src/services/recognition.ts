import { ApiRecognitionProvider } from './recognitionApi';
import type { RecognitionProvider } from './recognitionProvider';

export const recognitionProvider: RecognitionProvider = new ApiRecognitionProvider();

export {
  RECOGNITION_LATENCY_BUDGET_MS,
  RECOGNITION_REQUEST_TIMEOUT_MS,
  RecognitionProviderError,
} from './recognitionProvider';
export type {
  RecognitionErrorCode,
  RecognitionInput,
  RecognitionProvider,
  RecognitionResponse,
  RecognitionResult,
  RecognitionSource,
  RecognitionUsage,
} from './recognitionProvider';
