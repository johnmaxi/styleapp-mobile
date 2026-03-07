// app/client/status.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getRouteCoords, LatLng } from "@/utils/directions";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Linking,
  ScrollView, Text, TouchableOpacity, View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

type ServiceRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  latitude?: number;
  longitude?: number;
  status?: "open" | "accepted" | "on_route" | "arrived" | "completed" | "cancelled";
  assigned_barber_id?: number;
  barber_name?: string;
  payment_method?: string;
};

type Bid = {
  id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  barber_id?: number;
  name?: string;
  phone?: string;
};

type TrackingData = {
  latitude: number;
  longitude: number;
  heading?: number;
  updated_at?: number;
};

const STATUS_INFO: Record<string, { text: string; color: string; emoji: string }> = {
  open:      { text: "Buscando profesional...",  color: "#D4AF37", emoji: "🔍" },
  accepted:  { text: "Profesional asignado",      color: "#4caf50", emoji: "✅" },
  on_route:  { text: "Profesional en camino",     color: "#2196F3", emoji: "🚗" },
  arrived:   { text: "Profesional llegó",         color: "#9C27B0", emoji: "📍" },
  completed: { text: "Servicio completado",        color: "#4caf50", emoji: "🎉" },
  cancelled: { text: "Servicio cancelado",         color: "#dd0000", emoji: "❌" },
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo", pse: "PSE", nequi: "Nequi", daviplata: "Daviplata",
};

