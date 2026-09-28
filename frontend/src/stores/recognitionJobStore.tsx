/* global setInterval, clearInterval */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { getActiveLanguage } from '../i18n';
import { getItem, getPendingItems, upsertItem } from '../services/itemRepository';
import { getCurrentGeoLocation, type GeoData } from '../services/locationService';
import {
  RecognitionProviderError,
  recognitionProvider,
  type RecognitionInput,
  type RecognitionResult,
} from '../services/recognition';
import type { Item } from '../types/item';
import { useItemStore } from './itemStore';
import { useUsageStore } from './usageStore';

export type RecognitionJobStatus = 'processing' | 'pending' | 'recognized' | 'unrecognized';

export type RecognitionJob = {
  geo: GeoData | null;
  geoResolved: boolean;
  id: string;
  input: RecognitionInput;
  result: RecognitionResult | null;
  status: RecognitionJobStatus;
};

export type ProtectedRecognitionFields = {
  locationText: boolean;
  tags: boolean;
  title: boolean;
};

type SavedItemAttachment = {
  baseline: Pick<Item, 'locationText' | 'tags' | 'title'>;
  itemId: string;
  protectedFields: ProtectedRecognitionFields;
};

type RecognitionJobStoreValue = {
  attachSavedItem: (
    // eslint-disable-next-line no-unused-vars
    jobId: string,
    // eslint-disable-next-line no-unused-vars
    item: Item,
    // eslint-disable-next-line no-unused-vars
    protectedFields: ProtectedRecognitionFields,
  ) => Promise<void>;
  jobs: Record<string, RecognitionJob>;
  // eslint-disable-next-line no-unused-vars
  startRecognition: (input: RecognitionInput) => string;
};

const RETRY_INTERVAL_MS = 30_000;
const RecognitionJobStoreContext = createContext<RecognitionJobStoreValue | null>(null);

function sameTags(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof RecognitionProviderError) ||
    error.code === 'provider_unavailable' ||
    error.code === 'request_timeout' ||
    error.code === 'unknown'
  );
}

