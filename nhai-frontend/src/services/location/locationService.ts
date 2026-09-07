/**
 * locationService — Gets GPS for audit trail.
 * Requests permission inline if not yet granted.
 */

export interface Coords { latitude: number; longitude: number; }

export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    const Location = require('expo-location') as {
      getForegroundPermissionsAsync: () => Promise<{ status: string }>;
      requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
      getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{ coords: { latitude: number; longitude: number } }>;
      Accuracy: { Balanced: number };
    };

    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[Location] Permission denied');
      return null;
    }

    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    console.log(`[Location] Got GPS: ${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`);
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch (e) {
    console.log('[Location] Error:', e);
    return null;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const Location = require('expo-location') as {
      requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
    };
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}
