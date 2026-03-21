// app/barber/home.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, ScrollView,
  Switch, Text, TouchableOpacity, View,
} from "react-native";
import { playSound } from "@/utils/sounds";

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
  barber:        "Barbero",
  estilista:     "Estilista",
  quiropodologo: "Quiropodologo",
};

export default function BarberHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);

  const [myBids,        setMyBids]        = useState<MyBid[]>([]);
  const [activeService, setActiveService] = useState<ActiveService | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [isActive,      setIsActive]      = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);

  const prevOpenCountRef = useRef<number>(-1);
  const prevBidsCountRef = useRef<number>(-1);

  const displayName = user?.name?.split(" ")[0] || "Profesional";
  const roleLabel   = ROLE_LABELS[user?.role || ""] || "Profesional";

  // ── Registrar push token y actualizar ubicación ───────────────────────
  usePushNotifications(user?.id, user?.role);

  const loadData = useCallback(async () => {
    try {
      try {
        const statusRes = await api.get("/service-requests/active-status");
        setIsActive(statusRes.data?.is_active ?? true);
      } catch {}

      try {
        const assignedRes = await api.get("/service-requests/assigned/me");
        const assigned: ActiveService[] = Array.isArray(assignedRes.data)
          ? assignedRes.data
          : Array.isArray(assignedRes.data?.data)
          ? assignedRes.data.data : [];
        const active = assigned.find(
          (s) => s.status === "accepted" || s.status === "on_route" || s.status === "arrived"
        );
        setActiveService(active || null);
      } catch {}

      try {
        const bidsRes = await api.get("/bids/my-bids");
        const bids: MyBid[] = Array.isArray(bidsRes.data)
          ? bidsRes.data
          : Array.isArray(bidsRes.data?.data)
          ? bidsRes.data.data : [];
        const pending = bids.filter((b) => b.status === "pending");
        setMyBids(pending);

        if (prevBidsCountRef.current > 0 && pending.length < prevBidsCountRef.current) {
          playSound("service_accepted");
        }
        prevBidsCountRef.current = pending.length;
      } catch {}

      try {
        const openRes = await api.get("/service-requests/open");
        const open = Array.isArray(openRes.data)
          ? openRes.data
          : openRes.data?.data || [];

        if (prevOpenCountRef.current >= 0 && open.length > prevOpenCountRef.current) {
          playSound("new_request");
        }
        prevOpenCountRef.current = open.length;
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

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const res = await api.patch("/service-requests/toggle-active");
      const newActive = res.data?.is_active ?? !isActive;
      setIsActive(newActive);
      Alert.alert(
        newActive ? "Ahora estas activo" : "Ahora estas inactivo",
        newActive
          ? "Ya puedes recibir y aceptar solicitudes de servicio."
          : "No recibiras nuevas solicitudes mientras estes inactivo."
      );
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo cambiar el estado");
    } finally {
      setTogglingActive(false);
    }
  };

  const goToActiveService = () => {
    if (!activeService) return;
    router.push({
      pathname: "/barber/active",
      params: {
        id:           String(activeService.id),
        service_type: activeService.service_type || "",
        address:      activeService.address || "",
        price:        String(activeService.price || 0),
        status:       activeService.status || "accepted",
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
    <ScrollView contentContainerStyle={{
      padding: 24, backgroundColor: palette.background,
      paddingBottom: 40, gap: 12,
    }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: palette.primary }}>Style</Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 2 }}>
        Hola, {displayName}
      </Text>
      <Text style={{ color: "#888", marginBottom: 4 }}>Rol: {roleLabel}</Text>

      {/* ── TOGGLE ACTIVO / INACTIVO ── */}
      <View style={{
        backgroundColor: isActive ? "#0a2a0a" : "#1a1a1a",
        borderRadius: 14, borderWidth: 2,
        borderColor: isActive ? "#4caf50" : "#555",
        padding: 16,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: isActive ? "#4caf50" : "#555",
            }} />
            <Text style={{
              color: isActive ? "#4caf50" : "#888",
              fontWeight: "900", fontSize: 16,
            }}>
              {isActive ? "Activo" : "Inactivo"}
            </Text>
          </View>
          <Text style={{ color: "#888", fontSize: 12 }}>
            {isActive
              ? "Recibes solicitudes y puedes ofertar"
              : "No recibes solicitudes nuevas"}
          </Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={handleToggleActive}
          disabled={togglingActive}
          trackColor={{ false: "#333", true: "#1a4d1a" }}
          thumbColor={isActive ? "#4caf50" : "#666"}
          ios_backgroundColor="#333"
        />
      </View>

      {/* ── SERVICIO ACTIVO ── */}
      {activeService && (
        <TouchableOpacity
          onPress={goToActiveService}
          style={{
            backgroundColor: "#0a1a2a",
            padding: 16, borderRadius: 12, borderWidth: 2,
            borderColor: activeService.status === "on_route" ? "#2196F3"
                       : activeService.status === "arrived"  ? "#9C27B0"
                       : "#0A7E07",
          }}
        >
          <Text style={{
            color: activeService.status === "on_route" ? "#2196F3"
                 : activeService.status === "arrived"  ? "#9C27B0"
                 : "#4caf50",
            fontWeight: "900", fontSize: 16,
          }}>
            {activeService.status === "on_route" ? "🚗 En camino al cliente"
           : activeService.status === "arrived"  ? "📍 Llegaste al cliente"
           : "✅ Tienes un servicio activo"}
          </Text>
          <Text style={{ color: "#ccc", marginTop: 4 }}>
            {activeService.service_type || "Servicio"} — Solicitud #{activeService.id}
          </Text>
          {activeService.address && (
            <Text style={{ color: "#aaa", marginTop: 2, fontSize: 12 }}>{activeService.address}</Text>
          )}
          {activeService.price != null && (
            <Text style={{ color: "#4caf50", marginTop: 4, fontWeight: "700" }}>
              ${Number(activeService.price).toLocaleString("es-CO")} COP
            </Text>
          )}
          <Text style={{ color: "#4a90e2", marginTop: 8, fontSize: 12, fontWeight: "700" }}>
            Toca para continuar gestionando →
          </Text>
        </TouchableOpacity>
      )}

      {/* ── OFERTAS PENDIENTES ── */}
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

      {!activeService && myBids.length === 0 && (
        <View style={{ backgroundColor: palette.card, padding: 16, borderRadius: 10, alignItems: "center" }}>
          <Text style={{ color: "#888", textAlign: "center" }}>
            {isActive
              ? "No tienes servicios activos ni ofertas pendientes."
              : "Activa tu disponibilidad para empezar a recibir solicitudes."}
          </Text>
        </View>
      )}

      {isActive && (
        <TouchableOpacity
          onPress={() => router.push("/barber/jobs")}
          style={{
            backgroundColor: palette.card, padding: 16, borderRadius: 10,
            borderWidth: 1, borderColor: palette.primary, alignItems: "center",
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>Ver solicitudes disponibles</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.push("/barber/history")}
        style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          borderWidth: 1, borderColor: palette.primary, alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>Historial de Solicitudes</Text>
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
        onPress={async () => {
          try {
            await logout();
          } catch {}
          // Pequeño delay para asegurar que el estado se limpie antes de navegar
          setTimeout(() => {
            router.replace("/login");
          }, 100);
        }}
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
