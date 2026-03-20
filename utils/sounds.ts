// utils/sounds.ts
// Sistema de sonidos para StyleApp usando expo-av
// Instalación: expo install expo-av

import { Audio } from "expo-av";

// ── Tipos de sonidos ──────────────────────────────────────────────────────
export type SoundType =
  | "new_request"       // Nueva solicitud disponible (barbero)
  | "service_accepted"  // Servicio aceptado
  | "counteroffer"      // Nueva contraoferta recibida
  | "on_route"          // Profesional en camino
  | "arrived"           // Profesional llegó
  | "service_complete"  // Servicio finalizado
  | "payment_received"  // Pago recibido
  | "notification";     // Notificación genérica

// Cache de sonidos cargados
const soundCache: Partial<Record<SoundType, Audio.Sound>> = {};

// ── Frecuencias para generar tonos (sin archivos externos) ────────────────
// Usamos la API de Audio para generar sonidos del sistema
// Los URIs apuntan a sonidos incluidos en el APK de Android

const SOUND_CONFIG: Record<SoundType, {
  frequency?: number;
  pattern: number[];   // [ON ms, OFF ms, ON ms, ...]
  description: string;
}> = {
  new_request: {
    pattern: [200, 100, 200, 100, 400],
    description: "Nueva solicitud — 3 beeps ascendentes",
  },
  service_accepted: {
    pattern: [500],
    description: "Aceptado — tono largo positivo",
  },
  counteroffer: {
    pattern: [150, 80, 150],
    description: "Contraoferta — 2 beeps cortos",
  },
  on_route: {
    pattern: [300, 100, 300],
    description: "En camino — 2 tonos medios",
  },
  arrived: {
    pattern: [200, 50, 200, 50, 600],
    description: "Llegada — trino corto + tono largo",
  },
  service_complete: {
    pattern: [300, 100, 300, 100, 300, 100, 600],
    description: "Completado — fanfarria corta",
  },
  payment_received: {
    pattern: [100, 50, 100, 50, 400],
    description: "Pago — tono positivo",
  },
  notification: {
    pattern: [200],
    description: "Notificación genérica",
  },
};

// ── Inicializar modo de audio ─────────────────────────────────────────────
let audioInitialized = false;
async function initAudio() {
  if (audioInitialized) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS:     true,
      staysActiveInBackground:  false,
      shouldDuckAndroid:        true,
    });
    audioInitialized = true;
  } catch (e) {
    console.warn("Audio init error:", e);
  }
}

// ── Usar vibración como fallback ──────────────────────────────────────────
import { Vibration, Platform } from "react-native";

function vibratePattern(pattern: number[]) {
  if (Platform.OS === "android") {
    // Android: patrón de vibración [delay, vibrate, pause, vibrate, ...]
    Vibration.vibrate(pattern);
  } else {
    // iOS: vibración simple
    Vibration.vibrate();
  }
}

// ── Reproducir sonido ─────────────────────────────────────────────────────
export async function playSound(type: SoundType): Promise<void> {
  try {
    await initAudio();
    const config = SOUND_CONFIG[type];

    // Vibrar con el patrón correspondiente
    vibratePattern(config.pattern);

    // Si hay archivo de sonido cargado, reproducirlo
    if (soundCache[type]) {
      try {
        await soundCache[type]!.replayAsync();
        return;
      } catch {
        // Si falla, continuar sin sonido (vibración ya se activó)
      }
    }

    // Intentar reproducir con archivo local si existe
    const soundFiles: Partial<Record<SoundType, any>> = {
      // Agrega aquí tus archivos de sonido locales:
      // new_request:      require("../assets/sounds/new_request.mp3"),
      // service_accepted: require("../assets/sounds/accepted.mp3"),
      // counteroffer:     require("../assets/sounds/counteroffer.mp3"),
      // on_route:         require("../assets/sounds/on_route.mp3"),
      // arrived:          require("../assets/sounds/arrived.mp3"),
      // service_complete: require("../assets/sounds/complete.mp3"),
    };

    if (soundFiles[type]) {
      const { sound } = await Audio.Sound.createAsync(soundFiles[type]);
      soundCache[type] = sound;
      await sound.playAsync();
    }
  } catch (err) {
    // Nunca crashear por un sonido fallido
    console.warn(`Sound error [${type}]:`, err);
  }
}

// ── Precargar todos los sonidos al iniciar la app ─────────────────────────
export async function preloadSounds(): Promise<void> {
  await initAudio();
  // Cuando tengas archivos de sonido, precárgalos aquí
  console.log("Sounds ready (vibration mode)");
}

// ── Limpiar sonidos al desmontar ──────────────────────────────────────────
export async function unloadSounds(): Promise<void> {
  for (const sound of Object.values(soundCache)) {
    try { await sound?.unloadAsync(); } catch {}
  }
}

// ── Hooks para usar en componentes ───────────────────────────────────────
import { useEffect } from "react";

export function useSoundOnMount(type: SoundType) {
  useEffect(() => {
    playSound(type);
  }, []);
}

export function useSoundOnChange(type: SoundType, trigger: any, condition = true) {
  useEffect(() => {
    if (condition && trigger) {
      playSound(type);
    }
  }, [trigger]);
}
