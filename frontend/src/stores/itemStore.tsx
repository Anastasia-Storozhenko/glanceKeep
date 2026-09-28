import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { deleteItem, getItems, upsertItem } from '../services/itemRepository';
import type { Item } from '../types/item';
import { useUsageStore } from './usageStore';

type ItemStoreValue = {
  items: Item[];
  isLoading: boolean;
  error: Error | null;
  refreshItems: () => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  saveItem: (item: Item) => Promise<void>;
  // eslint-disable-next-line no-unused-vars
  removeItem: (itemId: string) => Promise<void>;
};

type ItemStoreProviderProps = {
  children: ReactNode;
};

const ItemStoreContext = createContext<ItemStoreValue | null>(null);

export function ItemStoreProvider({ children }: ItemStoreProviderProps) {
  const database = useSQLiteContext();
  const { updateUsage } = useUsageStore();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applyItems = useCallback(
    (nextItems: Item[]) => {
      setItems(nextItems);
      updateUsage({ itemsKept: nextItems.length });
    },
    [updateUsage],
  );

  const refreshItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      applyItems(await getItems(database));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError : new Error('Unable to load items'));
    } finally {
      setIsLoading(false);
    }
  }, [applyItems, database]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialItems = async () => {
      try {
        const storedItems = await getItems(database);

        if (isMounted) {
          applyItems(storedItems);
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError : new Error('Unable to load items'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialItems();

    return () => {
      isMounted = false;
    };
  }, [applyItems, database]);

  const saveItem = useCallback(
    async (item: Item) => {
      await upsertItem(database, item);
      await refreshItems();
    },
    [database, refreshItems],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await deleteItem(database, itemId);
      await refreshItems();
    },
    [database, refreshItems],
  );

  const value = useMemo(
    () => ({ error, isLoading, items, refreshItems, removeItem, saveItem }),
    [error, isLoading, items, refreshItems, removeItem, saveItem],
  );

  return <ItemStoreContext.Provider value={value}>{children}</ItemStoreContext.Provider>;
}

export function useItemStore(): ItemStoreValue {
  const store = useContext(ItemStoreContext);

  if (!store) {
    throw new Error('useItemStore must be used within ItemStoreProvider');
  }

  return store;
}
