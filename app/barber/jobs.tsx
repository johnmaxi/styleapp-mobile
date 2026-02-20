import { useRouter } from "expo-router";
import api from "../../api";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type RequestItem = {
  id: number;
  service_type?: string;
  price?: number;
  address?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
};

export default function Jobs() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadOpenRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/service-requests/open");

      const payload = res.data;
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setRequests(list);
    } catch (err: any) {
      console.log("❌ ERROR CARGANDO OFERTAS:", err?.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.error || "No se pudieron cargar ofertas disponibles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOpenRequests();
  }, [loadOpenRequests]);

  const acceptRequest = async (item: RequestItem) => {
    try {
      setActionLoadingId(item.id);

      await api.patch(`/service-requests/${item.id}/status`, {
        status: "accepted",
      });

      Alert.alert(
        "Solicitud aceptada",
        "La solicitud cambió a estado accepted."
      );

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
      console.log("❌ ERROR ACEPTANDO SOLICITUD:", err?.response?.data || err.message);
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No fue posible aceptar la solicitud"
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Ofertas disponibles</Text>

      {requests.length === 0 && (
        <Text style={{ marginTop: 20 }}>No hay solicitudes abiertas.</Text>
      )}

      {requests.map((item) => (
        <View
          key={item.id}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14 }}
        >
          <Text style={{ fontWeight: "700" }}>Solicitud #{item.id}</Text>
          <Text>Servicio: {item.service_type || "No especificado"}</Text>
          <Text>Dirección: {item.address || "Sin dirección"}</Text>
          <Text>Precio ofertado: ${item.price ?? 0}</Text>

          <TouchableOpacity
            onPress={() => acceptRequest(item)}
            disabled={actionLoadingId === item.id}
            style={{ backgroundColor: "#0A7E07", padding: 12, marginTop: 10, borderRadius: 8 }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>
              {actionLoadingId === item.id ? "Aceptando..." : "Aceptar oferta"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/barber/offer",
                params: {
                  id: String(item.id),
                  price: String(item.price ?? ""),
                },
              })
            }
            style={{ backgroundColor: "#111", padding: 12, marginTop: 8, borderRadius: 8 }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>Enviar contraoferta</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        onPress={loadOpenRequests}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Actualizar ofertas</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center" }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}