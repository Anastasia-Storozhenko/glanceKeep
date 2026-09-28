import type { SQLiteDatabase } from 'expo-sqlite';
import type { Item, ItemSource, ItemSyncStatus } from '../types/item';

const DATABASE_VERSION = 5;

type ItemRow = {
  id: string;
  source: ItemSource;
  title: string;
  description: string;
  location_text: string;
  geo_lat: number | null;
  geo_lng: number | null;
  media_uri: string;
  transcript: string | null;
  tags_json: string;
  ai_confidence: number;
  created_at: string;
  updated_at: string | null;
  sync_status: ItemSyncStatus;
};

export async function initializeItemDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('photo', 'voice')),
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        location_text TEXT NOT NULL DEFAULT '',
        geo_lat REAL,
        geo_lng REAL,
        media_uri TEXT NOT NULL,
        transcript TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        ai_confidence REAL NOT NULL DEFAULT 0 CHECK (ai_confidence >= 0 AND ai_confidence <= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced'))
      );

      CREATE INDEX IF NOT EXISTS items_recency_index
        ON items (updated_at DESC, created_at DESC);
    `);
  }

  if (currentVersion === 1) {
    await database.execAsync(`
      ALTER TABLE items
      ADD COLUMN description TEXT NOT NULL DEFAULT '';
    `);
  }

  if (currentVersion < 3) {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS account_usage (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        account_id TEXT,
        auth_provider TEXT NOT NULL DEFAULT 'none'
          CHECK (auth_provider IN ('none', 'email', 'apple', 'google')),
        plan TEXT NOT NULL DEFAULT 'free'
          CHECK (plan IN ('free', 'premium')),
        billing_period TEXT
          CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'yearly')),
        requests_used INTEGER NOT NULL DEFAULT 0 CHECK (requests_used >= 0),
        request_limit INTEGER NOT NULL DEFAULT 20 CHECK (request_limit >= 0),
        tokens_used INTEGER NOT NULL DEFAULT 0 CHECK (tokens_used >= 0)
      );
    `);
  }

  if (currentVersion < 4) {
    await database.execAsync(`
      ALTER TABLE account_usage
      ADD COLUMN resets_at TEXT;
    `);
  }

  if (currentVersion < 5) {
    await database.execAsync(`
      ALTER TABLE account_usage
      ADD COLUMN usage_authority TEXT;
    `);
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

export async function getItems(database: SQLiteDatabase): Promise<Item[]> {
  const rows = await database.getAllAsync<ItemRow>(`
    SELECT *
    FROM items
    ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
  `);

  return rows.map(mapItemRow);
}

export async function getItem(database: SQLiteDatabase, itemId: string): Promise<Item | null> {
  const row = await database.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', itemId);

  return row ? mapItemRow(row) : null;
}

export async function getPendingItems(database: SQLiteDatabase): Promise<Item[]> {
  const rows = await database.getAllAsync<ItemRow>(
    `SELECT * FROM items
     WHERE sync_status = 'pending'
     ORDER BY COALESCE(updated_at, created_at) ASC`,
  );

  return rows.map(mapItemRow);
}

export async function upsertItem(database: SQLiteDatabase, item: Item): Promise<void> {
  await database.runAsync(
    `
      INSERT INTO items (
        id, source, title, description, location_text, geo_lat, geo_lng, media_uri,
        transcript, tags_json, ai_confidence, created_at, updated_at, sync_status
      ) VALUES (
        $id, $source, $title, $description, $locationText, $geoLat, $geoLng, $mediaUri,
        $transcript, $tagsJson, $aiConfidence, $createdAt, $updatedAt, $syncStatus
      )
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        title = excluded.title,
        description = excluded.description,
        location_text = excluded.location_text,
        geo_lat = excluded.geo_lat,
        geo_lng = excluded.geo_lng,
        media_uri = excluded.media_uri,
        transcript = excluded.transcript,
        tags_json = excluded.tags_json,
        ai_confidence = excluded.ai_confidence,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
    `,
    {
      $aiConfidence: item.aiConfidence,
      $createdAt: item.createdAt,
      $description: item.description,
      $geoLat: item.geo?.lat ?? null,
      $geoLng: item.geo?.lng ?? null,
      $id: item.id,
      $locationText: item.locationText,
      $mediaUri: item.mediaUri,
      $source: item.source,
      $syncStatus: item.syncStatus,
      $tagsJson: JSON.stringify(item.tags),
      $title: item.title,
      $transcript: item.transcript,
      $updatedAt: item.updatedAt,
    },
  );
}

export async function deleteItem(database: SQLiteDatabase, itemId: string): Promise<void> {
  await database.runAsync('DELETE FROM items WHERE id = ?', itemId);
}

function mapItemRow(row: ItemRow): Item {
  return {
    aiConfidence: row.ai_confidence,
    createdAt: row.created_at,
    description: row.description,
    geo:
      row.geo_lat !== null && row.geo_lng !== null ? { lat: row.geo_lat, lng: row.geo_lng } : null,
    id: row.id,
    locationText: row.location_text,
    mediaUri: row.media_uri,
    source: row.source,
    syncStatus: row.sync_status,
    tags: parseTags(row.tags_json),
    title: row.title,
    transcript: row.transcript,
    updatedAt: row.updated_at,
  };
}

function parseTags(value: string): string[] {
  try {
    const tags: unknown = JSON.parse(value);

    return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export async function searchItems(database: SQLiteDatabase, query: string): Promise<Item[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const rows = await database.getAllAsync<ItemRow>(`
    SELECT * FROM items
    ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
  `);

  const needle = normalizeForSearch(trimmed);

  return rows.map(mapItemRow).filter((item) => {
    const haystack = [item.title, item.locationText, item.transcript ?? '', ...item.tags].join(' ');
    return normalizeForSearch(haystack).includes(needle);
  });
}

function normalizeForSearch(value: string): string {
  return value.normalize('NFC').toLowerCase();
}
