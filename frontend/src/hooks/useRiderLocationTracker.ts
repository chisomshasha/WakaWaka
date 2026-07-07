// Rider location tracker.
// - On native: request foreground permission, watch GPS, POST every ~5s.
// - On web / no permission / preview: simulate movement. If a target is given,
//   drift toward the target (~30m per tick) so the customer's map shows the
//   rider approaching pickup / dropoff.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const TICK_MS = 5000;
const STEP_METERS = 60; // ~60m per 5s ≈ 43 km/h
const JITTER_METERS = 15;

type ApiFetch = (path: string, opts?: RequestInit) => Promise<any>;
type Target = { lat: number; lng: number } | null;

export function useRiderLocationTracker(opts: {
  enabled: boolean;
  initialLat: number;
  initialLng: number;
  apiFetch: ApiFetch;
  target?: Target;
}) {
  const { enabled, initialLat, initialLng, apiFetch } = opts;
  const posRef = useRef({ lat: initialLat, lng: initialLng });
  const targetRef = useRef<Target>(opts.target || null);
  const watcherRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Keep target ref up to date without restarting the interval
  useEffect(() => {
    targetRef.current = opts.target || null;
  }, [opts.target?.lat, opts.target?.lng]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const post = async (lat: number, lng: number) => {
      try {
        await apiFetch('/riders/location', {
          method: 'POST',
          body: JSON.stringify({ lat, lng }),
        });
      } catch {}
    };

    const tickSimulated = () => {
      if (cancelled) return;
      const t = targetRef.current;
      if (t) {
        // Move a fraction toward target + small jitter
        const dLat = t.lat - posRef.current.lat;
        const dLng = t.lng - posRef.current.lng;
        const distDeg = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distDeg < 0.0001) {
          // Arrived — small jitter only
          posRef.current = {
            lat: posRef.current.lat + ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
            lng: posRef.current.lng + ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
          };
        } else {
          const stepDeg = STEP_METERS / 111_000;
          const factor = Math.min(1, stepDeg / distDeg);
          posRef.current = {
            lat:
              posRef.current.lat +
              dLat * factor +
              ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
            lng:
              posRef.current.lng +
              dLng * factor +
              ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
          };
        }
      } else {
        // Idle drift
        posRef.current = {
          lat:
            posRef.current.lat +
            ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
          lng:
            posRef.current.lng +
            ((Math.random() - 0.5) * JITTER_METERS) / 111_000,
        };
      }
      post(posRef.current.lat, posRef.current.lng);
    };

    const startSimulated = () => {
      timerRef.current = setInterval(tickSimulated, TICK_MS);
    };

    const startNative = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          startSimulated();
          return;
        }
        watcherRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: TICK_MS },
          (loc: any) => {
            const { latitude, longitude } = loc.coords;
            posRef.current = { lat: latitude, lng: longitude };
            post(latitude, longitude);
          }
        );
      } catch {
        startSimulated();
      }
    };

    if (Platform.OS === 'web') startSimulated();
    else startNative();

    // Immediate ping so customer sees rider right away
    post(posRef.current.lat, posRef.current.lng);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (watcherRef.current?.remove) watcherRef.current.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
