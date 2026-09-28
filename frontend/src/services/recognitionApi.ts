/* global AbortController, clearTimeout, fetch, Response, setTimeout */
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { getOrCreateDeviceId } from './deviceIdStorage';
import { ENV } from '../constants/env';
import {
  RECOGNITION_LATENCY_BUDGET_MS,
  RECOGNITION_REQUEST_TIMEOUT_MS,
  RecognitionProviderError,
  type RecognitionErrorCode,
  type RecognitionInput,
  type RecognitionProvider,
  type RecognitionResponse,
  type RecognitionSource,
} from './recognitionProvider';

type ApiRecognitionResponse = {
  request_id: string;
  status: 'recognized' | 'unrecognized';
  result: {
    title: string;
    location_text: string;
    tags: string[];
    transcript: string | null;
    confidence: number;
  };
  usage: {
    used: number;
    limit: number;
    resets_at: string;
    tokens_used?: number;
  };
};

type ApiPresignResponse = {
  s3_key: string;
  upload_url: string;
  headers: Record<string, string | string[]>;
  expires_at: string;
};

type ApiErrorResponse = {
  message?: string;
  code?: string;
};

const configuredApiBaseUrl = ENV.API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error('API_BASE_URL is required.');
}

const apiBaseUrl = configuredApiBaseUrl.replace(/\/$/, '');
const RETRY_DELAY_MS = 150;
const MAX_ATTEMPTS = 2;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

class HttpRecognitionError extends RecognitionProviderError {
  readonly retryable: boolean;

  constructor(message: string, code: RecognitionErrorCode, retryable: boolean) {
    super(message, code);
    this.name = 'HttpRecognitionError';
    this.retryable = retryable;
  }
}

function fileNameFromUri(uri: string): string | null {
  const fileName = uri.split('/').pop();
  return fileName && fileName.includes('.') ? fileName : null;
}

function errorCodeFor(status: number, apiCode?: string): RecognitionErrorCode {
  if (apiCode === 'monthly_limit_reached') {
    return 'monthly_limit_reached';
  }
  if (status === 422) {
    return 'invalid_request';
  }
  if (RETRYABLE_HTTP_STATUSES.has(status)) {
    return 'provider_unavailable';
  }
  return 'unknown';
}

function defaultFileName(source: RecognitionSource): string {
  return source === 'voice' ? 'voice-recording.m4a' : 'item-photo.jpg';
}

function mimeTypeFor(source: RecognitionSource, file: File, fileName: string): string {
  if (file.type) {
    return file.type;
  }

  const extension = fileName.split('.').pop()?.toLowerCase();

  if (source === 'photo') {
    return (
      {
        heic: 'image/heic',
        heif: 'image/heif',
        png: 'image/png',
        webp: 'image/webp',
      }[extension ?? ''] ?? 'image/jpeg'
    );
  }

  return (
    {
      aac: 'audio/aac',
      flac: 'audio/flac',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
    }[extension ?? ''] ?? 'audio/mp4'
  );
}

