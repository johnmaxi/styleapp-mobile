// app/barber/jobs.tsx
import { SERVICE_CATALOG, formatPrice, roleToProType } from "@/constants/services";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getPalette } from "../../utils/palette";

type RequestItem = {
  id: number;
  service_type?: string;
  professional_type?: string;
  price?: number;
  address?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
};

type BidStatus = "none" | "pending" | "accepted" | "rejected";

// Estado de MIS bids por solicitud: { [service_request_id]: { bidId, status, amount } }
type MyBidMap = Record<number, { bidId: number; status: BidStatus; amount: number }>;

export default function Jobs() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [myBidMap, setMyBidMap] = useState<MyBidMap>({});
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Para detectar cambios de estado y notificar solo UNA vez por bid
  const notifiedRejected = useRef<Set<number>>(new Set());
  const notifiedAccepted = useRef<Set<number>>(new Set());

  const proType = user?.role ? roleToProType(user.role) : null;
  const allowedServices = proType
    ? SERVICE_CATALOG[proType].map((s) => s.label.toLowerCase())
    : [];

  const filterByProType = (items: RequestItem[]): RequestItem[] => {
    if (!proType) return [];
    return items.filter((item) => {
      if (item.professional_type) return item.professional_type === proType;
      if (!item.service_type) return false;
      const types = item.service_type.toLowerCase().split(",").map((s) => s.trim());
      return types.some((t) =>
        allowedServices.some((allowed) => t.includes(allowed) || allowed.includes(t))
      );
    });
  };

  // Cargar MIS bids activas para saber el estado por solicitud
  const loadMyBids = useCallback(async (): Promise<MyBidMap> => {
    try {
      const res = await api.get("/bids/my-bids");
      const bids: any[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      const map: MyBidMap = {};
      bids.forEach((bid) => {
        // Solo guardar la bid más reciente por solicitud
        const existing = map[bid.service_request_id];
        if (!existing || bid.id > existing.bidId) {
          map[bid.service_request_id] = {
            bidId: bid.id,
            status: bid.status as BidStatus,
            amount: Number(bid.amount),
          };
        }
      });
      return map;
    } catch {
      return {};
    }
  }, []);

  const loadOpenRequests = useCallback(async () => {
    try {
      const activeFlag = await SecureStore.getItemAsync("barber_is_active");
      if (activeFlag === "0") {
        setIsActive(false);
        setRequests([]);
        setLoading(false);
        return;
      }
      setIsActive(true);

      // Cargar solicitudes y mis bids en paralelo
      const [bidMap] = await Promise.all([loadMyBids()]);

      const endpoints = [
        "/service-requests/open",
        "/service-request/open",
        "/service-requests",
        "/service-request",
      ];
      let list: RequestItem[] = [];

      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          const payload = res.data;
          const rows: RequestItem[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
            ? payload.data
            : [];
          if (rows.length > 0 || endpoint.includes("open")) {
            list = rows;
            break;
          }
        } catch {}
      }

      const filtered = filterByProType(list);

      // Detectar cambios de estado y notificar
      Object.entries(bidMap).forEach(([reqId, bid]) => {
        const reqIdNum = Number(reqId);
        const req = filtered.find((r) => r.id === reqIdNum) ||
          list.find((r) => r.id === reqIdNum);
        const serviceLabel = req?.service_type || `#${reqId}`;

        if (bid.status === "rejected" && !notifiedRejected.current.has(bid.bidId)) {
          notifiedRejected.current.add(bid.bidId);
          Alert.alert(
            "❌ Contraoferta rechazada",
            `El cliente rechazó tu oferta de $${bid.amount.toLocaleString("es-CO")} para "${serviceLabel}".\n\nPuedes enviar una nueva contraoferta o buscar otra solicitud.`,
            [{ text: "Entendido" }]
          );
        }

        if (bid.status === "accepted" && !notifiedAccepted.current.has(bid.bidId)) {
          notifiedAccepted.current.add(bid.bidId);
          Alert.alert(
            "✅ ¡Contraoferta aceptada!",
            `El cliente aceptó tu oferta de $${bid.amount.toLocaleString("es-CO")} para "${serviceLabel}".`,
            [
              {
                text: "Ver servicio activo",
                onPress: () =>
                  router.push({
                    pathname: "/barber/active",
                    params: {
                      id: String(reqIdNum),
                      service_type: serviceLabel,
                      price: String(bid.amount),
                    },
                  }),
              },
            ]
          );
        }
      });

      setMyBidMap(bidMap);

      // Incluir también solicitudes donde ya tengo bid (para mostrar el estado)
      const allRelevantIds = new Set([
        ...filtered.map((r) => r.id),
        ...Object.keys(bidMap).map(Number),
      ]);

      // Agregar solicitudes con bids que ya no están en "open" (para mostrar estado)
      const withBidNotInList = Object.keys(bidMap)
        .map(Number)
        .filter((id) => !filtered.find((r) => r.id === id))
        .map((id) => list.find((r) => r.id === id))
        .filter(Boolean) as RequestItem[];

      setRequests([...filtered, ...withBidNotInList]);
    } catch (err) {
      console.log("Error cargando solicitudes:", err);
    } finally {
      setLoading(false);
    }
  }, [proType, loadMyBids]);

  useEffect(() => {
    loadOpenRequests();
    const timer = setInterval(loadOpenRequests, 6000);
    return () => clearInterval(timer);
  }, [loadOpenRequests]);

  const handleAccept = async (item: RequestItem) => {
    try {
      setActionLoadingId(item.id);
      await api.patch(`/service-requests/${item.id}/status`, { status: "accepted" });
      Alert.alert("¡Aceptado!", "Servicio asignado. Dirígete al cliente.");
      router.push({
        pathname: "/barber/active",
        params: {
          id: String(item.id),
          service_type: item.service_type || "",
          address: item.address || "",
          price: String(item.price ?? 0),
          latitude: String(item.latitude ?? 0),
          longitude: String(item.longitude ?? 0),
          status: "accepted",
        },
      });
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCounterOffer = (item: RequestItem) => {
    router.push({
      pathname: "/barber/offer",
      params: {
        requestId: String(item.id),
        currentPrice: String(item.price ?? 0),
        serviceType: item.service_type || "",
        address: item.address || "",
      },
    });
  };

  // Badge de estado de mi bid en esta solicitud
  const BidStatusBadge = ({ requestId }: { requestId: number }) => {
    const bid = myBidMap[requestId];
    if (!bid) return null;

    const config: Record<BidStatus, { label: string; bg: string; color: string }> = {
      none: { label: "", bg: "transparent", color: "transparent" },
      pending: { label: "⏳ Tu oferta: pendiente", bg: "#1a1a00", color: "#D4AF37" },
      accepted: { label: "✅ Tu oferta: aceptada", bg: "#0a2a0a", color: "#4caf50" },
      rejected: { label: "❌ Tu oferta: rechazada", bg: "#2a0a0a", color: "#ff6b6b" },
    };

    const c = config[bid.status];
    if (!c.label) return null;

    return (
      <View
        style={{
          backgroundColor: c.bg,
          borderRadius: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          marginTop: 8,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: c.color + "66",
        }}
      >
        <Text style={{ color: c.color, fontWeight: "700", fontSize: 13 }}>
          {c.label} — ${bid.amount.toLocaleString("es-CO")}
        </Text>
        {bid.status === "rejected" && (
          <Text style={{ color: "#aaa", fontSize: 11, marginTop: 2 }}>
            Puedes enviar una nueva contraoferta
          </Text>
        )}
        {bid.status === "accepted" && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/barber/active",
                params: { id: String(requestId), price: String(bid.amount) },
              })
            }
            style={{ marginTop: 4 }}
          >
            <Text style={{ color: "#4caf50", fontWeight: "700", fontSize: 12 }}>
              → Ir al servicio activo
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!proType) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: palette.text, textAlign: "center" }}>
          Tu perfil no tiene tipo de profesional asignado.
        </Text>
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.background, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#aaa", fontSize: 16, textAlign: "center" }}>
          Estás inactivo. Actívate desde el inicio para ver solicitudes.
        </Text>
        <TouchableOpacity onPress={() => router.replace("/barber/home")} style={{ marginTop: 16 }}>
          <Text style={{ color: palette.primary }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const proLabel =
    proType === "profesional"
      ? "Barbero"
      : proType === "estilista"
      ? "Estilista"
      : "Quiropodólogo";

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: palette.background, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 4 }}>
        Solicitudes disponibles
      </Text>
      <Text style={{ color: "#aaa", marginBottom: 16, fontSize: 13 }}>
        Mostrando para: {proLabel}
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 40 }} />
      ) : requests.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={{ color: "#aaa", fontSize: 16, textAlign: "center" }}>
            No hay solicitudes disponibles en este momento.
          </Text>
          <TouchableOpacity
            onPress={loadOpenRequests}
            style={{ marginTop: 16, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: palette.primary }}>Actualizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        requests.map((item) => {
          const myBid = myBidMap[item.id];
          const alreadySentBid = !!myBid;
          const isRejected = myBid?.status === "rejected";
          const isAccepted = myBid?.status === "accepted";
          const isPending = myBid?.status === "pending";

          return (
            <View
              key={item.id}
              style={{
                backgroundColor: palette.card,
                borderRadius: 12,
                padding: 16,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: isAccepted
                  ? "#4caf50"
                  : isRejected
                  ? "#ff6b6b44"
                  : palette.primary,
              }}
            >
              <Text style={{ color: palette.text, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                Solicitud #{item.id}
              </Text>
              <Text style={{ color: palette.text, marginBottom: 2 }}>
                📋 {item.service_type}
              </Text>
              <Text style={{ color: palette.text, marginBottom: 2 }}>
                📍 {item.address}
              </Text>
              <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 6 }}>
                💰 {item.price ? formatPrice(item.price) : "Sin precio"}
              </Text>

              {/* ESTADO DE MI BID EN ESTA SOLICITUD */}
              <BidStatusBadge requestId={item.id} />

              {/* BOTONES — solo mostrar si no hay bid activa o si fue rechazada */}
              {(!alreadySentBid || isRejected) && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleAccept(item)}
                    disabled={actionLoadingId === item.id}
                    style={{
                      flex: 1,
                      backgroundColor: "#0A7E07",
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {actionLoadingId === item.id ? "..." : "Aceptar precio"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCounterOffer(item)}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: palette.primary,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: palette.text }}>
                      {isRejected ? "Nueva oferta" : "Contraoferta"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Si tiene bid pendiente, mostrar mensaje en lugar de botones */}
              {isPending && (
                <Text style={{ color: "#aaa", fontSize: 12, marginTop: 8, textAlign: "center" }}>
                  Esperando respuesta del cliente...
                </Text>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity
        onPress={loadOpenRequests}
        style={{
          backgroundColor: palette.primary,
          padding: 12,
          borderRadius: 8,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{
          borderWidth: 1,
          borderColor: "#999",
          padding: 12,
          borderRadius: 8,
          marginTop: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
