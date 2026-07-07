// Plays a looping alert chime + repeats haptic pulses while a rider has an
// incoming delivery request on screen, so they notice it even if the phone
// isn't in hand or the screen is dim. Stops as soon as `active` goes false
// (on accept, decline, or timeout).
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';

const ALERT_SOUND = require('@/assets/sounds/alert.wav');
const HAPTIC_INTERVAL_MS = 1200;

export function useIncomingRequestAlert(active: boolean) {
  const player = useAudioPlayer(ALERT_SOUND);
  const hapticTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      hapticTimer.current && clearInterval(hapticTimer.current);
      hapticTimer.current = null;
      try {
        player.pause();
        player.seekTo(0);
      } catch {}
      return;
    }

    // Sound: loop the short chime for as long as the request is on screen.
    try {
      player.loop = true;
      player.seekTo(0);
      player.play();
    } catch {}

    // Haptics: repeat a heavy pulse so it's felt even with sound off/muted.
    const pulse = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };
    pulse();
    hapticTimer.current = setInterval(pulse, HAPTIC_INTERVAL_MS);

    return () => {
      hapticTimer.current && clearInterval(hapticTimer.current);
      hapticTimer.current = null;
      try {
        player.pause();
        player.seekTo(0);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
