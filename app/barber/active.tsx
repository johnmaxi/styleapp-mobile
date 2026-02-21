import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { clearSession } from "../../store/authStore";
import { getPalette } from "../../utils/palette";
import { markCompleted } from "../../utils/barberStats";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

export default function ActiveJob() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
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
    await WebBrowser.openBrowserAsync(url);
  };

  const updateStatus = async (status: "on_route" | "completed") => {
    if (!serviceId) {
      Alert.alert("Error", "No se encontró la solicitud activa");
      return;
    }

    try {
      const amount = Number(params.price || 0);
      await api.patch(`/service-requests/${serviceId}/status`, {
        status,
        app_commission: amount * 0.1,
      });

      if (status === "on_route") {
        Alert.alert("Servicio iniciado", "Estado actualizado a on_route.");
      } else {
        await markCompleted(Number(params.price || 0));
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
      <View style={{ padding: 20, gap: 10, backgroundColor: palette.background, flex: 1 }}>
        <Text style={{ color: palette.text }}>No hay solicitud activa seleccionada.</Text>
        <TouchableOpacity
          onPress={() => router.replace("/barber/jobs")}
          style={{ backgroundColor: palette.card, padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Volver a ofertas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const staticMap =
    latitude && longitude
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=600x300&markers=${latitude},${longitude},red-pushpin`
      : null;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>Servicio activo</Text>
      <Text style={{ color: palette.text }}>Solicitud #{serviceId}</Text>
      <Text style={{ color: palette.text }}>Estado: {params.status || "accepted"}</Text>
      <Text style={{ color: palette.text }}>Servicio: {params.service_type || "No definido"}</Text>
      <Text style={{ color: palette.text }}>Dirección: {params.address || "No definida"}</Text>
      <Text style={{ color: palette.text }}>Valor: ${params.price || 0}</Text>

      {staticMap ? (
        <Image
          source={{ uri: staticMap }}
          style={{ width: "100%", height: 220, borderRadius: 10, marginVertical: 10 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ height: 220, borderRadius: 10, backgroundColor: "#222", justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: "#fff" }}>Mapa no disponible</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={openMaps}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Seguimiento</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("on_route")}
        style={{ backgroundColor: "#0A7E07", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Llegué</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("completed")}
        style={{ backgroundColor: "#111", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Finalizar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: palette.text }}>Regresar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={{ borderWidth: 1, borderColor: "#dd0000", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: "#dd0000" }}>Cerrar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
