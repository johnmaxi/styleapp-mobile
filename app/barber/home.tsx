// app/barber/home.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

type MyBid = {
  id: number;
  service_request_id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  service_type?: string;
  address?: string;
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

  const displayName = user?.name?.split(" ")[0] || "Profesional";
  const roleLabel = ROLE_LABELS[user?.role || ""] || "Profesional";

  const loadMyBids = useCallback(async () => {
    try {
      const res = await api.get("/bids/my-bids");
      const bids: MyBid[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];
      // Solo mostrar bids pendientes o aceptadas — rechazadas y completadas no aparecen en inicio
      setMyBids(bids.filter((b) => b.status === "pending" || b.status === "accepted"));
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyBids();
      const timer = setInterval(loadMyBids, 8000);
      return () => clearInterval(timer);
    }, [loadMyBids])
  );

  // Solo mostrar UN servicio activo (aceptado)
  const acceptedBid = myBids.find((b) => b.status === "accepted");
  // Ofertas pendientes (sin la aceptada)
  const pendingBids = myBids.filter((b) => b.status === "pending");

  return (
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: palette.background, paddingBottom: 40, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: palette.primary }}>
        STYLEAPP
      </Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 4 }}>
        Bienvenido(a), {displayName}
      </Text>
      <Text style={{ color: "#aaa", marginBottom: 8 }}>Rol: {roleLabel}</Text>

      {/* SERVICIO ACTIVO - solo si hay uno aceptado Y no completado */}
      {acceptedBid && (
        <TouchableOpacity
          onPress={() => router.push({
            pathname: "/barber/active",
            params: {
              id: String(acceptedBid.service_request_id),
              service_type: acceptedBid.service_type || "",
              address: acceptedBid.address || "",
              price: String(acceptedBid.amount),
            },
          })}
          style={{ backgroundColor: "#0a2a0a", padding: 16, borderRadius: 12, borderWidth: 2, borderColor: "#0A7E07" }}
        >
          <Text style={{ color: "#4caf50", fontWeight: "900", fontSize: 16 }}>
            Tienes un servicio activo
          </Text>
          <Text style={{ color: "#aaa", marginTop: 4 }}>
            {acceptedBid.service_type} - ${acceptedBid.amount.toLocaleString("es-CO")}
          </Text>
          <Text style={{ color: "#4caf50", marginTop: 6, fontWeight: "700" }}>
            Toca para ir al servicio
          </Text>
        </TouchableOpacity>
      )}

      {/* OFERTAS PENDIENTES - solo las que esperan respuesta */}
      {pendingBids.length > 0 && (
        <View style={{ backgroundColor: "#1a1a0a", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.primary }}>
          <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 8 }}>
            Ofertas enviadas ({pendingBids.length})
          </Text>
          {pendingBids.map((bid) => (
            <Text key={bid.id} style={{ color: "#ccc", marginBottom: 4 }}>
              {bid.service_type} - ${bid.amount.toLocaleString("es-CO")} - esperando respuesta
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.push("/barber/jobs")}
        style={{ backgroundColor: palette.card, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, alignItems: "center" }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>Ver solicitudes disponibles</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/bids")}
        style={{ backgroundColor: palette.card, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, alignItems: "center" }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>Mis ofertas</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{ backgroundColor: palette.card, padding: 16, borderRadius: 10, borderWidth: 1, borderColor: palette.primary, alignItems: "center" }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>Mi perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={async () => { await logout(); router.replace("/login"); }}
        style={{ borderWidth: 1, borderColor: "#dd0000", padding: 14, borderRadius: 10, alignItems: "center", marginTop: 8 }}
      >
        <Text style={{ color: "#dd0000", fontWeight: "700" }}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}