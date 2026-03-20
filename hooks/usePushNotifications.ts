// hooks/usePushNotifications.ts
// Registra el token push y maneja notificaciones entrantes

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import api from "../api";

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

export function usePushNotifications(userId?: number, role?: string) {
  const router              = useRouter();
  const notificationListener = useRef<any>();
  const responseListener     = useRef<any>();

  // ── Registrar token push ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const registerToken = async () => {
      try {
        if (!Device.isDevice) return; // no funciona en simulador

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("Permiso de notificaciones denegado");
          return;
        }

        // Obtener token de Expo
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: "927dfa9c-986b-4be2-9145-274583151d55", // tu projectId
        });
        const token = tokenData.data;

        // Canal de Android
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("styleapp-notifications", {
            name:       "StyleApp",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#D4AF37",
            sound:      "default",
          });
        }

        // Guardar token en el backend
        await api.post("/notifications/push-token", { token });
        console.log("Push token registrado:", token.substring(0, 30) + "...");

      } catch (err: any) {
        console.warn("Error registrando push token:", err.message);
      }
    };

    registerToken();
  }, [userId]);

  // ── Actualizar ubicación del profesional periódicamente ─────────────────
  useEffect(() => {
    const PROFESSIONAL_ROLES = ["barber", "estilista", "quiropodologo"];
    if (!userId || !role || !PROFESSIONAL_ROLES.includes(role)) return;

    let interval: any;

    const startLocationUpdates = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Actualizar ubicación cada 3 minutos cuando la app está abierta
        interval = setInterval(async () => {
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            await api.post("/notifications/update-location", {
              latitude:  loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
          } catch {}
        }, 3 * 60 * 1000); // cada 3 minutos

        // Actualizar inmediatamente al abrir
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await api.post("/notifications/update-location", {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {}
    };

    startLocationUpdates();
    return () => { if (interval) clearInterval(interval); };
  }, [userId, role]);

  // ── Manejar notificaciones recibidas ─────────────────────────────────────
  useEffect(() => {
    // Notificación recibida con app abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        console.log("Notificación recibida:", data?.type);
      }
    );

    // Usuario tocó la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.type === "new_service") {
          // Navegar a la lista de solicitudes
          router.push("/barber/jobs");
        }
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
