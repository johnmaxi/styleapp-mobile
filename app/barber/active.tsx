// app/barber/active.tsx — con lógica de confirmación de pago por método
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getRouteCoords, LatLng } from "@/utils/directions";
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
  daviplata: "Daviplata",
  tarjeta: "Tarjeta",
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  accepted: { label: "Dirígete al cliente", color: "#D4AF37" },
  on_route: { label: "En camino al cliente", color: "#2196F3" },
  arrived: { label: "Llegaste al cliente", color: "#9C27B0" },
  completed: { label: "Servicio completado", color: "#4caf50" },
  cancelled: { label: "Servicio cancelado", color: "#dd0000" },
};

// Métodos que requieren confirmación manual de pago
const REQUIRES_CASH_CONFIRM = ["efectivo", "nequi", "daviplata"];

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
  }>();

  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [myCoords, setMyCoords] = useState<GPSCoords | null>(null);
  const [clientCoords, setClientCoords] = useState<GPSCoords | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Modal de confirmación de pago
  const [paymentModal, setPaymentModal] = useState(false);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const mapRef = useRef<MapView>(null);
  const clientInfoRef = useRef<ClientInfo | null>(null);
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
            if (data.latitude && data.longitude)
              setClientCoords({
                latitude: data.latitude,
                longitude: data.longitude,
              });
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
      setRequest({
        id: Number(params.id),
        service_type: params.service_type,
        address: params.address,
        price: params.price ? Number(params.price) : undefined,
        status: params.status || "accepted",
      });
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
    )
      updateRoute(
        { latitude: myCoords.latitude, longitude: myCoords.longitude },
        { latitude: clientCoords.latitude, longitude: clientCoords.longitude },
      );
    if (request?.status === "arrived" || request?.status === "completed")
      setRouteCoords([]);
  }, [myCoords, clientCoords, request?.status]);

  const startTracking = useCallback(async () => {
    if (trackingActive || !params.id) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso requerido",
        "Activa la ubicación en Ajustes > Permisos.",
      );
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
    )
      startTracking();
    if (s === "completed" || s === "cancelled") stopTracking();
  }, [request?.status]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // ── Actualizar estado simple (sin lógica de pago) ─────────────────────
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

  // ── Finalizar con lógica de pago ──────────────────────────────────────
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
        Alert.alert(
          "✅ Servicio finalizado",
          `Pago: ${PAYMENT_LABELS[payment_method] || payment_method}\n` +
            `Total servicio: $${Number(total).toLocaleString("es-CO")}\n` +
            `Tu pago (85%): $${Number(professional_amt).toLocaleString("es-CO")}\n` +
            `Comisión app (15%): $${Number(commission_amt).toLocaleString("es-CO")}`,
          [
            {
              text: "Calificar cliente",
              onPress: () =>
                router.replace({
                  pathname: "/rating",
                  params: {
                    service_request_id: String(request.id),
                    rated_id: String(request.client_id || ""),
                    rated_name: clientInfoRef.current?.name || "el cliente",
                    redirect: "/barber/home",
                  },
                }),
            },
          ],
        );
      }
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked) {
        Alert.alert(
          "⛔ Pago no confirmado",
          data.error +
            `\n\nMonto requerido: $${Number(data.required_amount || 0).toLocaleString("es-CO")} COP`,
          [{ text: "Entendido", style: "cancel" }],
        );
      } else {
        Alert.alert("Error", data?.error || "No se pudo finalizar el servicio");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Confirmar llegada ─────────────────────────────────────────────────
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

  // ── Mostrar modal o finalizar directo según método de pago ────────────
  const confirmComplete = () => {
    const method = request?.payment_method || "";
    const price = request?.price ?? 0;

    if (REQUIRES_CASH_CONFIRM.includes(method)) {
      // Mostrar modal de confirmación de pago
      setPaymentModal(true);
    } else {
      // PSE o tarjeta — finalizar directo (el pago ya fue procesado)
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
                Monto total del servicio
              </Text>
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 28 }}>
                ${price.toLocaleString("es-CO")} COP
              </Text>
              {method === "nequi" || method === "daviplata" ? (
                <Text style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                  Al confirmar, se descontará el 15% ($
                  {Math.round(price * 0.15).toLocaleString("es-CO")}) de tu
                  saldo como comisión.
                </Text>
              ) : (
                <Text style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                  Al confirmar, se descontará el 15% ($
                  {Math.round(price * 0.15).toLocaleString("es-CO")}) del saldo
                  del cliente como comisión.
                </Text>
              )}
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
                  `No puedes finalizar el servicio hasta confirmar que recibiste el pago de $${price.toLocaleString("es-CO")} COP.`,
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
                ❌ No, aún no recibí el pago
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaymentModal(false)}>
              <Text
                style={{ color: "#666", textAlign: "center", fontSize: 13 }}
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MAPA ── */}
      <View style={{ height: 320, backgroundColor: "#111" }}>
        {mapRegion ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsTraffic={false}
          >
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#2196F3"
                strokeWidth={4}
                geodesic={true}
              />
            )}
            {myCoords && (
              <Marker
                coordinate={myCoords}
                title="Tu ubicación"
                pinColor="#2196F3"
              />
            )}
            {clientCoords && (
              <Marker
                coordinate={clientCoords}
                title={clientInfo?.name || "Destino"}
                description={request?.address}
                pinColor="#D4AF37"
              />
            )}
          </MapView>
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text style={{ color: "#555" }}>Cargando mapa...</Text>
          </View>
        )}

        {/* Badge GPS */}
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            backgroundColor: trackingActive ? "#0a2a0acc" : "#1a1a1acc",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: trackingActive ? "#4caf50" : "#444",
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: trackingActive ? "#4caf50" : "#555",
            }}
          />
          <Text
            style={{ color: trackingActive ? "#4caf50" : "#888", fontSize: 11 }}
          >
            {trackingActive ? "GPS activo" : "GPS inactivo"}
          </Text>
        </View>

        {routeCoords.length > 1 && (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              backgroundColor: "#00000099",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: "#2196F355",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                width: 16,
                height: 3,
                backgroundColor: "#2196F3",
                borderRadius: 2,
              }}
            />
            <Text style={{ color: "#2196F3", fontSize: 11 }}>
              {loadingRoute ? "Actualizando..." : "Ruta activa"}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => {
            if (myCoords && clientCoords && mapRef.current) {
              mapRef.current.fitToCoordinates(
                [
                  {
                    latitude: myCoords.latitude,
                    longitude: myCoords.longitude,
                  },
                  {
                    latitude: clientCoords.latitude,
                    longitude: clientCoords.longitude,
                  },
                ],
                {
                  edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
                  animated: true,
                },
              );
            }
          }}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            backgroundColor: "#000000cc",
            borderRadius: 8,
            padding: 10,
            borderWidth: 1,
            borderColor: "#444",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>⊕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: palette.text }}>
          Servicio activo
        </Text>

        {/* STATUS */}
        <View
          style={{
            backgroundColor: palette.card,
            padding: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: statusInfo.color,
          }}
        >
          <Text
            style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}
          >
            {statusInfo.label}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>
            Solicitud #{request?.id}
          </Text>
        </View>

        {/* DETALLES */}
        <View
          style={{
            backgroundColor: palette.card,
            padding: 14,
            borderRadius: 10,
            gap: 5,
          }}
        >
          <Text style={{ color: palette.text }}>
            Servicio: {request?.service_type || params.service_type || "-"}
          </Text>
          <Text style={{ color: palette.text }}>
            Dirección: {request?.address || params.address || "-"}
          </Text>
          <Text
            style={{ color: palette.primary, fontWeight: "700", fontSize: 16 }}
          >
            Valor: ${price.toLocaleString("es-CO")} COP
          </Text>
          {request?.payment_method && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 4,
                backgroundColor: "#0d1b2e",
                borderRadius: 8,
                padding: 8,
                borderWidth: 1,
                borderColor: "#D4AF3755",
              }}
            >
              <Text style={{ fontSize: 16 }}>
                {method === "efectivo"
                  ? "💵"
                  : method === "nequi"
                    ? "📱"
                    : method === "pse"
                      ? "🏦"
                      : method === "tarjeta"
                        ? "💳"
                        : "💰"}
              </Text>
              <Text style={{ color: "#D4AF37", fontWeight: "700" }}>
                {PAYMENT_LABELS[method] || method}
              </Text>
              {REQUIRES_CASH_CONFIRM.includes(method) && (
                <Text style={{ color: "#888", fontSize: 11 }}>
                  — requiere confirmación
                </Text>
              )}
            </View>
          )}
          {clientInfo?.name && (
            <Text style={{ color: "#ccc" }}>Cliente: {clientInfo.name}</Text>
          )}
        </View>

        {/* CHAT Y LLAMADA */}
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
