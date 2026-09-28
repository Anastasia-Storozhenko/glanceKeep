import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';

const mediaDirectory = new Directory(Paths.document, 'captured-media');

function extensionFromUri(uri: string, fallback: string): string {
  const path = uri.split('?')[0];
  const extension = path.split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : fallback;
}

export async function persistPhoto(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith(Paths.document.uri)) return sourceUri;

  mediaDirectory.create({ idempotent: true, intermediates: true });
  const destination = new File(
    mediaDirectory,
    `${Crypto.randomUUID()}.${extensionFromUri(sourceUri, 'jpg')}`,
  );
  await new File(sourceUri).copy(destination);

  return destination.uri;
}
