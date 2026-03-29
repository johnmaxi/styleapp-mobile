// app/barber/active.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getRouteCoords, LatLng } from "@/utils/directions";
import { ClipperMarker, DestinationMarker } from "@/utils/mapMarkers";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

type ServiceRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  client_id?: number;
  assigned_barber_id?: number;
  payment_method?: string;
  latitude?: number;
  longitude?: number;
};

type ClientInfo = { id: number; name?: string; phone?: string };
type GPSCoords = {
  latitude: number;
  longitude: number;
  heading?: number;
  updated_at?: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  pse: "PSE",
  nequi: "Nequi",
  tarjeta: "Tarjeta",
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  accepted: { label: "Dirígete al cliente", color: "#D4AF37" },
  on_route: { label: "En camino al cliente", color: "#2196F3" },
  arrived: { label: "Llegaste al cliente", color: "#9C27B0" },
  completed: { label: "Servicio completado", color: "#4caf50" },
  cancelled: { label: "Servicio cancelado", color: "#dd0000" },
};

const REQUIRES_CASH_CONFIRM = ["efectivo", "nequi"];

export default function BarberActive() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params = useLocalSearchParams<{
    id: string;
    service_type?: string;
    address?: string;
    price?: string;
    status?: string;
    client_id?: string;
  }>();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [myCoords, setMyCoords] = useState<GPSCoords | null>(null);
  const [clientCoords, setClientCoords] = useState<GPSCoords | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const clientInfoRef = useRef<ClientInfo | null>(null);
  const requestRef = useRef<ServiceRequest | null>(null);
  const lastRouteCalc = useRef<number>(0);
  const lastRoutePos = useRef<LatLng | null>(null);

  const updateRoute = useCallback(async (from: LatLng, to: LatLng) => {
    const now = Date.now();
    const lastPos = lastRoutePos.current;
    let movedEnough = true;
    if (lastPos) {
      const dlat = (from.latitude - lastPos.latitude) * 111000;
      const dlng =
        (from.longitude - lastPos.longitude) *
        111000 *
        Math.cos((from.latitude * Math.PI) / 180);
      movedEnough = Math.sqrt(dlat * dlat + dlng * dlng) > 50;
    }
    if (!lastPos || movedEnough || now - lastRouteCalc.current > 30000) {
      setLoadingRoute(true);
      lastRouteCalc.current = now;
      lastRoutePos.current = from;
      try {
        const coords = await getRouteCoords(from, to);
        setRouteCoords(coords);
      } finally {
        setLoadingRoute(false);
      }
    }
  }, []);

  const loadRequest = useCallback(async () => {
    if (!params.id) return;
    try {
      for (const path of [
        `/service-requests/${params.id}`,
        `/service-request/${params.id}`,
      ]) {
        try {
          const res = await api.get(path);
          const data = res.data?.data || res.data?.request || res.data;
          if (data?.id) {
            setRequest(data);
            requestRef.current = data;
            if (data.latitude && data.longitude) {
              setClientCoords({
                latitude: data.latitude,
                longitude: data.longitude,
              });
            }
            if (data.client_id && !clientInfoRef.current) {
              try {
                const cr = await api.get(`/usuarios/me/${data.client_id}`);
                const cdata = cr.data?.user || cr.data;
                if (cdata?.name) {
                  const info = {
                    id: cdata.id,
                    name: cdata.name,
                    phone: cdata.phone,
                  };
                  setClientInfo(info);
                  clientInfoRef.current = info;
                }
              } catch {}
            }
            break;
          }
        } catch (e: any) {
          if (e?.response?.status !== 404) throw e;
        }
      }
    } catch {}
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      const initial: ServiceRequest = {
        id: Number(params.id),
        service_type: params.service_type,
        address: params.address,
        price: params.price ? Number(params.price) : undefined,
        status: params.status || "accepted",
        client_id: params.client_id ? Number(params.client_id) : undefined,
      };
      setRequest(initial);
      requestRef.current = initial;
    }
    loadRequest();
    const timer = setInterval(loadRequest, 8000);
    return () => clearInterval(timer);
  }, [loadRequest]);

  useEffect(() => {
    if (
      myCoords &&
      clientCoords &&
      request?.status !== "arrived" &&
      request?.status !== "completed"
    ) {
      updateRoute(
        { latitude: myCoords.latitude, longitude: myCoords.longitude },
        { latitude: clientCoords.latitude, longitude: clientCoords.longitude },
      );
    }
    if (request?.status === "arrived" || request?.status === "completed") {
      setRouteCoords([]);
    }
  }, [myCoords, clientCoords, request?.status]);

  const startTracking = useCallback(async () => {
    if (trackingActive || !params.id) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Activa la ubicación en Ajustes.");
      return;
    }
    await Location.requestBackgroundPermissionsAsync().catch(() => {});
    setTrackingActive(true);
    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      async (loc) => {
        const coords: GPSCoords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading ?? 0,
          updated_at: Date.now(),
        };
        setMyCoords(coords);
        mapRef.current?.animateToRegion(
          { ...coords, latitudeDelta: 0.008, longitudeDelta: 0.008 },
          300,
        );
        try {
          await database().ref(`tracking/service_${params.id}`).set(coords);
        } catch {}
      },
    );
  }, [params.id, trackingActive]);

  const stopTracking = useCallback(async () => {
    locationSub.current?.remove();
    locationSub.current = null;
    setTrackingActive(false);
    setRouteCoords([]);
    if (params.id) {
      try {
        await database().ref(`tracking/service_${params.id}`).remove();
      } catch {}
    }
  }, [params.id]);

  useEffect(() => {
    const s = request?.status;
    if (
      (s === "accepted" || s === "on_route" || s === "arrived") &&
      !trackingActive
    ) {
      startTracking();
    }
    if (s === "completed" || s === "cancelled") stopTracking();
  }, [request?.status]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const updateStatus = async (newStatus: string) => {
    if (!request?.id) return;
    setLoading(true);
    try {
      await api.patch(`/service-requests/${request.id}/status`, {
        status: newStatus,
      });
      setRequest((prev) => (prev ? { ...prev, status: newStatus } : prev));
      if (newStatus === "on_route" && !trackingActive) startTracking();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No se pudo actualizar el estado",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── FIX: usar requestRef para tener client_id actualizado al calificar ──
  const goToRating = () => {
    const current = requestRef.current;
    const cInfo = clientInfoRef.current;
    const reqId = current?.id || Number(params.id);
    const cId =
      current?.client_id ||
      (params.client_id ? Number(params.client_id) : null);

    if (!cId) {
      // Sin client_id: mostrar Alert con opciones
      Alert.alert(
        "✅ Servicio completado",
        "El servicio fue finalizado exitosamente.",
        [
          {
            text: "Ir al inicio",
            onPress: () =>
              setTimeout(() => router.replace("/barber/home"), 200),
          },
        ],
      );
      return;
    }

    setTimeout(() => {
      try {
        // Usar href string para evitar crash con object params en SDK 55
        const ratingPath = `/rating?service_request_id=${reqId}&rated_id=${cId}&rated_name=${encodeURIComponent(cInfo?.name || "el cliente")}&redirect=/barber/home`;
        router.push(ratingPath as any);
      } catch (e) {
        console.warn("Rating nav error:", e);
        try {
          router.replace("/barber/home");
        } catch {}
      }
    }, 500);
  };

  const handleFinalize = async (paymentConfirmed: boolean) => {
    if (!request?.id) return;
    setLoading(true);
    setPaymentModal(false);
    try {
      const res = await api.post(`/payments/finalize-service/${request.id}`, {
        payment_confirmed: paymentConfirmed,
      });
      if (res.data.ok) {
        await stopTracking();
        const { total, professional_amt, commission_amt, payment_method } =
          res.data.breakdown;
        // Usar client_id de la respuesta del servidor (más confiable que requestRef)
        const finalClientId =
          res.data.client_id || requestRef.current?.client_id || null;
        const finalClientName = clientInfoRef.current?.name || "el cliente";
        const finalServiceId = request.id;

        Alert.alert(
          "✅ Servicio finalizado",
          `Pago: ${PAYMENT_LABELS[payment_method] || payment_method}\n` +
            `Total: $${Number(total).toLocaleString("es-CO")}\n` +
            `Tu pago (85%): $${Number(professional_amt).toLocaleString("es-CO")}\n` +
            `Comisión app (15%): $${Number(commission_amt).toLocaleString("es-CO")}`,
          [
            {
              text: "Calificar cliente",
              onPress: () => {
                if (!finalClientId) {
                  setTimeout(() => router.replace("/barber/home"), 200);
                  return;
                }
                setTimeout(() => {
                  try {
                    const ratingPath = `/rating?service_request_id=${finalServiceId}&rated_id=${finalClientId}&rated_name=${encodeURIComponent(finalClientName)}&redirect=/barber/home`;
                    router.push(ratingPath as any);
                  } catch (e) {
                    console.warn("Rating nav error:", e);
                    try {
                      router.replace("/barber/home");
                    } catch {}
                  }
                }, 500);
              },
            },
            {
              text: "Ir al inicio",
              onPress: () =>
                setTimeout(() => router.replace("/barber/home"), 200),
            },
          ],
        );
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked) {
        Alert.alert(
          "⛔ Pago no confirmado",
          `${data.error}\n\nMonto: $${Number(data.required_amount || 0).toLocaleString("es-CO")} COP`,
          [{ text: "Entendido", style: "cancel" }],
        );
      } else {
        Alert.alert("Error", data?.error || "No se pudo finalizar el servicio");
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmArrived = () => {
    Alert.alert(
      "¿Llegaste al destino?",
      `Confirma que llegaste a:\n${request?.address || "la ubicación del cliente"}`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, llegué", onPress: () => updateStatus("arrived") },
      ],
    );
  };

  const confirmComplete = () => {
    const method = request?.payment_method || "";
    if (REQUIRES_CASH_CONFIRM.includes(method)) {
      setPaymentModal(true);
    } else {
      Alert.alert(
        "Finalizar servicio",
        "¿Confirmas que el servicio fue completado?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, finalizar", onPress: () => handleFinalize(true) },
        ],
      );
    }
  };

  const price = request?.price ?? Number(params.price ?? 0);
  const method = request?.payment_method || "";
  const statusInfo =
    STATUS_INFO[request?.status || "accepted"] || STATUS_INFO.accepted;
  const mapRegion = myCoords
    ? { ...myCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : clientCoords
      ? { ...clientCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }
      : null;

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: palette.background,
        paddingBottom: 40,
      }}
    >
      {/* ── MODAL CONFIRMACIÓN DE PAGO ── */}
      <Modal visible={paymentModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000099",
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 28,
              gap: 16,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontWeight: "900",
                fontSize: 20,
                textAlign: "center",
              }}
            >
              Confirmar pago recibido
            </Text>
            <View
              style={{
                backgroundColor: "#0d2137",
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: "#D4AF37",
              }}
            >
              <Text style={{ color: "#aaa", fontSize: 13 }}>
                Método de pago
              </Text>
              <Text
                style={{ color: "#D4AF37", fontWeight: "700", fontSize: 16 }}
              >
                {PAYMENT_LABELS[method] || method}
              </Text>
              <Text style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>
                Monto total
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 28 }}>
                ${price.toLocaleString("es-CO")} COP
              </Text>
              <Text style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                Al confirmar, se descontará el 15% ($
                {Math.round(price * 0.15).toLocaleString("es-CO")}) como
                comisión.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleFinalize(true)}
              disabled={loading}
              style={{
                backgroundColor: "#0A7E07",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                ✅ Sí, recibí ${price.toLocaleString("es-CO")} por{" "}
                {PAYMENT_LABELS[method] || method}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPaymentModal(false);
                Alert.alert(
                  "⛔ Servicio bloqueado",
                  `No puedes finalizar hasta confirmar que recibiste el pago de $${price.toLocaleString("es-CO")} COP.`,
                  [{ text: "Entendido" }],
                );
              }}
              style={{
                backgroundColor: "#2a0a0a",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#B91C1C",
              }}
            >
              <Text
                style={{ color: "#EF4444", fontWeight: "700", fontSize: 15 }}
              >
                ❌ No he recibido el pago
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MAPA ── */}
      {mapRegion && (
        <View style={{ height: 260, position: "relative" }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
          >
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#2196F3"
                strokeWidth={4}
                geodesic
              />
            )}
            {myCoords && (
              <Marker
                coordinate={myCoords}
                title="Tu ubicación"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <ClipperMarker size={44} color="#2196F3" />
              </Marker>
            )}
            {clientCoords && (
              <Marker
                coordinate={clientCoords}
                title="Cliente"
                description={request?.address}
                anchor={{ x: 0.5, y: 1.0 }}
              >
                <DestinationMarker size={44} color="#D4AF37" />
              </Marker>
            )}
          </MapView>

          <View
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              backgroundColor: "#000000bb",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: statusInfo.color,
            }}
          >
            <Text
              style={{
                color: statusInfo.color,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {statusInfo.label}
            </Text>
          </View>

          {loadingRoute && (
            <View
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                backgroundColor: "#000000bb",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: "#2196F3", fontSize: 11 }}>
                Calculando ruta...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── DETALLES ── */}
      <View style={{ padding: 20, gap: 12 }}>
        <View
          style={{
            backgroundColor: palette.card,
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: statusInfo.color,
            gap: 4,
          }}
        >
          <Text
            style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}
          >
            {statusInfo.label}
          </Text>
          <Text style={{ color: palette.text }}>
            {request?.service_type || params.service_type || "Servicio"}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 13 }}>
            📍 {request?.address || params.address || "Sin dirección"}
          </Text>
          <Text
            style={{ color: palette.primary, fontWeight: "700", fontSize: 18 }}
          >
            ${price.toLocaleString("es-CO")} COP
          </Text>
          {method && (
            <Text style={{ color: "#888", fontSize: 13 }}>
              💳 {PAYMENT_LABELS[method] || method}
            </Text>
          )}
        </View>

        {clientInfo?.name && (
          <View
            style={{
              backgroundColor: palette.card,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#333",
            }}
          >
            <Text style={{ color: "#888", fontSize: 12 }}>Cliente</Text>
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              {clientInfo.name}
            </Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/chat/[serviceRequestId]",
                params: {
                  serviceRequestId: String(request?.id),
                  otherUserName: clientInfo?.name || "Cliente",
                },
              })
            }
            style={{
              flex: 1,
              backgroundColor: "#0d1b2e",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#4a90e2",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#4a90e2", fontWeight: "700" }}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (clientInfo?.phone) Linking.openURL("tel:" + clientInfo.phone);
              else
                Alert.alert(
                  "Sin teléfono",
                  "El cliente no tiene teléfono registrado",
                );
            }}
            style={{
              flex: 1,
              backgroundColor: "#0a2a0a",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#4caf50",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#4caf50", fontWeight: "700" }}>
              📞 Llamar
            </Text>
          </TouchableOpacity>
        </View>

        {!trackingActive &&
          ["accepted", "on_route", "arrived"].includes(
            request?.status || "",
          ) && (
            <TouchableOpacity
              onPress={startTracking}
              style={{
                backgroundColor: "#1a1a1a",
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#888",
              }}
            >
              <Text style={{ color: "#aaa", fontWeight: "700" }}>
                📍 Activar GPS
              </Text>
            </TouchableOpacity>
          )}

        {request?.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateStatus("on_route")}
            disabled={loading}
            style={{
              backgroundColor: "#1f4eb5",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {loading ? "Actualizando..." : "🚗 Estoy en camino"}
            </Text>
          </TouchableOpacity>
        )}

        {request?.status === "on_route" && (
          <TouchableOpacity
            onPress={confirmArrived}
            disabled={loading}
            style={{
              backgroundColor: "#6a1fb5",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {loading ? "Actualizando..." : "📍 Llegué al destino"}
            </Text>
          </TouchableOpacity>
        )}

        {(request?.status === "arrived" || request?.status === "on_route") && (
          <TouchableOpacity
            onPress={confirmComplete}
            disabled={loading}
            style={{
              backgroundColor:
                request?.status === "arrived" ? "#0A7E07" : "transparent",
              padding: 14,
              borderRadius: 10,
              alignItems: "center",
              borderWidth: request?.status === "on_route" ? 1 : 0,
              borderColor: "#4caf50",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontWeight: request?.status === "arrived" ? "900" : "700",
                fontSize: 16,
              }}
            >
              {loading ? "Finalizando..." : "✅ Finalizar servicio"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Cancelar servicio por profesional */}
        {(request?.status === "accepted" || request?.status === "on_route") && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "⚠️ Cancelar servicio",
                `Al cancelar un servicio aceptado se descontará el 15% ($${Math.round(price * 0.15).toLocaleString("es-CO")}) de tu saldo como penalización.\n\n¿Confirmas la cancelación?`,
                [
                  { text: "No, continuar", style: "cancel" },
                  {
                    text: "Sí, cancelar",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const res = await api.post(
                          `/payments/cancel-service-professional/${request?.id}`,
                        );
                        Alert.alert(
                          "Servicio cancelado",
                          res.data?.message || "El servicio fue cancelado.",
                          [
                            {
                              text: "OK",
                              onPress: () => router.replace("/barber/home"),
                            },
                          ],
                        );
                      } catch (err: any) {
                        Alert.alert(
                          "Error",
                          err?.response?.data?.error || "No se pudo cancelar",
                        );
                      }
                    },
                  },
                ],
              );
            }}
            style={{
              borderWidth: 1,
              borderColor: "#dd0000",
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#dd0000" }}>Cancelar servicio</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/barber/home")}
          style={{
            borderWidth: 1,
            borderColor: "#555",
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
