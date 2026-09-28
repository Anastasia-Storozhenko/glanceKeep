export type RecognitionSource = 'photo' | 'voice';

export const RECOGNITION_LATENCY_BUDGET_MS = 2_000;
export const RECOGNITION_REQUEST_TIMEOUT_MS = 5_000;

export type RecognitionInput = {
  source: RecognitionSource;
  mediaUri: string;
  locale: string;
  fileName?: string;
  startedAt?: number;
};

export type RecognitionResult = {
  title: string;
  locationText: string;
  tags: string[];
  transcript: string | null;
  confidence: number;
};

export type RecognitionUsage = {
  used: number;
  limit: number;
  resetsAt: string;
  tokensUsed?: number;
  authority: string;
};

export type RecognitionResponse = {
  requestId: string;
  status: 'recognized' | 'unrecognized';
  result: RecognitionResult;
  usage: RecognitionUsage;
};

export type RecognitionErrorCode =
  | 'invalid_request'
  | 'monthly_limit_reached'
  | 'provider_unavailable'
  | 'request_timeout'
  | 'unknown';

export class RecognitionProviderError extends Error {
  readonly code: RecognitionErrorCode;

  constructor(message: string, code: RecognitionErrorCode = 'unknown') {
    super(message);
    this.name = 'RecognitionProviderError';
    this.code = code;
  }
}

export interface RecognitionProvider {
  // eslint-disable-next-line no-unused-vars
  recognize(input: RecognitionInput): Promise<RecognitionResponse>;
}