function normalizeUploadHeaders(
  headers: ApiPresignResponse['headers'],
  mimeType: string,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  Object.entries(headers).forEach(([name, value]) => {
    // Native HTTP clients set Host from upload_url. Setting it manually is
    // restricted on some Android/iOS versions, while it remains signed in URL.
    if (name.toLowerCase() !== 'host') {
      normalized[name] = Array.isArray(value) ? value.join(', ') : value;
    }
  });

  if (!Object.keys(normalized).some((name) => name.toLowerCase() === 'content-type')) {
    normalized['Content-Type'] = mimeType;
  }

  return normalized;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function canRetry(error: unknown): boolean {
  if (error instanceof HttpRecognitionError) {
    return error.retryable;
  }

  return !(error instanceof RecognitionProviderError) && !isAbortError(error);
}

export class ApiRecognitionProvider implements RecognitionProvider {
  async recognize(input: RecognitionInput): Promise<RecognitionResponse> {
    try {
      return await this.sendWithRetry(input);
    } catch (error) {
      if (error instanceof RecognitionProviderError) {
        throw error;
      }
      throw new RecognitionProviderError(
        error instanceof Error ? error.message : 'Recognition provider is unavailable.',
        'provider_unavailable',
      );
    }
  }

  private async sendWithRetry(input: RecognitionInput): Promise<RecognitionResponse> {
    const startedAt = input.startedAt ?? Date.now();
    const retryDeadlineAt = startedAt + RECOGNITION_LATENCY_BUDGET_MS;
    const timeoutAt = startedAt + RECOGNITION_REQUEST_TIMEOUT_MS;
    const deviceId = await getOrCreateDeviceId();
    const mediaFile = new File(input.mediaUri);
    const fileName =
      input.fileName ?? fileNameFromUri(input.mediaUri) ?? defaultFileName(input.source);
    const idempotencyKey = randomUUID();

    if (!mediaFile.exists || mediaFile.size <= 0) {
      throw new RecognitionProviderError('The media file is unavailable.', 'invalid_request');
    }

    return this.sendStoredMediaWithRetry(
      input,
      deviceId,
      mediaFile,
      fileName,
      idempotencyKey,
      retryDeadlineAt,
      timeoutAt,
    );
  }

  private async sendStoredMediaWithRetry(
    input: RecognitionInput,
    deviceId: string,
    mediaFile: File,
    fileName: string,
    idempotencyKey: string,
    retryDeadlineAt: number,
    timeoutAt: number,
  ): Promise<RecognitionResponse> {
    const mimeType = mimeTypeFor(input.source, mediaFile, fileName);
    const upload = await this.runWithRetry(
      (remainingMilliseconds) =>
        this.requestPresignedUpload(
          input.source,
          deviceId,
          mimeType,
          mediaFile.size,
          remainingMilliseconds,
        ),
      retryDeadlineAt,
      timeoutAt,
    );

    await this.runWithRetry(
      (remainingMilliseconds) =>
        this.uploadToPrivateStorage(mediaFile, upload, mimeType, remainingMilliseconds),
      retryDeadlineAt,
      timeoutAt,
    );

    return this.runWithRetry(
      (remainingMilliseconds) =>
        this.sendStoredMediaAttempt(
          input,
          deviceId,
          upload.s3_key,
          idempotencyKey,
          remainingMilliseconds,
        ),
      retryDeadlineAt,
      timeoutAt,
    );
  }

  private async runWithRetry<T>(
    // eslint-disable-next-line no-unused-vars
    operation: (remainingMilliseconds: number) => Promise<T>,
    retryDeadlineAt: number,
    timeoutAt: number,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const remainingMilliseconds = timeoutAt - Date.now();

      if (remainingMilliseconds <= 0) {
        throw this.timeoutError();
      }

      try {
        return await operation(remainingMilliseconds);
      } catch (error) {
        if (isAbortError(error) || Date.now() >= timeoutAt) {
          throw this.timeoutError();
        }

        const retryDelayFitsDeadline = Date.now() + RETRY_DELAY_MS < retryDeadlineAt;
        const hasAnotherAttempt = attempt < MAX_ATTEMPTS;

        if (!canRetry(error) || !hasAnotherAttempt || !retryDelayFitsDeadline) {
          throw error;
        }

        await delay(RETRY_DELAY_MS);
      }
    }

    throw new RecognitionProviderError(
      'Recognition provider is unavailable.',
      'provider_unavailable',
    );
  }

  private async requestPresignedUpload(
    source: RecognitionSource,
    deviceId: string,
    mimeType: string,
    contentLength: number,
    timeoutMilliseconds: number,
  ): Promise<ApiPresignResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      const response = await fetch(`${apiBaseUrl}/uploads/presign`, {
        body: JSON.stringify({
          content_length: contentLength,
          content_type: mimeType,
          source,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Device-Id': deviceId,
        },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.throwResponseError(response);
      }

      const data = (await response.json()) as Partial<ApiPresignResponse>;

      if (
        typeof data.s3_key !== 'string' ||
        typeof data.upload_url !== 'string' ||
        data.headers === null ||
        typeof data.headers !== 'object'
      ) {
        throw new RecognitionProviderError(
          'The media upload response is invalid.',
          'provider_unavailable',
        );
      }

      return data as ApiPresignResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async uploadToPrivateStorage(
    mediaFile: File,
    upload: ApiPresignResponse,
    mimeType: string,
    timeoutMilliseconds: number,
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      const response = await mediaFile.upload(upload.upload_url, {
        headers: normalizeUploadHeaders(upload.headers, mimeType),
        httpMethod: 'PUT',
        mimeType,
        signal: controller.signal,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new HttpRecognitionError(
          `Media upload failed with HTTP ${response.status}.`,
          response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
          RETRYABLE_HTTP_STATUSES.has(response.status),
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sendStoredMediaAttempt(
    input: RecognitionInput,
    deviceId: string,
    s3Key: string,
    idempotencyKey: string,
    timeoutMilliseconds: number,
  ): Promise<RecognitionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      const response = await fetch(`${apiBaseUrl}/recognize`, {
        body: JSON.stringify({
          locale: input.locale,
          s3_key: s3Key,
          source: input.source,
        }),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          'X-Device-Id': deviceId,
        },
        method: 'POST',
        signal: controller.signal,
      });

      return await this.parseResponse(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseResponse(response: Response): Promise<RecognitionResponse> {
    if (!response.ok) {
      await this.throwResponseError(response);
    }

    const data = (await response.json()) as ApiRecognitionResponse;

    return {
      requestId: data.request_id,
      status: data.status,
      result: {
        confidence: data.result.confidence,
        locationText: data.result.location_text,
        tags: data.result.tags,
        title: data.result.title,
        transcript: data.result.transcript,
      },
      usage: {
        authority: apiBaseUrl,
        limit: data.usage.limit,
        resetsAt: data.usage.resets_at,
        tokensUsed: data.usage.tokens_used,
        used: data.usage.used,
      },
    };
  }

  private async throwResponseError(response: Response): Promise<never> {
    let error: ApiErrorResponse = {};
    try {
      error = (await response.json()) as ApiErrorResponse;
    } catch {
      // The status code still provides a useful fallback when the body is not JSON.
    }

    throw new HttpRecognitionError(
      error.message ?? `Recognition request failed with HTTP ${response.status}.`,
      errorCodeFor(response.status, error.code),
      RETRYABLE_HTTP_STATUSES.has(response.status) || error.code === 'request_in_progress',
    );
  }

  private timeoutError(): RecognitionProviderError {
    return new RecognitionProviderError(
      'Recognition request timed out. Please try again.',
      'request_timeout',
    );
  }
}
