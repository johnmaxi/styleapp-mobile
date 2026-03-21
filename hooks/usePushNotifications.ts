// hooks/usePushNotifications.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import api from "../api";

// Mostrar notificaciones SIEMPRE — incluso con app abierta en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:   true,
    shouldPlaySound:   true,
    shouldSetBadge:    true,
    shouldShowBanner:  true,
    shouldShowList:    true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export function usePushNotifications(userId?: number, role?: string) {
  const router               = useRouter();
  const notificationListener = useRef<any>();
  const responseListener     = useRef<any>();

  // ── Registrar token push ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const register = async () => {
      try {
        if (!Device.isDevice) {
          console.log("Push: solo funciona en dispositivo físico");
          return;
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("Push: permiso denegado");
          return;
        }

        // Canal Android con sonido
        if (Platform.OS === "android") {
          // Eliminar canal anterior y recrear para garantizar configuración correcta
          await Notifications.deleteNotificationChannelAsync("styleapp-notifications").catch(() => {});
          await Notifications.setNotificationChannelAsync("styleapp-notifications", {
            name:             "StyleApp — Solicitudes",
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300],
            lightColor:       "#D4AF37",
            sound:            "default",
            enableVibrate:    true,
            showBadge:        true,
            bypassDnd:        true,  // pasa por no molestar
          });
          // Canal adicional para alertas críticas
          await Notifications.setNotificationChannelAsync("styleapp-urgent", {
            name:             "StyleApp — Urgente",
            importance:       Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            sound:            "default",
            enableVibrate:    true,
            bypassDnd:        true,
          });
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: "927dfa9c-986b-4be2-9145-274583151d55",
        });

        await api.post("/notifications/push-token", { token: tokenData.data });
        console.log("Push token registrado OK");

      } catch (err: any) {
        console.warn("Push token error:", err.message);
      }
    };

    register();
  }, [userId]);

  // ── Actualizar ubicación del profesional ──────────────────────────────
  useEffect(() => {
    const PROF_ROLES = ["barber", "estilista", "quiropodologo"];
    if (!userId || !role || !PROF_ROLES.includes(role)) return;

    let interval: ReturnType<typeof setInterval>;

    const updateLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await api.post("/notifications/update-location", {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch {}
    };

    // Actualizar inmediatamente y luego cada 3 minutos
    updateLocation();
    interval = setInterval(updateLocation, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, role]);

  // ── Manejar toque en notificación ─────────────────────────────────────
  useEffect(() => {
    // Notificación recibida con app abierta — mostrar Alert con acciones
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data as any;

        if (data?.type === "new_service") {
          // Mostrar Alert con opciones: Aceptar, Contraoferta, Omitir
          Alert.alert(
            `✂️ ${data.service_type || "Nuevo servicio"}`,
            `📍 ${data.address || ""}\n💰 $${Number(data.price || 0).toLocaleString("es-CO")} COP\n🚗 ${data.distance || ""} · ~${data.eta || ""}`,
            [
              {
                text: "✅ Aceptar",
                onPress: async () => {
                  try {
                    const res = await api.post("/bids/accept-direct", {
                      service_request_id: Number(data.service_id),
                    });
                    if (res.data?.ok) {
                      router.push({
                        pathname: "/barber/active",
                        params: {
                          id:           String(data.service_id),
                          service_type: data.service_type || "",
                          address:      data.address      || "",
                          price:        String(data.price || 0),
                          status:       "accepted",
                        },
                      });
                    }
                  } catch (err: any) {
                    Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar");
                  }
                },
              },
              {
                text: "💬 Contraoferta",
                onPress: () => {
                  router.push({
                    pathname: "/barber/offer",
                    params: {
                      requestId:    String(data.service_id),
                      currentPrice: String(data.price || 0),
                      serviceType:  data.service_type || "",
                      address:      data.address      || "",
                    },
                  });
                },
              },
              {
                text: "Omitir",
                style: "cancel",
              },
            ],
            { cancelable: true }
          );
        }
      }
    );

    // Usuario tocó la notificación desde fuera de la app
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data       = response.notification.request.content.data as any;
        const actionId   = response.actionIdentifier;

        if (data?.type === "new_service") {
          if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            // Tocó la notificación → ir a jobs
            router.push("/barber/jobs");
          }
        }
      }
    );

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
