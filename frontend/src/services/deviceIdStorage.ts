import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@glancekeep/device-id';

let pendingDeviceId: Promise<string> | null = null;

function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function createDeviceId(): string {
  const variant = (8 + Math.floor(Math.random() * 4)).toString(16);

  return `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-${variant}${randomHex(3)}-${randomHex(12)}`;
}

async function loadOrCreateDeviceId(): Promise<string> {
  const storedDeviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const deviceId = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);

  return deviceId;
}

export function getOrCreateDeviceId(): Promise<string> {
  pendingDeviceId ??= loadOrCreateDeviceId();

  return pendingDeviceId;
}
