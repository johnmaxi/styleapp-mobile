// app/client/status.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

type ServiceRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  latitude?: number;
  longitude?: number;
  status?: "open" | "accepted" | "on_route" | "completed" | "cancelled";
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

const STATUS_INFO: Record<string, { text: string; color: string }> = {
  open:      { text: "Buscando profesional...", color: "#D4AF37" },
  accepted:  { text: "Profesional asignado",    color: "#4caf50" },
  on_route:  { text: "Profesional en camino",   color: "#2196F3" },
  completed: { text: "Servicio completado",      color: "#4caf50" },
  cancelled: { text: "Servicio cancelado",       color: "#dd0000" },
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  pse:      "PSE",
  nequi:    "Nequi",
  daviplata:"Daviplata",
};

export default function ClientStatus() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string; service_type?: string; address?: string;
    price?: string; latitude?: string; longitude?: string; status?: string;
  }>();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [loading, setLoading]         = useState(true);
  const [request, setRequest]         = useState<ServiceRequest | null>(null);
  const [bids, setBids]               = useState<Bid[]>([]);
  const [actingBidId, setActingBidId] = useState<number | null>(null);
  const [professionalCoords, setProfessionalCoords] = useState<TrackingData | null>(null);
  const completedAlertShown = useRef(false);
  const mapRef = useRef<MapView>(null);

  // ── Firebase: escuchar ubicacion del profesional ─────────────────────────
  useEffect(() => {
    if (!params.id) return;
    const ref = database().ref(`tracking/service_${params.id}`);
    const onValue = ref.on("value", (snap) => {
      const data = snap.val();
      if (data?.latitude && data?.longitude) {
        setProfessionalCoords(data as TrackingData);
        // Centrar mapa en el profesional
        mapRef.current?.animateToRegion({
          latitude:      data.latitude,
          longitude:     data.longitude,
          latitudeDelta:  0.012,
          longitudeDelta: 0.012,
        }, 800);
      }
    });
    return () => ref.off("value", onValue);
  }, [params.id]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getRequestById = async (id: number): Promise<ServiceRequest | null> => {
    for (const path of [`/service-requests/${id}`, `/service-request/${id}`]) {
      try {
        const res  = await api.get(path);
        const data = res.data?.data || res.data?.request || res.data;
        if (data && typeof data === "object" && !Array.isArray(data) && data.id) return data as ServiceRequest;
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err;
      }
    }
    return null;
  };

  const getActiveRequest = async (): Promise<ServiceRequest | null> => {
    for (const path of ["/service-requests/mine", "/service-request/mine"]) {
      try {
        const res  = await api.get(path);
        const rows: ServiceRequest[] = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const active = rows.find((r) => r.status !== "completed" && r.status !== "cancelled");
        if (active) return active;
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

  const showCompletionAlert = (req: ServiceRequest) => {
    Alert.alert(
      "Servicio completado",
      "El profesional indico que el servicio fue completado. Lo confirmas?",
      [
        { text: "No, hay un problema", style: "destructive",
          onPress: () => Alert.alert("Problema reportado", "Contactanos para resolver el inconveniente.") },
        { text: "Si, confirmar y calificar",
          onPress: () => router.replace({
            pathname: "/rating",
            params: {
              service_request_id: String(req.id),
              rated_id:   String(req.assigned_barber_id || ""),
              rated_name: req.barber_name || "el profesional",
              redirect:   "/client/home",
            },
          }),
        },
      ],
      { cancelable: false }
    );
  };

  // ── Carga principal ───────────────────────────────────────────────────────
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
            price:     params.price ? Number(params.price) : undefined,
            latitude:  params.latitude  ? Number(params.latitude)  : undefined,
            longitude: params.longitude ? Number(params.longitude) : undefined,
            status:    (params.status as ServiceRequest["status"]) || "open",
          };
        }
      }
      if (!current) current = await getActiveRequest();
      if (current) setBids(await getBids(current.id));
      setRequest(current);
      if (current?.status === "completed" && !completedAlertShown.current) {
        completedAlertShown.current = true;
        setTimeout(() => showCompletionAlert(current!), 600);
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
      Alert.alert("Oferta aceptada", "El profesional fue asignado a tu servicio.");
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
    Alert.alert(
      "Cancelar servicio",
      "Estas seguro? Se aplicara una comision del 10% si cancelas.",
      [
        { text: "Mantener", style: "cancel" },
        { text: "Si, cancelar", style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/service-requests/${request.id}/status`, { status: "cancelled" });
              router.replace("/client/home");
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "No se pudo cancelar");
            }
          },
        },
      ]
    );
  };

  // ── Derivados ─────────────────────────────────────────────────────────────
  const acceptedBid   = bids.find((b) => b.status === "accepted");
  const pendingBids   = bids.filter((b) => b.status === "pending");
  const statusInfo    = STATUS_INFO[request?.status || "open"] || STATUS_INFO.open;
  const serviceActive = request?.status === "accepted" || request?.status === "on_route";
  const showTracking  = request?.status === "on_route" && !!professionalCoords;

  // Region del mapa
  const mapRegion = useMemo(() => {
    if (professionalCoords) {
      return {
        latitude:      professionalCoords.latitude,
        longitude:     professionalCoords.longitude,
        latitudeDelta:  0.012,
        longitudeDelta: 0.012,
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

  // Tiempo desde ultima actualizacion GPS
  const gpsAge = professionalCoords?.updated_at
    ? Math.round((Date.now() - professionalCoords.updated_at) / 1000)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: palette.background }}>
        <Text style={{ color: palette.text, marginBottom: 12 }}>No tienes solicitudes activas.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{ backgroundColor: palette.card, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}
        >
          <Text style={{ color: palette.text }}>Crear solicitud</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ backgroundColor: palette.background, paddingBottom: 36 }}>

      {/* MAPA — siempre visible si hay coordenadas */}
      {mapRegion ? (
        <View style={{ height: 260, position: "relative" }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
          >
            {/* Ubicacion del profesional (tiempo real) */}
            {professionalCoords && (
              <Marker
                coordinate={professionalCoords}
                title={acceptedBid?.name || "Profesional"}
                description="Ubicacion en tiempo real"
                pinColor="#2196F3"
              />
            )}
            {/* Ubicacion del servicio (fija) */}
            {request.latitude && request.longitude && (
              <Marker
                coordinate={{ latitude: request.latitude, longitude: request.longitude }}
                title="Lugar del servicio"
                description={request.address}
                pinColor="#D4AF37"
              />
            )}
          </MapView>

          {/* Badge estado GPS */}
          {showTracking && (
            <View style={{
              position: "absolute", top: 10, left: 10,
              backgroundColor: "#0a2a0a", borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 6,
              borderWidth: 1, borderColor: "#4caf50",
              flexDirection: "row", alignItems: "center", gap: 6,
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4caf50" }} />
              <Text style={{ color: "#4caf50", fontSize: 11 }}>
                En camino{gpsAge !== null ? ` · ${gpsAge}s` : ""}
              </Text>
            </View>
          )}

          {/* Sin tracking aun */}
          {serviceActive && !showTracking && (
            <View style={{
              position: "absolute", top: 10, left: 10,
              backgroundColor: "#1a1a00", borderRadius: 8,
              paddingHorizontal: 10, paddingVertical: 6,
              borderWidth: 1, borderColor: "#888",
            }}>
              <Text style={{ color: "#aaa", fontSize: 11 }}>
                Esperando que el profesional inicie el camino
              </Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
          Estado de tu solicitud
        </Text>

        {/* STATUS */}
        <View style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 12,
          borderWidth: 1, borderColor: statusInfo.color,
        }}>
          <Text style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}>
            {statusInfo.text}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>Solicitud #{request.id}</Text>
        </View>

        {/* DETALLES */}
        <Text style={{ color: palette.text }}>Servicio: {request.service_type || "No definido"}</Text>
        <Text style={{ color: palette.text }}>Direccion: {request.address || "No definida"}</Text>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>
          Precio: ${(request.price ?? 0).toLocaleString("es-CO")} COP
        </Text>
        {request.payment_method && (
          <Text style={{ color: "#aaa" }}>
            Medio de pago: {PAYMENT_LABELS[request.payment_method] || request.payment_method}
          </Text>
        )}

        {/* CONTRAOFERTAS */}
        {pendingBids.length > 0 && (
          <>
            <Text style={{ fontSize: 17, fontWeight: "700", color: palette.text }}>
              Contraofertas recibidas ({pendingBids.length})
            </Text>
            {pendingBids.map((bid) => (
              <View key={bid.id} style={{
                borderWidth: 1, borderColor: palette.primary, borderRadius: 10, padding: 14,
              }}>
                <Text style={{ color: palette.text }}>
                  Profesional: {bid.name || `#${bid.barber_id}`}
                </Text>
                <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 18 }}>
                  Oferta: ${bid.amount.toLocaleString("es-CO")}
                </Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    onPress={() => acceptBid(bid.id)} disabled={actingBidId === bid.id}
                    style={{ flex: 1, backgroundColor: "#0A7E07", padding: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
                      {actingBidId === bid.id ? "..." : "Aceptar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectBid(bid.id)} disabled={actingBidId === bid.id}
                    style={{ flex: 1, backgroundColor: "#b30000", padding: 10, borderRadius: 8 }}
                  >
                    <Text style={{ color: "#fff", textAlign: "center" }}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* OFERTA ACEPTADA */}
        {acceptedBid && (
          <View style={{
            backgroundColor: "#0a2a0a", padding: 14, borderRadius: 10,
            borderWidth: 1, borderColor: "#0A7E07",
          }}>
            <Text style={{ color: "#4caf50", fontWeight: "700", marginBottom: 4 }}>Oferta aceptada</Text>
            <Text style={{ color: palette.text }}>
              Profesional: {acceptedBid.name || `#${acceptedBid.barber_id}`}
            </Text>
            <Text style={{ color: palette.text }}>
              Valor acordado: ${acceptedBid.amount.toLocaleString("es-CO")} COP
            </Text>
          </View>
        )}

        {/* CHAT Y LLAMADA */}
        {serviceActive && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: "#888", fontSize: 12, textAlign: "center" }}>
              Comunicate con tu profesional
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push({
                  pathname: "/chat/[serviceRequestId]",
                  params: {
                    serviceRequestId: String(request.id),
                    otherUserName: acceptedBid?.name || "Profesional",
                  },
                })}
                style={{
                  flex: 1, backgroundColor: "#0d1b2e", padding: 16,
                  borderRadius: 12, borderWidth: 1, borderColor: "#4a90e2",
                  alignItems: "center", gap: 4,
                }}
              >
                <Text style={{ fontSize: 24 }}>💬</Text>
                <Text style={{ color: "#4a90e2", fontWeight: "700", fontSize: 15 }}>Chat</Text>
                <Text style={{ color: "#888", fontSize: 10 }}>Mensajes en tiempo real</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const phone = acceptedBid?.phone;
                  if (phone) Linking.openURL("tel:" + phone);
                  else Alert.alert("Telefono no disponible", "Usa el chat para comunicarte.");
                }}
                style={{
                  flex: 1, backgroundColor: "#0a2a0a", padding: 16,
                  borderRadius: 12, borderWidth: 1, borderColor: "#4caf50",
                  alignItems: "center", gap: 4,
                }}
              >
                <Text style={{ fontSize: 24 }}>📞</Text>
                <Text style={{ color: "#4caf50", fontWeight: "700", fontSize: 15 }}>Llamar</Text>
                <Text style={{ color: "#888", fontSize: 10 }}>Llamada directa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* BOTONES */}
        <TouchableOpacity
          onPress={loadStatus}
          style={{ backgroundColor: palette.primary, padding: 12, borderRadius: 8, alignItems: "center" }}
        >
          <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar estado</Text>
        </TouchableOpacity>

        {(request.status === "open" || request.status === "accepted" || request.status === "on_route") && (
          <TouchableOpacity
            onPress={cancelService}
            style={{ borderWidth: 1, borderColor: "#dd0000", padding: 12, borderRadius: 8, alignItems: "center" }}
          >
            <Text style={{ color: "#dd0000" }}>
              {request.status === "open" ? "Cancelar servicio" : "Cancelar servicio en curso"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/client/home")}
          style={{ borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 8, alignItems: "center" }}
        >
          <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}