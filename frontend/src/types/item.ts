export type ItemSource = 'photo' | 'voice';
export type ItemSyncStatus = 'local' | 'pending' | 'synced';

export type ItemGeo = {
  lat: number;
  lng: number;
};

export type Item = {
  id: string;
  source: ItemSource;
  title: string;
  description: string;
  locationText: string;
  geo: ItemGeo | null;
  mediaUri: string;
  transcript: string | null;
  tags: string[];
  aiConfidence: number;
  createdAt: string;
  updatedAt: string | null;
  syncStatus: ItemSyncStatus;
};
