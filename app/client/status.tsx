// app/client/status.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
};

type Bid = {
  id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  barber_id?: number;
  name?: string;
};

const STATUS_LABELS: Record<string, { icon: string; text: string; color: string }> = {
  open: { icon: "🔎", text: "Buscando profesional...", color: "#D4AF37" },
  accepted: { icon: "✅", text: "Profesional asignado", color: "#4caf50" },
  on_route: { icon: "🚗", text: "Profesional en camino", color: "#2196F3" },
  completed: { icon: "🎉", text: "Servicio completado", color: "#4caf50" },
  cancelled: { icon: "❌", text: "Servicio cancelado", color: "#dd0000" },
};

export default function ClientStatus() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    service_type?: string;
    address?: string;
    price?: string;
    latitude?: string;
    longitude?: string;
    status?: string;
  }>();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [actingBidId, setActingBidId] = useState<number | null>(null);
  const completedAlertShown = useRef(false);

  const getBids = async (requestId: number): Promise<Bid[]> => {
    try {
      const res = await api.get(`/bids/request/${requestId}`);
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      return data;
    } catch {
      return [];
    }
  };

  const getRequest = async (requestId: number): Promise<ServiceRequest | null> => {
    for (const path of [
      `/service-requests/${requestId}`,
      `/service-request/${requestId}`,
    ]) {
      try {
        const res = await api.get(path);
        const data = res.data?.data || res.data?.request || res.data;
        if (data && typeof data === "object" && !Array.isArray(data)) {
          return data as ServiceRequest;
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err;
      }
    }
    return null;
  };

  const loadStatus = useCallback(async () => {
    try {
      let current: ServiceRequest | null = null;

      if (params.id) {
        const reqId = Number(params.id);
        current = await getRequest(reqId);
        if (!current) {
          current = {
            id: reqId,
            service_type: params.service_type,
            address: params.address,
            price: params.price ? Number(params.price) : undefined,
            latitude: params.latitude ? Number(params.latitude) : undefined,
            longitude: params.longitude ? Number(params.longitude) : undefined,
            status: (params.status as ServiceRequest["status"]) || "open",
          };
        }
        const currentBids = await getBids(reqId);
        setBids(currentBids);
      }

      if (!current) {
        for (const path of ["/service-requests/mine", "/service-request/mine"]) {
          try {
            const res = await api.get(path);
            const rows: ServiceRequest[] = Array.isArray(res.data)
              ? res.data
              : res.data?.data || [];
            const active = rows.find(
              (r) => r.status !== "completed" && r.status !== "cancelled"
            );
            if (active) {
              current = active;
              break;
            }
          } catch {}
        }
      }

      setRequest(current);

      // Detectar cuando el profesional marcó el servicio como completado
      if (
        current?.status === "completed" &&
        !completedAlertShown.current
      ) {
        completedAlertShown.current = true;
        // Pequeño delay para que el UI cargue primero
        setTimeout(() => {
          showCompletionAlert(current!);
        }, 500);
      }
    } catch (err: any) {
      console.log("❌ ERROR STATUS:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  // Muestra alerta de confirmación al cliente cuando el profesional finaliza
  const showCompletionAlert = (req: ServiceRequest) => {
    Alert.alert(
      "🎉 Servicio completado",
      "El profesional indicó que el servicio fue completado. ¿Confirmas?",
      [
        {
          text: "No, hay un problema",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Problema reportado",
              "Por favor contáctanos para resolver el inconveniente."
            );
          },
        },
        {
          text: "Sí, confirmar y calificar",
          onPress: () => {
            const barberId = req.assigned_barber_id ?? "";
            const barberName = req.barber_name || "el profesional";
            router.replace({
              pathname: "/rating",
              params: {
                service_request_id: String(req.id),
                rated_id: String(barberId),
                rated_name: barberName,
                redirect: "/client/home",
              },
            });
          },
        },
      ],
      { cancelable: false }
    );
  };

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 5000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const acceptBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/accept/${bidId}`);
      Alert.alert("✅ Oferta aceptada", "El profesional fue asignado a tu servicio.");
      await loadStatus();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar");
    } finally {
      setActingBidId(null);
    }
  };

  const rejectBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/reject/${bidId}`);
      await loadStatus();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo rechazar");
    } finally {
      setActingBidId(null);
    }
  };

  const cancelService = async () => {
    if (!request?.id) return;
    Alert.alert(
      "Cancelar servicio",
      "¿Estás seguro? Se aplicará una comisión del 10% si cancelas.",
      [
        { text: "Mantener", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/service-requests/${request.id}/status`, {
                status: "cancelled",
              });
              Alert.alert("Servicio cancelado");
              router.replace("/client/home");
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "No se pudo cancelar");
            }
          },
        },
      ]
    );
  };

  const mapUrl = useMemo(() => {
    if (!request?.latitude || !request?.longitude) return null;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${request.latitude},${request.longitude}&zoom=15&size=800x360&markers=${request.latitude},${request.longitude},red-pushpin`;
  }, [request?.latitude, request?.longitude]);

  const acceptedBid = bids.find((b) => b.status === "accepted");
  const pendingBids = bids.filter((b) => b.status === "pending");
  const statusInfo =
    STATUS_LABELS[request?.status || "open"] || STATUS_LABELS.open;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          backgroundColor: palette.background,
        }}
      >
        <Text style={{ color: palette.text, marginBottom: 12 }}>
          No tienes solicitudes activas.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{
            backgroundColor: palette.card,
            padding: 14,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: palette.primary,
          }}
        >
          <Text style={{ color: palette.text }}>Crear solicitud</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        rowGap: 12,
        backgroundColor: palette.background,
        paddingBottom: 36,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
        Estado de tu solicitud
      </Text>

      {/* STATUS VISUAL */}
      <View
        style={{
          backgroundColor: palette.card,
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: statusInfo.color,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 28 }}>{statusInfo.icon}</Text>
        <View>
          <Text
            style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}
          >
            {statusInfo.text}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 12 }}>
            Solicitud #{request.id}
          </Text>
        </View>
      </View>

      <Text style={{ color: palette.text }}>
        Servicio: {request.service_type || "No definido"}
      </Text>
      <Text style={{ color: palette.text }}>
        Dirección: {request.address || "No definida"}
      </Text>
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        Precio: ${(request.price ?? 0).toLocaleString("es-CO")}
      </Text>

      {/* MAPA */}
      {mapUrl && (
        <View
          style={{
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <Text
            style={{
              color: palette.primary,
              textAlign: "center",
              fontWeight: "700",
              paddingVertical: 8,
              backgroundColor: "#101010",
            }}
          >
            Ubicación del servicio
          </Text>
          <Image source={{ uri: mapUrl }} style={{ width: "100%", height: 200 }} />
          <TouchableOpacity
            onPress={() =>
              WebBrowser.openBrowserAsync(
                `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`
              )
            }
            style={{ backgroundColor: "#1f4eb5", padding: 10 }}
          >
            <Text style={{ textAlign: "center", color: "#fff" }}>
              Abrir en Google Maps
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTRAOFERTAS PENDIENTES */}
      {pendingBids.length > 0 && (
        <>
          <Text
            style={{ fontSize: 17, fontWeight: "700", color: palette.text }}
          >
            Contraofertas recibidas
          </Text>
          {pendingBids.map((bid) => (
            <View
              key={bid.id}
              style={{
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <Text style={{ color: palette.text }}>
                Profesional: {bid.name || `#${bid.barber_id}`}
              </Text>
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  fontSize: 18,
                }}
              >
                Oferta: ${bid.amount.toLocaleString("es-CO")}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity
                  onPress={() => acceptBid(bid.id)}
                  disabled={actingBidId === bid.id}
                  style={{
                    flex: 1,
                    backgroundColor: "#0A7E07",
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      textAlign: "center",
                      fontWeight: "700",
                    }}
                  >
                    {actingBidId === bid.id ? "..." : "Aceptar"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => rejectBid(bid.id)}
                  disabled={actingBidId === bid.id}
                  style={{
                    flex: 1,
                    backgroundColor: "#b30000",
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: "#fff", textAlign: "center" }}>
                    Rechazar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {/* OFERTA ACEPTADA */}
      {acceptedBid && (
        <View
          style={{
            backgroundColor: "#0a2a0a",
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#0A7E07",
          }}
        >
          <Text style={{ color: "#4caf50", fontWeight: "700" }}>
            🎉 Oferta aceptada
          </Text>
          <Text style={{ color: palette.text }}>
            Profesional: {acceptedBid.name || `#${acceptedBid.barber_id}`}
          </Text>
          <Text style={{ color: palette.text }}>
            Valor acordado: ${acceptedBid.amount.toLocaleString("es-CO")}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={loadStatus}
        style={{
          backgroundColor: palette.primary,
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar estado</Text>
      </TouchableOpacity>

      {/* CANCELAR */}
      {request.status === "open" && (
        <TouchableOpacity
          onPress={cancelService}
          style={{
            borderWidth: 1,
            borderColor: "#dd0000",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#dd0000" }}>Cancelar servicio</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.replace("/client/home")}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}