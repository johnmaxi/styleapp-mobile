// app/barber/bids.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MyBid = {
  id: number;
  service_request_id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  service_type?: string;
  address?: string;
  original_price?: number;
  client_name?: string;
  created_at?: string;
};

const STATUS_CONFIG: Record<MyBid["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Pendiente", color: "#D4AF37", bg: "#1a1a00" },
  accepted: { label: "Aceptada", color: "#4caf50", bg: "#0a2a0a" },
  rejected: { label: "Rechazada", color: "#ff6b6b", bg: "#2a0a0a" },
};

export default function MyBidsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBids = useCallback(async () => {
    try {
      const res = await api.get("/bids/my-bids");
      const data: MyBid[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setBids(data);
    } catch (err: any) {
      console.log("Error cargando bids:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBids();
      const timer = setInterval(loadBids, 6000);
      return () => clearInterval(timer);
    }, [loadBids])
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: palette.background, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 16 }}>
        Mis ofertas
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 40 }} />
      ) : bids.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={{ color: "#aaa", textAlign: "center", fontSize: 15 }}>
            No has enviado ninguna oferta aun.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/barber/jobs")}
            style={{ marginTop: 16, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: palette.primary }}>Ver solicitudes disponibles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        bids.map((bid) => {
          const cfg = STATUS_CONFIG[bid.status];
          return (
            <View
              key={bid.id}
              style={{
                backgroundColor: cfg.bg,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: cfg.color + "88",
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: palette.text, fontWeight: "700", fontSize: 15 }}>
                  Solicitud #{bid.service_request_id}
                </Text>
                <View style={{ backgroundColor: cfg.color + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: cfg.color }}>
                  <Text style={{ color: cfg.color, fontWeight: "700", fontSize: 12 }}>
                    {cfg.label}
                  </Text>
                </View>
              </View>

              {bid.service_type && (
                <Text style={{ color: "#ccc", marginBottom: 2 }}>
                  Servicio: {bid.service_type}
                </Text>
              )}
              {bid.address && (
                <Text style={{ color: "#ccc", marginBottom: 2 }}>
                  Direccion: {bid.address}
                </Text>
              )}
              {bid.original_price && (
                <Text style={{ color: "#888", marginBottom: 4 }}>
                  Precio cliente: ${Number(bid.original_price).toLocaleString("es-CO")}
                </Text>
              )}
              <Text style={{ color: cfg.color, fontWeight: "700", fontSize: 16, marginTop: 4 }}>
                Tu oferta: ${Number(bid.amount).toLocaleString("es-CO")}
              </Text>

              {bid.status === "rejected" && (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/barber/offer",
                      params: {
                        requestId: String(bid.service_request_id),
                        currentPrice: String(bid.original_price || 0),
                        serviceType: bid.service_type || "",
                        address: bid.address || "",
                      },
                    })
                  }
                  style={{ marginTop: 10, borderWidth: 1, borderColor: palette.primary, padding: 10, borderRadius: 8, alignItems: "center" }}
                >
                  <Text style={{ color: palette.primary, fontWeight: "700" }}>Enviar nueva oferta</Text>
                </TouchableOpacity>
              )}

              {bid.status === "accepted" && (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: "/barber/active",
                      params: {
                        id: String(bid.service_request_id),
                        service_type: bid.service_type || "",
                        address: bid.address || "",
                        price: String(bid.amount),
                      },
                    })
                  }
                  style={{ marginTop: 10, backgroundColor: "#0A7E07", padding: 10, borderRadius: 8, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Ir al servicio activo</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      <TouchableOpacity
        onPress={loadBids}
        style={{ backgroundColor: palette.primary, padding: 12, borderRadius: 8, marginTop: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>Actualizar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 12, borderRadius: 8, marginTop: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
