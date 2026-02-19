import { clearSession } from "@/store/authStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";

type ActiveRequest = {
  id: number;
  service_type?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  price?: number;
  status?: string;
};

export default function ActiveJob() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [service, setService] = useState<ActiveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadActiveService = useCallback(async () => {
    try {
      if (id) {
        const detail = await api.get(`/service-request/${id}`);
        setService(detail.data);
        return;
      }

      const res = await api.get("/service-request/assigned/me");
      if (Array.isArray(res.data)) {
        setService(res.data[0] || null);
      } else {
        setService(res.data || null);
      }
    } catch (err: any) {
      console.log("❌ ERROR SERVICIO ACTIVO:", err?.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadActiveService();
    const timer = setInterval(loadActiveService, 8000);
    return () => clearInterval(timer);
  }, [loadActiveService]);

  const openMaps = async () => {
    if (!service?.latitude || !service?.longitude) {
      Alert.alert("Ubicación no disponible", "La solicitud no tiene coordenadas.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`;
    await Linking.openURL(url);
  };

  const updateStatus = async (nextStatus: "start" | "complete") => {
    if (!service?.id) return;

    try {
      setProcessing(true);
      await api.post(`/service-request/${service.id}/${nextStatus}`);
      await loadActiveService();

      if (nextStatus === "start") {
        Alert.alert("Servicio iniciado", "Se notificó al cliente que ya comenzaste.");
      } else {
        Alert.alert(
          "Servicio finalizado",
          "Se cerró la solicitud y se registró el pago para el barbero."
        );
        router.replace("/barber/home");
      }
    } catch (err: any) {
      console.log("❌ ERROR ACTUALIZANDO ESTADO:", err?.response?.data || err.message);
      Alert.alert("Error", "No se pudo actualizar el estado del servicio");
    } finally {
      setProcessing(false);
    }
  };

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={{ padding: 20, gap: 10 }}>
        <Text>No tienes solicitudes activas.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/barber/jobs")}
          style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>Buscar ofertas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Servicio activo</Text>
      <Text>Solicitud #{service.id}</Text>
      <Text>Estado: {service.status || "asignado"}</Text>
      <Text>Servicio: {service.service_type || "No definido"}</Text>
      <Text>Dirección: {service.address || "No definida"}</Text>
      <Text>Valor: ${service.price ?? 0}</Text>

      <TouchableOpacity
        onPress={openMaps}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Seguimiento en Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("start")}
        disabled={processing}
        style={{ backgroundColor: "#0A7E07", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          {processing ? "Procesando..." : "Llegué al cliente / Iniciar servicio"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("complete")}
        disabled={processing}
        style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          Finalizar servicio y registrar pago
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center" }}>Regresar al inicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={{ borderWidth: 1, borderColor: "#dd0000", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: "#dd0000" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}