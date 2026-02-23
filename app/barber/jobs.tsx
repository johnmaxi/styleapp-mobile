import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getBarberStats, markAssigned, setBarberStats } from "../../utils/barberStats";
import { getPalette } from "../../utils/palette";

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
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const loadOpenRequests = useCallback(async () => {
    try {
      setLoading(true);

      const activeFlag = await SecureStore.getItemAsync("barber_is_active");
      if (activeFlag === "0") {
        setIsActive(false);
        setRequests([]);
        return;
      }

      setIsActive(true);

      const endpoints = [
        "/service-requests/open",
        "/service-request/open",
        "/service-requests",
        "/service-request",
      ];

      let list: RequestItem[] = [];
      let lastError: any = null;

      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          const payload = res.data;
          const rows: RequestItem[] = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];

          list = rows.filter((item) => item.status === "open");
          break;
        } catch (err: any) {
          lastError = err;
          const statusCode = err?.response?.status;
          if (statusCode !== 404 && statusCode !== 403) {
            throw err;
          }
        }
      }

      if (!list.length && lastError?.response?.status === 403) {
        throw lastError;
      }

      setRequests(list);

      const currentStats = await getBarberStats();
      await setBarberStats({ ...currentStats, open: list.length });
    } catch (err: any) {
      console.log("❌ ERROR CARGANDO OFERTAS:", err?.response?.data || err.message);
      const statusCode = err?.response?.status;
      if (statusCode === 403) {
        Alert.alert(
          "Backend pendiente",
          "Tu backend está respondiendo 'Solo clientes' para listar solicitudes abiertas. Debes habilitar GET /service-requests/open para rol barber."
        );
      } else {
        Alert.alert("Error", err?.response?.data?.error || "No se pudieron cargar ofertas disponibles");
      }
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
      await markAssigned();

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
    <ScrollView contentContainerStyle={{ padding: 20, gap: 12, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>Ofertas disponibles</Text>

      {!isActive && (
        <Text style={{ color: "#ffcc66" }}>
          Estás inactivo. Activa recepción de solicitudes desde inicio barbero.
        </Text>
      )}

      {requests.length === 0 && (
        <Text style={{ marginTop: 20, color: palette.text }}>No hay solicitudes abiertas.</Text>
      )}

      {requests.map((item) => (
        <View
          key={item.id}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 14 }}
        >
          <Text style={{ fontWeight: "700", color: palette.text }}>Solicitud #{item.id}</Text>
          <Text style={{ color: palette.text }}>Servicio: {item.service_type || "No especificado"}</Text>
          <Text style={{ color: palette.text }}>Dirección: {item.address || "Sin dirección"}</Text>
          <Text style={{ color: palette.text }}>Precio ofertado: ${item.price ?? 0}</Text>

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
        <Text style={{ textAlign: "center", color: palette.text }}>Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}