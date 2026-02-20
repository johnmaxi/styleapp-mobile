import { clearSession } from "@/store/authStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import api from "../../api";

export default function ActiveJob() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    service_type?: string;
    address?: string;
    latitude?: string;
    longitude?: string;
    price?: string;
    status?: string;
  }>();

  const serviceId = params.id ? Number(params.id) : null;
  const latitude = Number(params.latitude || 0);
  const longitude = Number(params.longitude || 0);

  const openMaps = async () => {
    if (!latitude || !longitude) {
      Alert.alert("Ubicación no disponible", "La solicitud no tiene coordenadas válidas.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    await Linking.openURL(url);
  };

  const updateStatus = async (status: "on_route" | "completed") => {
    if (!serviceId) {
      Alert.alert("Error", "No se encontró la solicitud activa");
      return;
    }

    try {
      await api.patch(`/service-requests/${serviceId}/status`, { status });

      if (status === "on_route") {
        Alert.alert("Servicio iniciado", "Estado actualizado a on_route.");
      } else {
        Alert.alert("Servicio finalizado", "Estado actualizado a completed.");
        router.replace("/barber/home");
      }
    } catch (err: any) {
      console.log("❌ ERROR ACTUALIZANDO ESTADO:", err?.response?.data || err.message);
      Alert.alert("Error", err?.response?.data?.error || "No se pudo actualizar el estado");
    }
  };

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  if (!serviceId) {
    return (
      <View style={{ padding: 20, gap: 10 }}>
        <Text>No hay solicitud activa seleccionada.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/barber/jobs")}
          style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>Volver a ofertas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Servicio activo</Text>
      <Text>Solicitud #{serviceId}</Text>
      <Text>Estado: {params.status || "accepted"}</Text>
      <Text>Servicio: {params.service_type || "No definido"}</Text>
      <Text>Dirección: {params.address || "No definida"}</Text>
      <Text>Valor: ${params.price || 0}</Text>

      <TouchableOpacity
        onPress={openMaps}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Seguimiento en Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("on_route")}
        style={{ backgroundColor: "#0A7E07", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          Llegué al cliente / Iniciar servicio
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("completed")}
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