// app/barber/jobs.tsx
import { SERVICE_CATALOG, formatPrice, roleToProType } from "@/constants/services";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView,
  Text, TouchableOpacity, View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getPalette } from "../../utils/palette";
import { playSound } from "@/utils/sounds";

type RequestItem = {
  id: number;
  service_type?:     string;
  professional_type?: string;
  price?:            number;
  address?:          string;
  status?:           string;
  latitude?:         number;
  longitude?:        number;
  payment_method?:   string;
  expires_at?:       string;
  // calculados en cliente
  distance?:         number;
  eta?:              string;
};

type BidStatus = "none" | "pending" | "accepted" | "rejected";
type MyBidMap  = Record<number, { bidId: number; status: BidStatus; amount: number }>;

// Calcular distancia entre dos puntos (Haversine)
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
               Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
               Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function etaText(km: number): string {
  const min = Math.round((km / 25) * 60);
  if (min < 2)  return "~2 min";
  if (min < 60) return `~${min} min`;
  return `~${Math.floor(min/60)}h ${min%60}min`;
}

function distText(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "💵 Efectivo",
  nequi:    "📱 Nequi",
  pse:      "🏦 PSE — Precio fijo",
  tarjeta:  "💳 Tarjeta — Precio fijo",
};

// Métodos con precio fijo — no permiten contraoferta
const FIXED_PRICE_METHODS = ["pse", "tarjeta"];

