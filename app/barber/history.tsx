// app/barber/history.tsx
// Historial de solicitudes del profesional — usa service_requests directamente, NO bids
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

type ServiceRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  created_at?: string;
  payment_method?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Completado", color: "#4caf50", bg: "#0a2a0a" },
  cancelled:  { label: "Cancelado",  color: "#ff6b6b", bg: "#2a0a0a" },
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  pse: "PSE",
  nequi: "Nequi",
  daviplata: "Daviplata",
};

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      // Endpoint dedicado: service_requests donde assigned_barber_id = yo
      // y status IN (completed, cancelled)
      const res = await api.get("/service-requests/my-history");
      const data: ServiceRequest[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      setItems(data);
    } catch (err: any) {
      console.log("Error historial:", err?.response?.data || err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));

  const formatDate = (d?: string) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return d; }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, backgroundColor: palette.background, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 4 }}>
        Historial de Solicitudes
      </Text>
      <Text style={{ color: "#aaa", fontSize: 13, marginBottom: 16 }}>
        Servicios completados y cancelados
      </Text>

      {loading ? (
        <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={{ color: "#aaa", textAlign: "center", fontSize: 15 }}>
            Aun no tienes servicios en el historial.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/barber/jobs")}
            style={{ marginTop: 16, borderWidth: 1, borderColor: palette.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
          >
            <Text style={{ color: palette.primary }}>Ver solicitudes disponibles</Text>
          </TouchableOpacity>
        </View>
      ) : (
        items.map((item) => {
          const cfg = STATUS_CONFIG[item.status || ""] || STATUS_CONFIG.cancelled;
          return (
            <View
              key={item.id}
              style={{ backgroundColor: cfg.bg, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: cfg.color + "66" }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ color: palette.text, fontWeight: "700", fontSize: 15 }}>
                  Solicitud #{item.id}
                </Text>
                <View style={{ backgroundColor: cfg.color + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: cfg.color }}>
                  <Text style={{ color: cfg.color, fontWeight: "700", fontSize: 12 }}>{cfg.label}</Text>
                </View>
              </View>

              {item.service_type && (
                <Text style={{ color: "#ccc", marginBottom: 2 }}>Servicio: {item.service_type}</Text>
              )}
              {item.address && (
                <Text style={{ color: "#ccc", marginBottom: 2 }}>Direccion: {item.address}</Text>
              )}
              {item.payment_method && (
                <Text style={{ color: "#aaa", marginBottom: 2 }}>
                  Pago: {PAYMENT_LABELS[item.payment_method] || item.payment_method}
                </Text>
              )}
              {item.created_at && (
                <Text style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>
                  Fecha: {formatDate(item.created_at)}
                </Text>
              )}
              <Text style={{ color: cfg.color, fontWeight: "700", fontSize: 16, marginTop: 4 }}>
                Valor: ${item.price != null ? Number(item.price).toLocaleString("es-CO") : "0"} COP
              </Text>
            </View>
          );
        })
      )}

      <TouchableOpacity
        onPress={loadHistory}
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