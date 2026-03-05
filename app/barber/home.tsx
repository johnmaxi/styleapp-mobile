// app/barber/home.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

type MyBid = {
  id: number;
  service_request_id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  service_type?: string;
  address?: string;
};

type ActiveService = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  payment_method?: string;
};

const ROLE_LABELS: Record<string, string> = {
  barber: "Barbero",
  estilista: "Estilista",
  quiropodologo: "Quiropodologo",
};

export default function BarberHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);

  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [activeService, setActiveService] = useState<ActiveService | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = user?.name?.split(" ")[0] || "Profesional";
  const roleLabel = ROLE_LABELS[user?.role || ""] || "Profesional";

  const loadData = useCallback(async () => {
    try {
      // 1. Cargar servicio ASIGNADO directamente desde service_requests
      //    Esto recupera el servicio aunque el profesional haya salido de la app
      try {
        const assignedRes = await api.get("/service-requests/assigned/me");
        const assigned: ActiveService[] = Array.isArray(assignedRes.data)
          ? assignedRes.data
          : Array.isArray(assignedRes.data?.data)
          ? assignedRes.data.data
          : [];
        // Tomar el más reciente con status accepted o on_route
        const active = assigned.find(
          (s) => s.status === "accepted" || s.status === "on_route"
        );
        setActiveService(active || null);
      } catch {}

      // 2. Cargar mis bids para mostrar ofertas pendientes
      try {
        const bidsRes = await api.get("/bids/my-bids");
        const bids: MyBid[] = Array.isArray(bidsRes.data)
          ? bidsRes.data
          : Array.isArray(bidsRes.data?.data)
          ? bidsRes.data.data
          : [];
        setMyBids(bids.filter((b) => b.status === "pending"));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      const timer = setInterval(loadData, 8000);
      return () => clearInterval(timer);
    }, [loadData])
  );

  const goToActiveService = () => {
    if (!activeService) return;
    router.push({
      pathname: "/barber/active",
      params: {
        id: String(activeService.id),
        service_type: activeService.service_type || "",
        address: activeService.address || "",
        price: String(activeService.price || 0),
      },
    });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        paddingBottom: 40,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "900", color: palette.primary }}>
        Style
      </Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 4 }}>
        Bienvenido(a), {displayName}
      </Text>
      <Text style={{ color: "#aaa", marginBottom: 8 }}>Rol: {roleLabel}</Text>

      {/* SERVICIO ACTIVO — cargado desde service_requests/assigned/me */}
      {activeService && (
        <TouchableOpacity
          onPress={goToActiveService}
          style={{
            backgroundColor: "#0a2a0a",
            padding: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: activeService.status === "on_route" ? "#2196F3" : "#0A7E07",
          }}
        >
          <Text style={{
            color: activeService.status === "on_route" ? "#2196F3" : "#4caf50",
            fontWeight: "900", fontSize: 16,
          }}>
            {activeService.status === "on_route"
              ? "En camino al cliente"
              : "Tienes un servicio activo"}
          </Text>
          <Text style={{ color: "#ccc", marginTop: 4 }}>
            {activeService.service_type || "Servicio"} — Solicitud #{activeService.id}
          </Text>
          {activeService.address && (
            <Text style={{ color: "#aaa", marginTop: 2, fontSize: 12 }}>
              {activeService.address}
            </Text>
          )}
          {activeService.price != null && (
            <Text style={{ color: "#4caf50", marginTop: 4, fontWeight: "700" }}>
              ${Number(activeService.price).toLocaleString("es-CO")} COP
            </Text>
          )}
          <Text style={{ color: "#888", marginTop: 8, fontSize: 12 }}>
            Toca para continuar gestionando el servicio
          </Text>
        </TouchableOpacity>
      )}

      {/* OFERTAS PENDIENTES */}
      {myBids.length > 0 && (
        <View style={{
          backgroundColor: "#1a1a0a", padding: 14, borderRadius: 12,
          borderWidth: 1, borderColor: palette.primary,
        }}>
          <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 8 }}>
            Ofertas enviadas ({myBids.length})
          </Text>
          {myBids.map((bid) => (
            <View key={bid.id} style={{
              borderBottomWidth: 1, borderBottomColor: "#333",
              paddingBottom: 6, marginBottom: 6,
            }}>
              <Text style={{ color: "#ccc" }}>
                {bid.service_type || "Servicio"} — ${bid.amount.toLocaleString("es-CO")} COP
              </Text>
              <Text style={{ color: "#888", fontSize: 11 }}>
                Esperando respuesta del cliente...
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* SIN ACTIVIDAD */}
      {!activeService && myBids.length === 0 && (
        <View style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          alignItems: "center",
        }}>
          <Text style={{ color: "#888", textAlign: "center" }}>
            No tienes servicios activos ni ofertas pendientes.
          </Text>
        </View>
      )}

      {/* BOTONES DE NAVEGACION */}
      <TouchableOpacity
        onPress={() => router.push("/barber/jobs")}
        style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          borderWidth: 1, borderColor: palette.primary, alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          Ver solicitudes disponibles
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/history")}
        style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          borderWidth: 1, borderColor: palette.primary, alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          Historial de Solicitudes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          borderWidth: 1, borderColor: palette.primary, alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>Mi perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={async () => { await logout(); router.replace("/login"); }}
        style={{
          borderWidth: 1, borderColor: "#dd0000",
          padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8,
        }}
      >
        <Text style={{ color: "#dd0000", fontWeight: "700" }}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}