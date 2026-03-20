// utils/sounds.ts
import { Audio } from "expo-av";
import { Platform, Vibration } from "react-native";
import { useEffect, useRef } from "react";

export type SoundType =
  | "new_request"
  | "service_accepted"
  | "counteroffer"
  | "on_route"
  | "arrived"
  | "service_complete"
  | "payment_received"
  | "notification";

const VIBRATION_PATTERNS: Record<SoundType, number[]> = {
  new_request:      [0, 200, 100, 200, 100, 400],
  service_accepted: [0, 500],
  counteroffer:     [0, 150, 80, 150],
  on_route:         [0, 300, 100, 300],
  arrived:          [0, 200, 50, 200, 50, 600],
  service_complete: [0, 300, 100, 300, 100, 600],
  payment_received: [0, 100, 50, 100, 50, 400],
  notification:     [0, 200],
};

const SOUND_FILES: Record<SoundType, any> = {
  new_request:      require("../assets/sounds/new-request.wav"),
  service_accepted: require("../assets/sounds/accepted.wav"),
  counteroffer:     require("../assets/sounds/counteroffer.wav"),
  on_route:         require("../assets/sounds/on-route.wav"),
  arrived:          require("../assets/sounds/arrived.wav"),
  service_complete: require("../assets/sounds/complete.wav"),
  payment_received: require("../assets/sounds/payment.wav"),
  notification:     require("../assets/sounds/notification.wav"),
};

const soundCache: Partial<Record<SoundType, Audio.Sound>> = {};
let audioInitialized = false;

async function initAudio() {
  if (audioInitialized) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS:    true,
      staysActiveInBackground: false,
      shouldDuckAndroid:       true,
    });
    audioInitialized = true;
  } catch {}
}

export async function playSound(type: SoundType): Promise<void> {
  try {
    await initAudio();

    // Vibrar
    if (Platform.OS === "android") {
      Vibration.vibrate(VIBRATION_PATTERNS[type]);
    } else {
      Vibration.vibrate();
    }

    // Reproducir desde cache
    if (soundCache[type]) {
      try {
        await soundCache[type]!.setPositionAsync(0);
        await soundCache[type]!.playAsync();
        return;
      } catch {
        try { await soundCache[type]!.unloadAsync(); } catch {}
        delete soundCache[type];
      }
    }

    // Cargar y reproducir
    const { sound } = await Audio.Sound.createAsync(
      SOUND_FILES[type],
      { shouldPlay: true, volume: 1.0 }
    );
    soundCache[type] = sound;

  } catch (err) {
    console.warn(`Sound [${type}] error:`, err);
    Vibration.vibrate(VIBRATION_PATTERNS[type]);
  }
}

export async function preloadSounds(): Promise<void> {
  await initAudio();
  const priority: SoundType[] = ["new_request", "notification", "counteroffer"];
  for (const type of priority) {
    try {
      if (!soundCache[type]) {
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[type]);
        soundCache[type] = sound;
      }
    } catch {}
  }
}

export async function unloadSounds(): Promise<void> {
  for (const sound of Object.values(soundCache)) {
    try { await sound?.unloadAsync(); } catch {}
  }
}

export function useSoundOnChange(type: SoundType, value: any, condition = true) {
  const prevRef = useRef<any>(undefined);
  useEffect(() => {
    if (condition && prevRef.current !== undefined && prevRef.current !== value) {
      playSound(type);
    }
    prevRef.current = value;
  }, [value, condition]);
}