export default function ClientStatus() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string; service_type?: string; address?: string;
    price?: string; latitude?: string; longitude?: string; status?: string;
  }>();
  const { user } = useAuth();
  const palette  = getPalette(user?.gender);

  const [loading, setLoading]         = useState(true);
  const [request, setRequest]         = useState<ServiceRequest | null>(null);
  const [bids, setBids]               = useState<Bid[]>([]);
  const [actingBidId, setActingBidId] = useState<number | null>(null);
  const [professionalCoords, setProfessionalCoords] = useState<TrackingData | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const completedAlertShown = useRef(false);
  const arrivedAlertShown   = useRef(false);
  const mapRef = useRef<MapView>(null);

  // Throttle ruta igual que en barber
  const lastRouteCalc = useRef<number>(0);
  const lastRoutePos  = useRef<LatLng | null>(null);

  // ── Calcular ruta cuando el profesional se mueve ──────────────────────────
  const updateRoute = useCallback(async (from: LatLng, to: LatLng) => {
    const now     = Date.now();
    const lastPos = lastRoutePos.current;

    let movedEnough = true;
    if (lastPos) {
      const dlat = (from.latitude - lastPos.latitude) * 111000;
      const dlng = (from.longitude - lastPos.longitude) * 111000 * Math.cos(from.latitude * Math.PI / 180);
      movedEnough = Math.sqrt(dlat * dlat + dlng * dlng) > 50;
    }

    if (!lastPos || movedEnough || (now - lastRouteCalc.current) > 30000) {
      setLoadingRoute(true);
      lastRouteCalc.current = now;
      lastRoutePos.current  = from;
      try {
        const coords = await getRouteCoords(from, to);
        setRouteCoords(coords);
      } finally {
        setLoadingRoute(false);
      }
    }
  }, []);

  // ── Firebase: escuchar ubicacion del profesional ──────────────────────────
  useEffect(() => {
    if (!params.id) return;
    const ref = database().ref(`tracking/service_${params.id}`);

    const onValue = ref.on("value", (snap) => {
      const data = snap.val();
      if (data?.latitude && data?.longitude) {
        setProfessionalCoords(data as TrackingData);
        mapRef.current?.animateToRegion({
          latitude:      data.latitude,
          longitude:     data.longitude,
          latitudeDelta:  0.012,
          longitudeDelta: 0.012,
        }, 600);
      }
    });

    return () => ref.off("value", onValue);
  }, [params.id]);

  // Actualizar ruta cuando el profesional se mueve y hay destino
  useEffect(() => {
    if (
      professionalCoords &&
      request?.latitude &&
      request?.longitude &&
      request.status === "on_route"
    ) {
      updateRoute(
        { latitude: professionalCoords.latitude, longitude: professionalCoords.longitude },
        { latitude: request.latitude, longitude: request.longitude }
      );
    }
    // Limpiar ruta si llegó
    if (request?.status === "arrived" || request?.status === "completed") {
      setRouteCoords([]);
    }
  }, [professionalCoords, request?.latitude, request?.longitude, request?.status]);

  // ── Carga del servicio ────────────────────────────────────────────────────
  const getRequestById = async (id: number): Promise<ServiceRequest | null> => {
    for (const path of [`/service-requests/${id}`, `/service-request/${id}`]) {
      try {
        const res  = await api.get(path);
        const data = res.data?.data || res.data?.request || res.data;
        if (data && !Array.isArray(data) && data.id) return data as ServiceRequest;
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }
    }
    return null;
  };

  const getActiveRequest = async (): Promise<ServiceRequest | null> => {
    for (const path of ["/service-requests/mine", "/service-request/mine"]) {
      try {
        const res  = await api.get(path);
        const rows: ServiceRequest[] = Array.isArray(res.data) ? res.data : res.data?.data || [];
        return rows.find((r) => r.status !== "completed" && r.status !== "cancelled") || null;
      } catch {}
    }
    return null;
  };

  const getBids = async (requestId: number): Promise<Bid[]> => {
    try {
      const res = await api.get(`/bids/request/${requestId}`);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    } catch { return []; }
  };

  const loadStatus = useCallback(async () => {
    try {
      let current: ServiceRequest | null = null;
      if (params.id && Number(params.id) > 0) {
        current = await getRequestById(Number(params.id));
        if (!current) {
          current = {
            id:        Number(params.id),
            service_type: params.service_type,
            address:   params.address,
            price:     params.price     ? Number(params.price)     : undefined,
            latitude:  params.latitude  ? Number(params.latitude)  : undefined,
            longitude: params.longitude ? Number(params.longitude) : undefined,
            status:    (params.status as ServiceRequest["status"]) || "open",
          };
        }
      }
      if (!current) current = await getActiveRequest();
      if (current) setBids(await getBids(current.id));
      setRequest(current);

      if (current?.status === "arrived" && !arrivedAlertShown.current) {
        arrivedAlertShown.current = true;
        Alert.alert("📍 El profesional llegó", "Tu profesional llegó a la dirección del servicio.");
      }

      if (current?.status === "completed" && !completedAlertShown.current) {
        completedAlertShown.current = true;
        setTimeout(() => {
          Alert.alert(
            "Servicio completado",
            "¿Confirmas que el servicio fue completado?",
            [
              { text: "No, hay un problema", style: "destructive",
                onPress: () => Alert.alert("Reportado", "Contactanos para resolver.") },
              { text: "Sí, calificar",
                onPress: () => router.replace({
                  pathname: "/rating",
                  params: {
                    service_request_id: String(current!.id),
                    rated_id:           String(current!.assigned_barber_id || ""),
                    rated_name:         current!.barber_name || "el profesional",
                    redirect:           "/client/home",
                  },
                }),
              },
            ],
            { cancelable: false }
          );
        }, 500);
      }
    } catch (err: any) {
      console.log("ERROR STATUS:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 5000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const acceptBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/accept/${bidId}`);
      Alert.alert("Oferta aceptada", "El profesional fue asignado.");
      await loadStatus();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar");
    } finally { setActingBidId(null); }
  };

  const rejectBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/reject/${bidId}`);
      await loadStatus();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo rechazar");
    } finally { setActingBidId(null); }
  };

  const cancelService = async () => {
    if (!request?.id) return;
    Alert.alert("Cancelar servicio", "¿Estás seguro?", [
      { text: "Mantener", style: "cancel" },
      {
        text: "Sí, cancelar", style: "destructive",
        onPress: async () => {
          try {
            await api.patch(`/service-requests/${request.id}/status`, { status: "cancelled" });
            router.replace("/client/home");
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.error || "No se pudo cancelar");
          }
        },
      },
    ]);
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const acceptedBid  = bids.find((b) => b.status === "accepted");
  const pendingBids  = bids.filter((b) => b.status === "pending");
  const statusInfo   = STATUS_INFO[request?.status || "open"] || STATUS_INFO.open;
  const serviceActive = ["accepted", "on_route", "arrived"].includes(request?.status || "");

  const gpsAge = professionalCoords?.updated_at
    ? Math.round((Date.now() - professionalCoords.updated_at) / 1000)
    : null;

  const mapRegion = useMemo(() => {
    if (professionalCoords) {
      return {
        latitude:      professionalCoords.latitude,
        longitude:     professionalCoords.longitude,
        latitudeDelta:  0.015,
        longitudeDelta: 0.015,
      };
    }
    if (request?.latitude && request?.longitude) {
      return {
        latitude:      request.latitude,
        longitude:     request.longitude,
        latitudeDelta:  0.015,
        longitudeDelta: 0.015,
      };
    }
    return null;
  }, [professionalCoords, request?.latitude, request?.longitude]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center",
        backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center",
        padding: 24, backgroundColor: palette.background }}>
        <Text style={{ color: palette.text, marginBottom: 12 }}>
          No tienes solicitudes activas.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{ backgroundColor: palette.card, padding: 14, borderRadius: 8,
            borderWidth: 1, borderColor: palette.primary }}
        >
          <Text style={{ color: palette.text }}>Crear solicitud</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{
      backgroundColor: palette.background, paddingBottom: 36,
    }}>

      {/* ── MAPA ── */}
      {mapRegion && (
        <View style={{ height: 300, position: "relative" }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
          >
            {/* ── RUTA AZUL por calles reales ── */}
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#2196F3"
                strokeWidth={4}
                geodesic={true}
              />
            )}

            {/* Pin profesional — azul, se mueve en tiempo real */}
            {professionalCoords && (
              <Marker
                coordinate={professionalCoords}
                title={acceptedBid?.name || "Profesional"}
                description={
                  request.status === "arrived"
                    ? "Llegó a tu dirección"
                    : gpsAge !== null ? `Actualizado hace ${gpsAge}s` : "En camino"
                }
                pinColor="#2196F3"
              />
            )}

            {/* Pin lugar del servicio — dorado, fijo */}
            {request.latitude && request.longitude && (
              <Marker
                coordinate={{ latitude: request.latitude, longitude: request.longitude }}
                title="Lugar del servicio"
                description={request.address}
                pinColor="#D4AF37"
              />
            )}
          </MapView>

          {/* Badge estado */}
          <View style={{
            position: "absolute", top: 10, left: 10,
            backgroundColor: "#000000bb", borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6,
            borderWidth: 1,
            borderColor: request.status === "arrived"  ? "#9C27B0"
                       : request.status === "on_route" ? "#2196F3"
                       : "#555",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: professionalCoords
                ? (request.status === "arrived" ? "#9C27B0" : "#4caf50")
                : "#555",
            }} />
            <Text style={{ color: professionalCoords ? "#fff" : "#888", fontSize: 11 }}>
              {request.status === "arrived"
                ? "📍 Profesional llegó"
                : request.status === "on_route" && professionalCoords
                ? `🚗 En camino${gpsAge !== null ? ` · ${gpsAge}s` : ""}`
                : request.status === "accepted"
                ? "Esperando que inicie el camino"
                : "Sin señal GPS"}
            </Text>
          </View>

          {/* Badge ruta */}
          {routeCoords.length > 1 && (
            <View style={{
              position: "absolute", top: 10, right: 10,
              backgroundColor: "#000000bb", borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 6,
              borderWidth: 1, borderColor: "#2196F355",
              flexDirection: "row", alignItems: "center", gap: 6,
            }}>
              <View style={{ width: 16, height: 3, backgroundColor: "#2196F3", borderRadius: 2 }} />
              <Text style={{ color: "#2196F3", fontSize: 11 }}>
                {loadingRoute ? "Actualizando..." : "Ruta activa"}
              </Text>
            </View>
          )}

          {/* Botón ver ambos pines */}
          <TouchableOpacity
            onPress={() => {
              if (professionalCoords && request.latitude && request.longitude && mapRef.current) {
                mapRef.current.fitToCoordinates(
                  [
                    { latitude: professionalCoords.latitude, longitude: professionalCoords.longitude },
                    { latitude: request.latitude!, longitude: request.longitude! },
                  ],
                  { edgePadding: { top: 60, right: 40, bottom: 40, left: 40 }, animated: true }
                );
              }
            }}
            style={{
              position: "absolute", bottom: 12, right: 12,
              backgroundColor: "#000000cc", borderRadius: 8,
              padding: 10, borderWidth: 1, borderColor: "#444",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18 }}>⊕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
          Estado de tu solicitud
        </Text>

        {/* STATUS */}
        <View style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 12,
          borderWidth: 1, borderColor: statusInfo.color,
          flexDirection: "row", alignItems: "center", gap: 10,
        }}>
          <Text style={{ fontSize: 24 }}>{statusInfo.emoji}</Text>
          <View>
            <Text style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}>
              {statusInfo.text}
            </Text>
            <Text style={{ color: "#aaa", fontSize: 12 }}>Solicitud #{request.id}</Text>
          </View>
        </View>

        {/* DETALLES */}
        <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, gap: 4 }}>
          <Text style={{ color: palette.text }}>
            Servicio: {request.service_type || "No definido"}
          </Text>
          <Text style={{ color: palette.text }}>
            Dirección: {request.address || "No definida"}
          </Text>
          <Text style={{ color: palette.primary, fontWeight: "700" }}>
            Precio: ${(request.price ?? 0).toLocaleString("es-CO")} COP
          </Text>
          {request.payment_method && (
            <Text style={{ color: "#aaa" }}>
              Pago: {PAYMENT_LABELS[request.payment_method] || request.payment_method}
            </Text>
          )}
        </View>

        {/* CONTRAOFERTAS */}
        {pendingBids.length > 0 && (
          <>
            <Text style={{ fontSize: 17, fontWeight: "700", color: palette.text }}>
              Contraofertas ({pendingBids.length})
            </Text>
            {pendingBids.map((bid) => (
              <View key={bid.id} style={{
                borderWidth: 1, borderColor: palette.primary,
                borderRadius: 10, padding: 14,
              }}>
                <Text style={{ color: palette.text }}>
                  Profesional: {bid.name || `#${bid.barber_id}`}
                </Text>
                <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 18 }}>
                  Oferta: ${bid.amount.toLocaleString("es-CO")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => acceptBid(bid.id)}
                    disabled={actingBidId === bid.id}
                    style={{ flex: 1, backgroundColor: "#0A7E07", padding: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                      {actingBidId === bid.id ? "..." : "Aceptar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectBid(bid.id)}
                    disabled={actingBidId === bid.id}
                    style={{ flex: 1, backgroundColor: "#b30000", padding: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: "#fff", textAlign: "center" }}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* PROFESIONAL ASIGNADO */}
        {acceptedBid && (
          <View style={{
            backgroundColor: "#0a2a0a", padding: 14, borderRadius: 10,
            borderWidth: 1, borderColor: "#0A7E07",
          }}>
            <Text style={{ color: "#4caf50", fontWeight: "700", marginBottom: 4 }}>
              Profesional asignado
            </Text>
            <Text style={{ color: palette.text }}>
              {acceptedBid.name || `#${acceptedBid.barber_id}`}
            </Text>
            <Text style={{ color: palette.text }}>
              Valor acordado: ${acceptedBid.amount.toLocaleString("es-CO")} COP
            </Text>
          </View>
        )}

        {/* CHAT Y LLAMADA */}
        {serviceActive && (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push({
                pathname: "/chat/[serviceRequestId]",
                params: {
                  serviceRequestId: String(request.id),
                  otherUserName:    acceptedBid?.name || "Profesional",
                },
              })}
              style={{
                flex: 1, backgroundColor: "#0d1b2e", padding: 16,
                borderRadius: 12, borderWidth: 1, borderColor: "#4a90e2",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#4a90e2", fontWeight: "700" }}>💬 Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const phone = acceptedBid?.phone;
                if (phone) Linking.openURL("tel:" + phone);
                else Alert.alert("No disponible", "Usa el chat para comunicarte.");
              }}
              style={{
                flex: 1, backgroundColor: "#0a2a0a", padding: 16,
                borderRadius: 12, borderWidth: 1, borderColor: "#4caf50",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#4caf50", fontWeight: "700" }}>📞 Llamar</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          onPress={loadStatus}
          style={{
            backgroundColor: palette.primary, padding: 12,
            borderRadius: 8, alignItems: "center",
          }}
        >
          <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar estado</Text>
        </TouchableOpacity>

        {["open", "accepted", "on_route", "arrived"].includes(request.status || "") && (
          <TouchableOpacity
            onPress={cancelService}
            style={{
              borderWidth: 1, borderColor: "#dd0000",
              padding: 12, borderRadius: 8, alignItems: "center",
            }}
          >
            <Text style={{ color: "#dd0000" }}>Cancelar servicio</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/client/home")}
          style={{
            borderWidth: 1, borderColor: "#555",
            padding: 12, borderRadius: 8, alignItems: "center",
          }}
        >
          <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}