export default function Jobs() {
  const router   = useRouter();
  const { user } = useAuth();
  const palette  = getPalette(user?.gender);

  const [requests,        setRequests]        = useState<RequestItem[]>([]);
  const [myBidMap,        setMyBidMap]        = useState<MyBidMap>({});
  const [isActive,        setIsActive]        = useState(true);
  const [loading,         setLoading]         = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const notifiedRejected = useRef<Set<number>>(new Set());
  const notifiedAccepted = useRef<Set<number>>(new Set());
  const prevCountRef     = useRef<number>(-1);

  const proType         = user?.role ? roleToProType(user.role) : null;
  const allowedServices = proType
    ? SERVICE_CATALOG[proType].map((s) => s.label.toLowerCase())
    : [];

  const filterByProType = (items: RequestItem[]): RequestItem[] => {
    if (!proType) return [];
    return items.filter((item) => {
      if (item.professional_type) return item.professional_type === proType;
      if (!item.service_type)     return false;
      const types = item.service_type.toLowerCase().split(",").map((s) => s.trim());
      return types.some((t) =>
        allowedServices.some((a) => t.includes(a) || a.includes(t))
      );
    });
  };

  const loadMyBids = useCallback(async (): Promise<MyBidMap> => {
    try {
      const res  = await api.get("/bids/my-bids");
      const bids: any[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data : [];
      const map: MyBidMap = {};
      bids.forEach((bid) => {
        const existing = map[bid.service_request_id];
        if (!existing || bid.id > existing.bidId) {
          map[bid.service_request_id] = {
            bidId:  bid.id,
            status: bid.status as BidStatus,
            amount: Number(bid.amount),
          };
        }
      });
      return map;
    } catch { return {}; }
  }, []);

  const loadOpenRequests = useCallback(async () => {
    try {
      try {
        const statusRes = await api.get("/service-requests/active-status");
        if (statusRes.data?.is_active === false) {
          setIsActive(false);
          setRequests([]);
          setLoading(false);
          return;
        }
      } catch {}
      setIsActive(true);

      const bidMap = await loadMyBids();

      const endpoints = [
        "/service-requests/open",
        "/service-request/open",
        "/service-requests",
        "/service-request",
      ];
      let list: RequestItem[] = [];
      for (const endpoint of endpoints) {
        try {
          const res     = await api.get(endpoint);
          const payload = res.data;
          const rows: RequestItem[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
            ? payload.data : [];
          if (rows.length > 0 || endpoint.includes("open")) {
            list = rows;
            break;
          }
        } catch {}
      }

      const filtered = filterByProType(list);

      // Sonido si llegó solicitud nueva
      if (prevCountRef.current >= 0 && filtered.length > prevCountRef.current) {
        playSound("new_request");
      }
      prevCountRef.current = filtered.length;

      // Notificaciones de cambio de estado de bids
      Object.entries(bidMap).forEach(([reqId, bid]) => {
        const reqIdNum     = Number(reqId);
        const req          = filtered.find((r) => r.id === reqIdNum) || list.find((r) => r.id === reqIdNum);
        const serviceLabel = req?.service_type || `#${reqId}`;

        if (bid.status === "rejected" && !notifiedRejected.current.has(bid.bidId)) {
          notifiedRejected.current.add(bid.bidId);
          Alert.alert("Oferta rechazada", `El cliente rechazo tu oferta para "${serviceLabel}".`);
        }
        if (bid.status === "accepted" && !notifiedAccepted.current.has(bid.bidId)) {
          notifiedAccepted.current.add(bid.bidId);
          playSound("service_accepted");
          Alert.alert(
            "¡Oferta aceptada!",
            `El cliente acepto tu oferta para "${serviceLabel}". Ve al servicio activo.`,
            [{ text: "Ver servicio", onPress: () => router.push("/barber/home") }]
          );
        }
      });

      setMyBidMap(bidMap);
      setRequests(filtered);
    } catch (err) {
      console.log("ERROR loadOpenRequests:", err);
    } finally {
      setLoading(false);
    }
  }, [loadMyBids]);

  // Obtener ubicación del profesional para calcular distancia
  useEffect(() => {
    import("expo-location").then((Location) => {
      Location.getForegroundPermissionsAsync().then(({ status }) => {
        if (status === "granted") {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then((loc) => setMyLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }))
            .catch(() => {});
        }
      });
    });
  }, []);

  useEffect(() => {
    loadOpenRequests();
    const timer = setInterval(loadOpenRequests, 6000);
    return () => clearInterval(timer);
  }, [loadOpenRequests]);

  const handleAccept = async (item: RequestItem) => {
    try {
      setActionLoadingId(item.id);
      const res = await api.post("/bids/accept-direct", {
        service_request_id: item.id,
      });
      if (res.data?.ok) {
        playSound("service_accepted");
        Alert.alert("¡Aceptado!", "Servicio asignado. Dirígete al cliente.");
        router.push({
          pathname: "/barber/active",
          params: {
            id:           String(item.id),
            service_type: item.service_type || "",
            address:      item.address      || "",
            price:        String(item.price || 0),
            status:       "accepted",
          },
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar el servicio");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCounterOffer = (item: RequestItem) => {
    router.push({
      pathname: "/barber/offer",
      params: {
        requestId:    String(item.id),
        currentPrice: String(item.price ?? 0),
        serviceType:  item.service_type  || "",
        address:      item.address       || "",
      },
    });
  };

  const BID_BADGE: Record<BidStatus, { label: string; bg: string; color: string }> = {
    none:     { label: "",                      bg: "transparent", color: "transparent" },
    pending:  { label: "Tu oferta: pendiente",  bg: "#1a1a00",     color: "#D4AF37"    },
    accepted: { label: "Tu oferta: aceptada",   bg: "#0a2a0a",     color: "#4caf50"    },
    rejected: { label: "Tu oferta: rechazada",  bg: "#2a0a0a",     color: "#dd0000"    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  if (!isActive) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center",
        backgroundColor: palette.background, padding: 24 }}>
        <Text style={{ color: "#888", textAlign: "center", fontSize: 16, marginBottom: 16 }}>
          Estás inactivo. Activa tu disponibilidad desde el inicio para ver solicitudes.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/barber/home")}
          style={{ borderWidth: 1, borderColor: palette.primary, padding: 14,
            borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: palette.primary, fontWeight: "700" }}>Ir al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{
      padding: 20, backgroundColor: palette.background,
      gap: 14, paddingBottom: 40,
    }}>
      <Text style={{ fontSize: 22, fontWeight: "900", color: palette.text }}>
        Solicitudes disponibles
      </Text>

      {requests.length === 0 ? (
        <View style={{ backgroundColor: palette.card, padding: 20, borderRadius: 12,
          alignItems: "center", marginTop: 20 }}>
          <Text style={{ color: "#888", fontSize: 16, textAlign: "center" }}>
            No hay solicitudes disponibles ahora.
          </Text>
          <Text style={{ color: "#555", fontSize: 12, marginTop: 6, textAlign: "center" }}>
            Se actualizan cada 6 segundos automáticamente.
          </Text>
        </View>
      ) : (
        requests.map((item) => {
          const myBid       = myBidMap[item.id];
          const bidStatus   = myBid?.status || "none";
          const alreadySent = bidStatus === "pending" || bidStatus === "accepted";
          const isRejected  = bidStatus === "rejected";
          const isPending   = bidStatus === "pending";
          const badge       = BID_BADGE[bidStatus];
          const isFixedPrice = FIXED_PRICE_METHODS.includes(item.payment_method || "");

          return (
            <View key={item.id} style={{
              backgroundColor: palette.card, borderRadius: 12, padding: 16,
              borderWidth: 1,
              borderColor: bidStatus === "accepted" ? "#4caf50"
                         : bidStatus === "pending"  ? "#D4AF37"
                         : "#333",
            }}>
              {/* Servicio y dirección */}
              <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
                {item.service_type || "Servicio"}
              </Text>
              <Text style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>
                📍 {item.address || "Sin dirección"}
              </Text>
              <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 4 }}>
                💰 {item.price ? formatPrice(item.price) : "Sin precio"}
              </Text>

              {/* Distancia y tiempo estimado */}
              {myLocation && item.latitude && item.longitude && (() => {
                const km  = distanceKm(myLocation.lat, myLocation.lng, item.latitude, item.longitude);
                const eta = etaText(km);
                const dst = distText(km);
                return (
                  <Text style={{ color: "#4a90e2", fontSize: 12, marginBottom: 4 }}>
                    🚗 {dst} · {eta} desde tu ubicación
                  </Text>
                );
              })()}

              {/* Tiempo restante antes de expirar */}
              {item.expires_at && (() => {
                const remaining = Math.round((new Date(item.expires_at).getTime() - Date.now()) / 60000);
                if (remaining <= 0) return null;
                return (
                  <Text style={{ color: remaining <= 3 ? "#dd0000" : "#888", fontSize: 11, marginBottom: 4 }}>
                    ⏰ Expira en {remaining} min
                  </Text>
                );
              })()}

              {/* Método de pago */}
              {item.payment_method && (
                <Text style={{ color: isFixedPrice ? "#D4AF37" : "#888", fontSize: 12, marginBottom: 6 }}>
                  {PAYMENT_LABELS[item.payment_method] || item.payment_method}
                  {isFixedPrice ? " — sin contraofertas" : ""}
                </Text>
              )}

              {/* Badge estado bid */}
              {bidStatus !== "none" && (
                <View style={{
                  backgroundColor: badge.bg, paddingVertical: 4, paddingHorizontal: 10,
                  borderRadius: 6, alignSelf: "flex-start", marginBottom: 8,
                  borderWidth: 1, borderColor: badge.color + "55",
                }}>
                  <Text style={{ color: badge.color, fontSize: 12, fontWeight: "700" }}>
                    {badge.label}
                    {myBid?.amount ? ` — $${myBid.amount.toLocaleString("es-CO")}` : ""}
                  </Text>
                </View>
              )}

              {/* Botones */}
              {(!alreadySent || isRejected) && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => handleAccept(item)}
                    disabled={actionLoadingId === item.id}
                    style={{
                      flex: 1, backgroundColor: "#0A7E07",
                      paddingVertical: 10, borderRadius: 8, alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {actionLoadingId === item.id ? "..." : "Aceptar precio"}
                    </Text>
                  </TouchableOpacity>

                  {/* Solo mostrar Contraoferta si NO es precio fijo */}
                  {!isFixedPrice && (
                    <TouchableOpacity
                      onPress={() => handleCounterOffer(item)}
                      style={{
                        flex: 1, backgroundColor: "transparent",
                        borderWidth: 1, borderColor: palette.primary,
                        paddingVertical: 10, borderRadius: 8, alignItems: "center",
                      }}
                    >
                      <Text style={{ color: palette.text }}>
                        {isRejected ? "Nueva oferta" : "Contraoferta"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

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
        style={{ backgroundColor: palette.primary, padding: 12,
          borderRadius: 8, marginTop: 4, alignItems: "center" }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 12,
          borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
