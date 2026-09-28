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
import { useSQLiteContext } from 'expo-sqlite';
import type { RecognitionUsage } from '../services/recognitionProvider';
import {
  getAccountUsage,
  saveAccountUsage,
  type AuthProvider,
  type BillingPeriod,
  type AccountUsage,
  type PlanType,
} from '../services/accountUsageRepository';

export type { AuthProvider, BillingPeriod, PlanType };

export type UsageState = AccountUsage & {
  itemsKept: number;
};

type UsageStoreValue = UsageState & {
  isHydrated: boolean;
  // eslint-disable-next-line no-unused-vars
  updateRecognitionUsage: (usage: RecognitionUsage) => void;
  // eslint-disable-next-line no-unused-vars
  updateUsage: (usage: Partial<UsageState>) => void;
};

type UsageStoreProviderProps = {
  children: ReactNode;
  initialState?: Partial<UsageState>;
};

export const DEFAULT_USAGE_STATE: UsageState = {
  accountId: null,
  authProvider: 'none',
  billingPeriod: null,
  plan: 'free',
  monthlyRequestsUsed: 0,
  monthlyRequestLimit: 20,
  resetsAt: null,
  tokensUsed: 0,
  usageAuthority: null,
  itemsKept: 0,
};

const UsageStoreContext = createContext<UsageStoreValue | null>(null);

function mergeRecognitionUsage(current: UsageState, next: RecognitionUsage): UsageState {
  if (current.usageAuthority !== next.authority) {
    return {
      ...current,
      monthlyRequestLimit: next.limit,
      monthlyRequestsUsed: next.used,
      resetsAt: next.resetsAt,
      tokensUsed: next.tokensUsed ?? 0,
      usageAuthority: next.authority,
    };
  }

  const currentReset = Date.parse(current.resetsAt ?? '');
  const nextReset = Date.parse(next.resetsAt);

  if (Number.isFinite(currentReset) && Number.isFinite(nextReset) && nextReset < currentReset) {
    return current;
  }

  const samePeriod = current.resetsAt === next.resetsAt;

  return {
    ...current,
    monthlyRequestLimit: next.limit,
    monthlyRequestsUsed: samePeriod ? Math.max(current.monthlyRequestsUsed, next.used) : next.used,
    resetsAt: next.resetsAt,
    usageAuthority: next.authority,
    tokensUsed:
      typeof next.tokensUsed === 'number'
        ? samePeriod
          ? Math.max(current.tokensUsed, next.tokensUsed)
          : next.tokensUsed
        : samePeriod
          ? current.tokensUsed
          : 0,
  };
}

export function UsageStoreProvider({ children, initialState }: UsageStoreProviderProps) {
  const database = useSQLiteContext();
  const pendingUpdateRef = useRef<Partial<UsageState>>({});
  const pendingRecognitionUsageRef = useRef<RecognitionUsage[]>([]);
  const saveQueueRef = useRef(Promise.resolve());
  const [usage, setUsage] = useState<UsageState>(() => ({
    ...DEFAULT_USAGE_STATE,
    ...initialState,
  }));
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const storedUsage = await getAccountUsage(database, DEFAULT_USAGE_STATE);

        if (isMounted) {
          const periodExpired =
            storedUsage.resetsAt !== null && Date.parse(storedUsage.resetsAt) <= Date.now();
          setUsage((currentUsage) => {
            const mergedUsage = {
              ...currentUsage,
              ...storedUsage,
              ...(periodExpired ? { monthlyRequestsUsed: 0, resetsAt: null, tokensUsed: 0 } : {}),
              ...initialState,
              ...pendingUpdateRef.current,
            };

            return pendingRecognitionUsageRef.current.reduce(mergeRecognitionUsage, mergedUsage);
          });
        }
      } catch (error) {
        console.log('Account usage load error:', error);
      } finally {
        if (isMounted) setIsHydrated(true);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [database, initialState]);

  useEffect(() => {
    if (!isHydrated) return;

    const persistedUsage: AccountUsage = {
      accountId: usage.accountId,
      authProvider: usage.authProvider,
      billingPeriod: usage.billingPeriod,
      monthlyRequestLimit: usage.monthlyRequestLimit,
      monthlyRequestsUsed: usage.monthlyRequestsUsed,
      plan: usage.plan,
      resetsAt: usage.resetsAt,
      tokensUsed: usage.tokensUsed,
      usageAuthority: usage.usageAuthority,
    };
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveAccountUsage(database, persistedUsage))
      .catch((error) => {
        console.log('Account usage save error:', error);
      });
  }, [database, isHydrated, usage]);

  const updateUsage = useCallback(
    (nextUsage: Partial<UsageState>) => {
      if (!isHydrated) {
        pendingUpdateRef.current = { ...pendingUpdateRef.current, ...nextUsage };
      }
      setUsage((currentUsage) => ({ ...currentUsage, ...nextUsage }));
    },
    [isHydrated],
  );
  const updateRecognitionUsage = useCallback(
    (nextUsage: RecognitionUsage) => {
      if (!isHydrated) pendingRecognitionUsageRef.current.push(nextUsage);
      setUsage((currentUsage) => mergeRecognitionUsage(currentUsage, nextUsage));
    },
    [isHydrated],
  );
  const value = useMemo(
    () => ({ ...usage, isHydrated, updateRecognitionUsage, updateUsage }),
    [isHydrated, updateRecognitionUsage, updateUsage, usage],
  );

  return <UsageStoreContext.Provider value={value}>{children}</UsageStoreContext.Provider>;
}

export function useUsageStore(): UsageStoreValue {
  const store = useContext(UsageStoreContext);

  if (!store) {
    throw new Error('useUsageStore must be used within UsageStoreProvider');
  }

  return store;
}
