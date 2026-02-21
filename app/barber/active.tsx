import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { clearSession } from "../../store/authStore";
import { markCompleted } from "../../utils/barberStats";
import { getPalette } from "../../utils/palette";

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

  const [resolvedRequest, setResolvedRequest] = useState<ActiveRequest | null>(null);
  const serviceId = params.id ? Number(params.id) : resolvedRequest?.id ?? null;
  const latitude = Number(params.latitude || resolvedRequest?.latitude || 0);
  const longitude = Number(params.longitude || resolvedRequest?.longitude || 0);

  const loadAssignedService = useCallback(async () => {
    const endpoints = [
      "/service-requests/assigned/me",
      "/service-requests/active/me",
      "/service-requests/my-active",
      "/service-requests",
    ];

    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        const payload = res.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : payload?.data
              ? [payload.data]
              : [];

        const found = (list as ActiveRequest[]).find(
          (item) => item.status === "accepted" || item.status === "on_route"
        );

        if (found) {
          setResolvedRequest(found);
          return;
        }
      } catch {
        // keep trying next endpoint
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!params.id) {
        loadAssignedService();
      }
    }, [loadAssignedService, params.id])
  );

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
      const amount = Number(params.price || resolvedRequest?.price || 0);
      await api.patch(`/service-requests/${serviceId}/status`, {
        status,
        app_commission: amount * 0.1,
      });

      if (status === "on_route") {
        Alert.alert("Servicio iniciado", "Estado actualizado a on_route.");
      } else {
        await markCompleted(Number(params.price || resolvedRequest?.price || 0));
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
          onPress={loadAssignedService}
          style={{ backgroundColor: palette.card, padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Buscar servicio asignado</Text>
        </TouchableOpacity>
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
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=800x420&markers=${latitude},${longitude},red-pushpin`
      : null;

  const resolvedStatus = params.status || resolvedRequest?.status || "accepted";
  const resolvedType = params.service_type || resolvedRequest?.service_type || "No definido";
  const resolvedAddress = params.address || resolvedRequest?.address || "No definida";
  const resolvedPrice = params.price || String(resolvedRequest?.price ?? 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10, backgroundColor: palette.background, paddingBottom: 30 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>Servicio activo</Text>
      <Text style={{ color: palette.text }}>Solicitud #{serviceId}</Text>
      <Text style={{ color: palette.text }}>Estado: {resolvedStatus}</Text>
      <Text style={{ color: palette.text }}>Servicio: {resolvedType}</Text>
      <Text style={{ color: palette.text }}>Dirección: {resolvedAddress}</Text>
      <Text style={{ color: palette.text }}>Valor: ${resolvedPrice}</Text>

      <View
        style={{
          marginVertical: 10,
          borderRadius: 14,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: palette.primary,
          alignSelf: "center",
          width: "100%",
          backgroundColor: "#0f0f0f",
        }}
      >
        <Text
          style={{
            color: palette.primary,
            fontWeight: "700",
            textAlign: "center",
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: "#222",
          }}
        >
          Seguimiento en el mapa
        </Text>

        {staticMap ? (
          <Image
            source={{ uri: staticMap }}
            style={{ width: "100%", height: 240 }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ height: 240, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff" }}>Mapa no disponible</Text>
          </View>
        )}
      </View>

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