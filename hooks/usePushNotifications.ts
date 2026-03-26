// hooks/usePushNotifications.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import api from "../api";

// ── FIX: solo campos válidos en SDK 52/54 ─────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

export function usePushNotifications(userId?: number, role?: string) {
  const router               = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener     = useRef<any>(null);

  // ── Registrar token push ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const register = async () => {
      try {
        if (!Device.isDevice) return;

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") return;

        // ── FIX: crear canales sin campos inexistentes ────────────────
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("styleapp-urgent", {
            name:             "StyleApp Urgente",
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300],
            sound:            "default",
            enableVibrate:    true,
          });
          await Notifications.setNotificationChannelAsync("styleapp-notifications", {
            name:             "StyleApp",
            importance:       Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            sound:            "default",
            enableVibrate:    true,
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: "a136cc38-83b5-4328-86ce-8a21b62f65e6",
        });

        if (mounted) {
          await api.post("/notifications/push-token", { token: tokenData.data });
          console.log("Push token registrado OK");
        }
      } catch (err: any) {
        console.warn("Push token error:", err?.message);
      }
    };

    register();
    return () => { mounted = false; };
  }, [userId]);

  // ── Actualizar ubicación del profesional ──────────────────────────────
  useEffect(() => {
    const PROF_ROLES = ["barber", "estilista", "quiropodologo"];
    if (!userId || !role || !PROF_ROLES.includes(role)) return;

    let interval: ReturnType<typeof setInterval>;
    let mounted = true;

    const updateLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (mounted) {
          await api.post("/notifications/update-location", {
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {}
    };

    updateLocation();
    interval = setInterval(updateLocation, 3 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [userId, role]);

  // ── Manejar notificaciones ────────────────────────────────────────────
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        try {
          const data = notification.request.content.data as any;
          if (!data?.type) return;

          if (data.type === "service_warning") {
            Alert.alert(
              "⚠️ Tu servicio expirará pronto",
              "Tu solicitud lleva 7 minutos sin ser aceptada.\n\nExpirará en 3 minutos.\n\n💡 Considera aumentar el precio.",
              [
                { text: "Ver solicitud", onPress: () => { setTimeout(() => { try { router.push("/client/home" as any); } catch {} }, 200); } },
                { text: "OK", style: "cancel" },
              ]
            );
            return;
          }

          if (data.type === "service_expired") {
            Alert.alert(
              "⏰ Servicio sin profesionales",
              `Tu solicitud expiró.\n¿Deseas republicarla?`,
              [
                { text: "Ver opciones", onPress: () => { setTimeout(() => { try { router.push("/client/home" as any); } catch {} }, 200); } },
                { text: "Cerrar", style: "cancel" },
              ]
            );
            return;
          }

          if (data.type === "new_service") {
            const bodyLines = [
              data.service_type || "Servicio",
              data.address ? `📍 ${data.address}` : null,
              `💰 $${Number(data.price || 0).toLocaleString("es-CO")} COP`,
              data.distance ? `🚗 ${data.distance} · ${data.eta || ""}` : null,
            ].filter(Boolean).join("\n");

            Alert.alert(
              "✂️ Nuevo servicio disponible",
              bodyLines,
              [
                {
                  text: "✅ Ver solicitudes",
                  onPress: () => {
                    setTimeout(() => { try { router.replace("/barber/jobs"); } catch {} }, 200);
                  },
                },
                { text: "Omitir", style: "cancel" },
              ],
              { cancelable: true }
            );
          }
        } catch (err) {
          console.warn("Notification listener error:", err);
        }
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        try {
          const data = response.notification.request.content.data as any;
          if (!data?.type) return;
          setTimeout(() => {
            try {
              if (data.type === "new_service") {
                router.replace("/barber/jobs");
              } else if (data.type === "service_warning" || data.type === "service_expired") {
                router.replace("/client/home" as any);
              }
            } catch {}
          }, 300);
        } catch {}
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);
}
