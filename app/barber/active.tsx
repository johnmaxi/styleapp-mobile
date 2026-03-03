// app/barber/active.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
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
  client_id?: number;
  client_name?: string;
};

export default function ActiveJob() {
  const router = useRouter();
  const { user, logout } = useAuth();
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

  // Carga el servicio asignado desde el backend (trae client_id completo)
  const loadAssigned = useCallback(async () => {
    for (const endpoint of ["/service-requests/assigned/me", "/service-requests"]) {
      try {
        const res = await api.get(endpoint);
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
        const found = list.find(
          (item: ActiveRequest) =>
            item.status === "accepted" || item.status === "on_route"
        );
        if (found) {
          setResolvedRequest(found);
          return;
        }
      } catch {}
    }
  }, []);

  // Si tenemos id por params pero no tenemos client_id, cargar desde backend
  const loadById = useCallback(async (id: number) => {
    for (const path of [`/service-requests/${id}`, `/service-request/${id}`]) {
      try {
        const res = await api.get(path);
        const data = res.data?.data || res.data?.request || res.data;
        if (data && data.id) {
          setResolvedRequest(data);
          return data;
        }
      } catch {}
    }
    return null;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (params.id) {
        // Siempre cargar desde backend para tener client_id actualizado
        loadById(Number(params.id));
      } else {
        loadAssigned();
      }
    }, [loadAssigned, loadById, params.id])
  );

  const updateStatus = async (status: "on_route" | "completed") => {
    if (!serviceId) {
      Alert.alert("Error", "No se encontró la solicitud");
      return;
    }

    try {
      await api.patch(`/service-requests/${serviceId}/status`, { status });

      if (status === "on_route") {
        Alert.alert("✅ Llegaste al cliente", "El estado fue actualizado.");
      } else {
        const price = Number(params.price || resolvedRequest?.price || 0);
        await markCompleted(price);

        // Obtener client_id — primero de resolvedRequest, si no cargar del backend
        let clientId = resolvedRequest?.client_id;
        let clientName = resolvedRequest?.client_name || "el cliente";

        if (!clientId) {
          const fresh = await loadById(serviceId);
          clientId = fresh?.client_id;
          clientName = fresh?.client_name || "el cliente";
        }

        if (!clientId) {
          // Si aún no tenemos client_id, ir al home sin rating
          Alert.alert("Servicio finalizado", "El servicio fue completado exitosamente.");
          router.replace("/barber/home");
          return;
        }

        router.replace({
          pathname: "/rating",
          params: {
            service_request_id: String(serviceId),
            rated_id: String(clientId),
            rated_name: clientName,
            redirect: "/barber/home",
          },
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo actualizar el estado");
    }
  };

  const confirmAndFinish = () => {
    Alert.alert(
      "Finalizar servicio",
      "¿Confirmas que el servicio fue completado exitosamente?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, finalizar", onPress: () => updateStatus("completed") },
      ]
    );
  };

  if (!serviceId) {
    return (
      <View style={{ padding: 20, gap: 12, backgroundColor: palette.background, flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 16 }}>
          No hay servicio activo seleccionado.
        </Text>
        <TouchableOpacity
          onPress={loadAssigned}
          style={{ backgroundColor: palette.card, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Buscar servicio asignado</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace("/barber/jobs")}
          style={{ backgroundColor: palette.card, padding: 12, borderRadius: 8 }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Ver solicitudes disponibles</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const staticMap =
    latitude && longitude
      ? `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=800x420&markers=${latitude},${longitude},red-pushpin`
      : null;

  const resolvedType = params.service_type || resolvedRequest?.service_type || "No definido";
  const resolvedAddress = params.address || resolvedRequest?.address || "No definida";
  const resolvedPrice = Number(params.price || resolvedRequest?.price || 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10, backgroundColor: palette.background, paddingBottom: 30 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>Servicio activo</Text>
      <Text style={{ color: palette.text }}>Solicitud #{serviceId}</Text>
      <Text style={{ color: palette.text }}>Servicio: {resolvedType}</Text>
      <Text style={{ color: palette.text }}>Dirección: {resolvedAddress}</Text>
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        Valor: ${resolvedPrice.toLocaleString("es-CO")}
      </Text>

      <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: palette.primary }}>
        <Text style={{ color: palette.primary, fontWeight: "700", textAlign: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#222" }}>
          Seguimiento en el mapa
        </Text>
        {staticMap ? (
          <Image source={{ uri: staticMap }} style={{ width: "100%", height: 240 }} resizeMode="cover" />
        ) : (
          <View style={{ height: 240, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#aaa" }}>Ubicación no disponible</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={() => WebBrowser.openBrowserAsync(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`)}
        style={{ backgroundColor: "#1f4eb5", padding: 12, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#fff" }}>📍 Abrir en Google Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => updateStatus("on_route")}
        style={{ backgroundColor: "#0A7E07", padding: 14, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>✅ Llegué al cliente</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={confirmAndFinish}
        style={{ backgroundColor: palette.primary, padding: 14, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#000", fontWeight: "900" }}>🏁 Finalizar servicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: palette.text }}>Regresar al inicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={async () => { await logout(); router.replace("/login"); }}
        style={{ borderWidth: 1, borderColor: "#dd0000", padding: 12, borderRadius: 8, alignItems: "center" }}
      >
        <Text style={{ color: "#dd0000" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
