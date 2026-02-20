import api from "@//api";
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

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [acceptingBidId, setAcceptingBidId] = useState<number | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const listRes = await api.get("/service-requests");
      const allRequests: ServiceRequest[] = Array.isArray(listRes.data)
        ? listRes.data
        : Array.isArray(listRes.data?.data)
          ? listRes.data.data
          : [];

      let current: ServiceRequest | undefined;
      if (id) {
        current = allRequests.find((r) => r.id === Number(id));
      }

      if (!current) {
        current = allRequests.find((r) => r.status !== "completed" && r.status !== "cancelled") || allRequests[0];
      }

      if (!current) {
        setRequest(null);
        setBids([]);
        return;
      }

      setRequest(current);

      const bidsRes = await api.get(`/bids/request/${current.id}`);
      const bidsData: Bid[] = Array.isArray(bidsRes.data)
        ? bidsRes.data
        : Array.isArray(bidsRes.data?.data)
          ? bidsRes.data.data
          : [];

      setBids(bidsData);
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
      setAcceptingBidId(bidId);
      await api.patch(`/bids/accept/${bidId}`);
      Alert.alert("Oferta aceptada", "Tu servicio fue asignado a un barbero.");
      await loadStatus();
    } catch (err: any) {
      console.log("❌ ERROR ACEPTANDO BID:", err?.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.error || "No se pudo aceptar la oferta");
    } finally {
      setAcceptingBidId(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text>No tienes solicitudes activas.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{ marginTop: 12, backgroundColor: "#111", padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: "#fff" }}>Crear solicitud</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const acceptedBid = bids.find((b) => b.status === "accepted");

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Estado de tu solicitud</Text>
      <Text>Solicitud #{request.id}</Text>
      <Text>Servicio: {request.service_type || "No definido"}</Text>
      <Text>Dirección: {request.address || "No definida"}</Text>
      <Text>Precio inicial: ${request.price ?? 0}</Text>
      <Text>Estado backend: {request.status}</Text>

      {request.status === "open" && (
        <View style={{ backgroundColor: "#eef5ff", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🔎 Buscando Barberos</Text>
          <Text style={{ marginTop: 6 }}>
            Esperando aceptación o nuevas contraofertas.
          </Text>
        </View>
      )}

      {request.status === "accepted" && (
        <View style={{ backgroundColor: "#e8fff0", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>✅ Oferta aceptada</Text>
          <Text style={{ marginTop: 6 }}>
            Tu solicitud fue asignada. El barbero iniciará el trayecto pronto.
          </Text>
        </View>
      )}

      {request.status === "on_route" && (
        <View style={{ backgroundColor: "#fff6e5", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🚗 Barbero en camino</Text>
          <Text style={{ marginTop: 6 }}>
            El servicio está en ruta hacia tu dirección.
          </Text>
        </View>
      )}

      {request.status === "completed" && (
        <View style={{ backgroundColor: "#f1f1f1", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🏁 Servicio completado</Text>
        </View>
      )}

      <Text style={{ fontSize: 18, fontWeight: "700", marginTop: 6 }}>
        Contraofertas de barberos
      </Text>

      {bids.length === 0 && (
        <Text>Aún no hay contraofertas.</Text>
      )}

      {bids.map((bid) => (
        <View
          key={bid.id}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12 }}
        >
          <Text>Barbero: {bid.name || `#${bid.barber_id ?? "N/A"}`}</Text>
          <Text>Oferta: ${bid.amount}</Text>
          <Text>Estado oferta: {bid.status}</Text>

          {bid.status === "pending" && request.status === "open" && (
            <TouchableOpacity
              onPress={() => acceptBid(bid.id)}
              disabled={acceptingBidId === bid.id}
              style={{ backgroundColor: "#0A7E07", padding: 10, borderRadius: 8, marginTop: 8 }}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>
                {acceptingBidId === bid.id ? "Aceptando..." : "Aceptar contraoferta"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {acceptedBid && (
        <View style={{ backgroundColor: "#e8fff0", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🎉 Ya aceptaste una contraoferta</Text>
          <Text>Oferta ganadora: ${acceptedBid.amount}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={loadStatus}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Actualizar estado</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}