// utils/sounds.ts
// Sonidos usando expo-av con archivos locales
// INSTALACIÓN: npx expo install expo-av
// ARCHIVOS: crea la carpeta assets/sounds/ y descarga los mp3 de mixkit.co

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

// ── Mapeo de archivos locales ─────────────────────────────────────────────
// Descarga estos archivos de https://mixkit.co/free-sound-effects/
// y ponlos en assets/sounds/
const SOUND_FILES: Record<SoundType, any> = {
  new_request:      require("../assets/sounds/new-request.mp3"),
  service_accepted: require("../assets/sounds/accepted.mp3"),
  counteroffer:     require("../assets/sounds/counteroffer.mp3"),
  on_route:         require("../assets/sounds/on-route.mp3"),
  arrived:          require("../assets/sounds/arrived.mp3"),
  service_complete: require("../assets/sounds/complete.mp3"),
  payment_received: require("../assets/sounds/payment.mp3"),
  notification:     require("../assets/sounds/notification.mp3"),
};

// ── Vibración por tipo ────────────────────────────────────────────────────
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

let audioInitialized = false;
const soundCache: Partial<Record<SoundType, Audio.Sound>> = {};

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

    // Reproducir desde cache si existe
    if (soundCache[type]) {
      try {
        await soundCache[type]!.setPositionAsync(0);
        await soundCache[type]!.playAsync();
        return;
      } catch {
        // Si falla el cache, recrear
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

    // Limpiar al terminar
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        // No descargar — mantener en cache para próxima vez
      }
    });
  } catch (err) {
    console.warn(`Sound [${type}] error:`, err);
    // Vibrar igual aunque falle el audio
    Vibration.vibrate(VIBRATION_PATTERNS[type]);
  }
}

export async function preloadSounds(): Promise<void> {
  await initAudio();
  const types: SoundType[] = ["new_request", "service_accepted", "counteroffer", "notification"];
  for (const type of types) {
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

// Hook para sonido en cambio de valor
export function useSoundOnChange(type: SoundType, value: any, condition = true) {
  const prevRef = useRef<any>(undefined);
  useEffect(() => {
    if (condition && prevRef.current !== undefined && prevRef.current !== value) {
      playSound(type);
    }
    prevRef.current = value;
  }, [value, condition]);
}