export function RecognitionJobStoreProvider({ children }: { children: ReactNode }) {
  const database = useSQLiteContext();
  const { refreshItems } = useItemStore();
  const { updateRecognitionUsage } = useUsageStore();
  const [jobs, setJobs] = useState<Record<string, RecognitionJob>>({});
  const jobsRef = useRef<Record<string, RecognitionJob>>({});
  const attachmentsRef = useRef<Record<string, SavedItemAttachment>>({});
  const runningJobsRef = useRef(new Set<string>());

  const putJob = useCallback((job: RecognitionJob) => {
    jobsRef.current = { ...jobsRef.current, [job.id]: job };
    setJobs(jobsRef.current);
  }, []);

  const applyResultToSavedItem = useCallback(
    async (job: RecognitionJob) => {
      const attachment = attachmentsRef.current[job.id];
      if (!attachment) return;

      const current = await getItem(database, attachment.itemId);
      if (!current) return;

      const currentWithGeo =
        job.geo && !current.geo
          ? { ...current, geo: { lat: job.geo.lat, lng: job.geo.lng } }
          : current;
      const geoWasAdded = currentWithGeo !== current;

      if (job.status === 'pending' || job.status === 'processing') {
        if (current.syncStatus !== 'pending' || geoWasAdded) {
          await upsertItem(database, { ...currentWithGeo, syncStatus: 'pending' });
          await refreshItems();
        }
        return;
      }

      if (job.status === 'unrecognized' || !job.result) {
        await upsertItem(database, { ...currentWithGeo, syncStatus: 'local' });
        await refreshItems();
        return;
      }

      const titleWasChanged = currentWithGeo.title !== attachment.baseline.title;
      const locationWasChanged = currentWithGeo.locationText !== attachment.baseline.locationText;
      const tagsWereChanged = !sameTags(currentWithGeo.tags, attachment.baseline.tags);

      await upsertItem(database, {
        ...currentWithGeo,
        aiConfidence: job.result.confidence,
        locationText:
          attachment.protectedFields.locationText || locationWasChanged
            ? currentWithGeo.locationText
            : job.result.locationText,
        tags:
          attachment.protectedFields.tags || tagsWereChanged
            ? currentWithGeo.tags
            : job.result.tags,
        title:
          attachment.protectedFields.title || titleWasChanged
            ? currentWithGeo.title
            : job.result.title,
        transcript:
          currentWithGeo.source === 'voice' ? job.result.transcript : currentWithGeo.transcript,
        syncStatus: 'local',
        updatedAt: new Date().toISOString(),
      });
      await refreshItems();
    },
    [database, refreshItems],
  );

  const runJob = useCallback(
    async (jobId: string) => {
      const currentJob = jobsRef.current[jobId];
      if (!currentJob || runningJobsRef.current.has(jobId)) return;

      runningJobsRef.current.add(jobId);
      const processingJob = { ...currentJob, status: 'processing' as const };
      putJob(processingJob);

      try {
        const response = await recognitionProvider.recognize({
          ...processingJob.input,
          startedAt: Date.now(),
        });
        updateRecognitionUsage(response.usage);

        const completedJob: RecognitionJob = {
          ...jobsRef.current[jobId],
          result: response.status === 'recognized' ? response.result : null,
          status: response.status,
        };
        putJob(completedJob);
        await applyResultToSavedItem(completedJob).catch((error) => {
          console.log('Unable to update saved item from recognition:', error);
        });
      } catch (error) {
        console.log('Recognition job failed:', error);
        const failedJob: RecognitionJob = {
          ...jobsRef.current[jobId],
          result: null,
          status: isRetryable(error) ? 'pending' : 'unrecognized',
        };
        putJob(failedJob);
        await applyResultToSavedItem(failedJob).catch((itemError) => {
          console.log('Unable to update pending recognition item:', itemError);
        });
      } finally {
        runningJobsRef.current.delete(jobId);
      }
    },
    [applyResultToSavedItem, putJob, updateRecognitionUsage],
  );

  const startRecognition = useCallback(
    (input: RecognitionInput) => {
      const jobId = Crypto.randomUUID();
      putJob({
        geo: null,
        geoResolved: false,
        id: jobId,
        input,
        result: null,
        status: 'processing',
      });
      void runJob(jobId);
      void getCurrentGeoLocation().then((geo) => {
        const currentJob = jobsRef.current[jobId];
        if (!currentJob) return;

        const jobWithGeo = { ...currentJob, geo, geoResolved: true };
        putJob(jobWithGeo);
        void applyResultToSavedItem(jobWithGeo).catch((error) => {
          console.log('Unable to attach location to saved item:', error);
        });
      });
      return jobId;
    },
    [applyResultToSavedItem, putJob, runJob],
  );

  const attachSavedItem = useCallback(
    async (jobId: string, item: Item, protectedFields: ProtectedRecognitionFields) => {
      attachmentsRef.current[jobId] = {
        baseline: { locationText: item.locationText, tags: item.tags, title: item.title },
        itemId: item.id,
        protectedFields,
      };

      const job = jobsRef.current[jobId];
      if (job) await applyResultToSavedItem(job);
    },
    [applyResultToSavedItem],
  );

  const retryPending = useCallback(async () => {
    Object.values(jobsRef.current)
      .filter((job) => job.status === 'pending')
      .forEach((job) => void runJob(job.id));

    const pendingItems = await getPendingItems(database);
    pendingItems.forEach((item) => {
      const existingJob = Object.values(jobsRef.current).find(
        (job) => attachmentsRef.current[job.id]?.itemId === item.id,
      );
      if (existingJob) return;

      const jobId = Crypto.randomUUID();
      attachmentsRef.current[jobId] = {
        baseline: { locationText: item.locationText, tags: item.tags, title: item.title },
        itemId: item.id,
        protectedFields: {
          locationText: item.locationText.length > 0,
          tags: item.tags.length > 0,
          title: item.title.length > 0,
        },
      };
      putJob({
        geo: item.geo
          ? {
              lat: item.geo.lat,
              lng: item.geo.lng,
              text: `${item.geo.lat.toFixed(4)}, ${item.geo.lng.toFixed(4)}`,
            }
          : null,
        geoResolved: item.geo !== null,
        id: jobId,
        input: {
          locale: getActiveLanguage(),
          mediaUri: item.mediaUri,
          source: item.source,
        },
        result: null,
        status: 'pending',
      });
      void runJob(jobId);
    });
  }, [database, putJob, runJob]);

  useEffect(() => {
    const retry = () => {
      void retryPending().catch((error) => {
        console.log('Unable to load pending recognition items:', error);
      });
    };

    retry();
    const intervalId = setInterval(retry, RETRY_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') retry();
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [retryPending]);

  const value = useMemo(
    () => ({ attachSavedItem, jobs, startRecognition }),
    [attachSavedItem, jobs, startRecognition],
  );

  return (
    <RecognitionJobStoreContext.Provider value={value}>
      {children}
    </RecognitionJobStoreContext.Provider>
  );
}

export function useRecognitionJobStore(): RecognitionJobStoreValue {
  const store = useContext(RecognitionJobStoreContext);
  if (!store) {
    throw new Error('useRecognitionJobStore must be used within RecognitionJobStoreProvider');
  }
  return store;
}
