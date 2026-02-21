import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  status?: "open" | "accepted" | "on_route" | "completed" | "cancelled";
};

type Bid = {
  id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  barber_id?: number;
  name?: string;
};

export default function ClientStatus() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [actingBidId, setActingBidId] = useState<number | null>(null);

  const getBidsForRequest = async (requestId: number) => {
    const bidsRes = await api.get(`/bids/request/${requestId}`);
    return Array.isArray(bidsRes.data)
      ? bidsRes.data
      : Array.isArray(bidsRes.data?.data)
        ? bidsRes.data.data
        : [];
  };

  const loadStatus = useCallback(async () => {
    try {
      const listRes = await api.get("/service-requests");
      const allRequests: ServiceRequest[] = Array.isArray(listRes.data)
        ? listRes.data
        : Array.isArray(listRes.data?.data)
          ? listRes.data.data
          : [];

      let current: ServiceRequest | undefined;
      let currentBids: Bid[] = [];

      if (id) {
        current = allRequests.find((r) => r.id === Number(id));
        if (current) currentBids = await getBidsForRequest(current.id);
      }

      if (!current) {
        const ordered = [...allRequests].sort((a, b) => b.id - a.id);
        for (const req of ordered) {
          if (req.status === "completed" || req.status === "cancelled") continue;
          const reqBids = await getBidsForRequest(req.id);
          const hasPendingOrAcceptedBid = reqBids.some(
            (b: Bid) => b.status === "pending" || b.status === "accepted"
          );

          if (hasPendingOrAcceptedBid) {
            current = req;
            currentBids = reqBids;
            break;
          }

          if (!current) {
            current = req;
            currentBids = reqBids;
          }
        }
      }

      if (!current) {
        setRequest(null);
        setBids([]);
        return;
      }

      setRequest(current);
      setBids(currentBids);
    } catch (err: any) {
      console.log("❌ ERROR STATUS CLIENTE:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 6000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const acceptBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/accept/${bidId}`);
      Alert.alert("Oferta aceptada", "Tu servicio fue asignado a un barbero.");
      await loadStatus();
    } catch (err: any) {
      console.log("❌ ERROR ACEPTANDO BID:", err?.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar la oferta");
    } finally {
      setActingBidId(null);
    }
  };

  const rejectBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/reject/${bidId}`);
      Alert.alert("Oferta rechazada", "Rechazaste la contraoferta del barbero.");
      await loadStatus();
    } catch (err: any) {
      console.log("❌ ERROR RECHAZANDO BID:", err?.response?.data || err.message);
      Alert.alert(
        "Pendiente backend",
        "Tu backend aún no expone PATCH /bids/reject/:bidId. Agrega esa ruta para rechazar contraofertas."
      );
    } finally {
      setActingBidId(null);
    }
  };

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
        <Text style={{ color: palette.text }}>No tienes solicitudes activas.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{ marginTop: 12, backgroundColor: palette.card, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}
        >
          <Text style={{ color: palette.text }}>Crear solicitud</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const acceptedBid = bids.find((b) => b.status === "accepted");
  const pendingBids = bids.filter((b) => b.status === "pending");

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 10, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>Estado de tu solicitud</Text>
      <Text style={{ color: palette.text }}>Solicitud #{request.id}</Text>
      <Text style={{ color: palette.text }}>Servicio: {request.service_type || "No definido"}</Text>
      <Text style={{ color: palette.text }}>Dirección: {request.address || "No definida"}</Text>
      <Text style={{ color: palette.text }}>Precio inicial: ${request.price ?? 0}</Text>
      <Text style={{ color: palette.text }}>Estado backend: {request.status}</Text>

      {request.status === "open" && (
        <View style={{ backgroundColor: "#eef5ff", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🔎 Buscando Barberos</Text>
          <Text style={{ marginTop: 6 }}>
            {pendingBids.length > 0
              ? "Tienes contraofertas pendientes. Acepta o rechaza una."
              : "Esperando contraofertas de barberos."}
          </Text>
        </View>
      )}

      {request.status === "accepted" && (
        <View style={{ backgroundColor: "#e8fff0", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>✅ Oferta aceptada</Text>
          <Text style={{ marginTop: 6 }}>Tu solicitud fue asignada.</Text>
        </View>
      )}

      {request.status === "on_route" && (
        <View style={{ backgroundColor: "#fff6e5", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🚗 Barbero en camino</Text>
        </View>
      )}

      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 6, color: palette.text }}>
        Contraofertas de barberos
      </Text>

      {bids.length === 0 && <Text style={{ color: palette.text }}>Aún no hay contraofertas.</Text>}

      {bids.map((bid) => (
        <View key={bid.id} style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12 }}>
          <Text style={{ color: palette.text }}>Barbero: {bid.name || `#${bid.barber_id ?? "N/A"}`}</Text>
          <Text style={{ color: palette.text }}>Oferta: ${bid.amount}</Text>
          <Text style={{ color: palette.text }}>Estado oferta: {bid.status}</Text>

          {bid.status === "pending" && request.status === "open" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => acceptBid(bid.id)}
                disabled={actingBidId === bid.id}
                style={{ flex: 1, backgroundColor: "#0A7E07", padding: 10, borderRadius: 8 }}
              >
                <Text style={{ color: "#fff", textAlign: "center" }}>
                  {actingBidId === bid.id ? "Procesando..." : "Aceptar"}
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
          )}
        </View>
      ))}

      {acceptedBid && (
        <View style={{ backgroundColor: "#e8fff0", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🎉 Ya aceptaste una contraoferta</Text>
          <Text>Oferta ganadora: ${acceptedBid.amount}</Text>
        </View>
      )}

      <TouchableOpacity onPress={loadStatus} style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Actualizar estado</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}