import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const params = useLocalSearchParams<{
    id?: string;
    service_type?: string;
    address?: string;
    price?: string;
    latitude?: string;
    longitude?: string;
    status?: string;
  }>();
  const { id } = params;
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
  const getRequestById = async (requestId: number): Promise<ServiceRequest | null> => {
    const candidates = [
      `/service-requests/${requestId}`,
      `/service-request/${requestId}`,
    ];

    for (const path of candidates) {
      try {
        const res = await api.get(path);
        const data = Array.isArray(res.data)
          ? res.data[0]
          : res.data?.data || res.data?.request || res.data;
        if (data && typeof data === "object") {
          return data as ServiceRequest;
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
    }

    return null;
  };

  const getClientRequests = async (): Promise<ServiceRequest[]> => {
    const candidates = [
      "/service-requests/mine",
      "/service-request/mine",
      "/service-requests",
      "/service-request",
    ];

    for (const path of candidates) {
      try {
        const res = await api.get(path);
        const rows = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        if (rows.length > 0) {
          return rows as ServiceRequest[];
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) {
          throw err;
        }
      }
    }

    return [];
  };

  const loadStatus = useCallback(async () => {
    try {
      let current: ServiceRequest | undefined;
      let currentBids: Bid[] = [];

      if (id) {
        const requestId = Number(id);
        const byId = await getRequestById(requestId);
        if (byId) {
          current = byId;
        } else {
          current = {
            id: requestId,
            service_type: params.service_type,
            address: params.address,
            price: params.price ? Number(params.price) : undefined,
            latitude: params.latitude ? Number(params.latitude) : undefined,
            longitude: params.longitude ? Number(params.longitude) : undefined,
            status: (params.status as ServiceRequest["status"]) || "open",
          };
        }

        currentBids = await getBidsForRequest(requestId);
      }

      const allRequests: ServiceRequest[] = current ? [] : await getClientRequests();

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
  }, [id, params.address, params.latitude, params.longitude, params.price, params.service_type, params.status]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 5000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const acceptBid = async (bidId: number) => {
    try {
      setActingBidId(bidId);
      await api.patch(`/bids/accept/${bidId}`);
      Alert.alert(
        "Oferta aceptada",
        "Tu servicio fue asignado. El barbero verá esta solicitud en servicios activos."
      );
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
      const statusCode = err?.response?.status;
      if (statusCode === 404) {
        if (request?.id) {
          try {
            await api.patch(`/service-requests/${request.id}/status`, { status: "open" });
            setBids((prev) => prev.map((bid) => (bid.id === bidId ? { ...bid, status: "rejected" } : bid)));
            Alert.alert(
              "Rechazo aplicado (modo compatibilidad)",
              "Tu backend no expone PATCH /bids/reject/:bidId. Se dejó la solicitud en open para seguir recibiendo ofertas."
            );
            await loadStatus();
          } catch {
            Alert.alert(
              "Ruta faltante en backend",
              "Tu backend no expone PATCH /bids/reject/:bidId. Debes agregar esa ruta para rechazar contraofertas."
            );
          }
        } else {
          Alert.alert(
            "Ruta faltante en backend",
            "Tu backend no expone PATCH /bids/reject/:bidId. Debes agregar esa ruta para rechazar contraofertas."
          );
        }
      } else {
        Alert.alert(
          "Error",
          err?.response?.data?.error || "No se pudo rechazar la contraoferta"
        );
      }
    } finally {
      setActingBidId(null);
    }
  };

  const openBarberTracking = async () => {
    if (!request?.latitude || !request?.longitude) {
      Alert.alert("Ubicación no disponible", "Aún no hay coordenadas para seguimiento.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${request.latitude},${request.longitude}`;
    await WebBrowser.openBrowserAsync(url);
  };

  const acceptedBid = bids.find((b) => b.status === "accepted");
  const pendingBids = bids.filter((b) => b.status === "pending");

  const mapUrl = useMemo(() => {
    if (!request?.latitude || !request?.longitude) return null;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${request.latitude},${request.longitude}&zoom=15&size=800x360&markers=${request.latitude},${request.longitude},red-pushpin`;
  }, [request?.latitude, request?.longitude]);

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
        <Text style={{ color: palette.text }}>No tienes solicitudes activas.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/client/create-service")}
          style={{
            marginTop: 12,
            backgroundColor: palette.card,
            padding: 12,
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
        rowGap: 10,
        backgroundColor: palette.background,
        paddingBottom: 24,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
        Estado de tu solicitud
      </Text>
      <Text style={{ color: palette.text }}>Solicitud #{request.id}</Text>
      <Text style={{ color: palette.text }}>
        Servicio: {request.service_type || "No definido"}
      </Text>
      <Text style={{ color: palette.text }}>
        Dirección: {request.address || "No definida"}
      </Text>
      <Text style={{ color: palette.text }}>Precio inicial: ${request.price ?? 0}</Text>
      <Text style={{ color: palette.text }}>Estado backend: {request.status}</Text>

      {(request.status === "accepted" || request.status === "on_route") && acceptedBid && (
        <View style={{ backgroundColor: "#e8fff0", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>👤 Barbero asignado</Text>
          <Text style={{ marginTop: 6 }}>Nombre: {acceptedBid.name || "Barbero"}</Text>
          <Text>ID barbero: #{acceptedBid.barber_id ?? "N/A"}</Text>
          <Text style={{ marginTop: 6 }}>
            Seguimiento en tiempo real: el estado se actualiza automáticamente cada 5 segundos.
          </Text>
        </View>
      )}

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
          <Text style={{ marginTop: 6 }}>
            Tu solicitud fue asignada. El barbero ya puede verla como servicio activo.
          </Text>
        </View>
      )}

      {request.status === "on_route" && (
        <View style={{ backgroundColor: "#fff6e5", padding: 12, borderRadius: 8 }}>
          <Text style={{ fontWeight: "700" }}>🚗 Barbero en camino</Text>
        </View>
      )}

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
            Ubicación del servicio / seguimiento
          </Text>
          <Image source={{ uri: mapUrl }} style={{ width: "100%", height: 210 }} />
          <TouchableOpacity
            onPress={openBarberTracking}
            style={{ backgroundColor: "#1f4eb5", padding: 10 }}
          >
            <Text style={{ textAlign: "center", color: "#fff" }}>Abrir seguimiento</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          marginTop: 6,
          color: palette.text,
        }}
      >
        Contraofertas de barberos
      </Text>

      {bids.length === 0 && (
        <Text style={{ color: palette.text }}>Aún no hay contraofertas.</Text>
      )}

      {bids.map((bid) => (
        <View
          key={bid.id}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12 }}
        >
          <Text style={{ color: palette.text }}>
            Barbero: {bid.name || `#${bid.barber_id ?? "N/A"}`}
          </Text>
          <Text style={{ color: palette.text }}>Oferta: ${bid.amount}</Text>
          <Text style={{ color: palette.text }}>Estado oferta: {bid.status}</Text>

          {bid.status === "pending" && request.status === "open" && (
            <View style={{ flexDirection: "row", columnGap: 8, marginTop: 8 }}>
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
                <Text style={{ color: "#fff", textAlign: "center" }}>
                  {actingBidId === bid.id ? "Procesando..." : "Aceptar"}
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

      <TouchableOpacity
        onPress={loadStatus}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Actualizar estado</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}