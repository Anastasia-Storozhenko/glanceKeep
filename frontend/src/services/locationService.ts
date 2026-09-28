/* global setTimeout */
import * as Location from 'expo-location';
import { ENV } from '../constants/env';

export type GeoData = {
  lat: number;
  lng: number;
  text: string;
};

export async function getCurrentGeoLocation(): Promise<GeoData | null> {
  if (!ENV.FEATURE_FLAGS.ENABLE_LOCATION) {
    return null;
  }
  try {
    const current = await Location.getForegroundPermissionsAsync();
    let status = current.status;

    if (status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      console.log('Location permission was denied by user');
      return null;
    }

    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));

    const location = await Promise.race([locationPromise, timeoutPromise]);
    if (!location) return null;

    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    let geoText = '';

    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (places && places.length > 0) {
        const place = places[0];
        const city = place.city || place.subregion || place.region || '';
        const street = place.street
          ? `${place.street}${place.streetNumber ? `, ${place.streetNumber}` : ''}`
          : '';
        geoText = [street, city].filter(Boolean).join(', ');
      }
    } catch {
      geoText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    return { lat, lng, text: geoText };
  } catch (err) {
    console.warn('Location error:', err);
    return null;
  }
}
