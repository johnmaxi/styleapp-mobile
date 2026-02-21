import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { clearSession } from "@/store/authStore";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

type ActiveRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
};

export default function BarberHome() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const [isActive, setIsActive] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync("barber_is_active").then((value) => {
      if (value === "0") setIsActive(false);
    });
  }, []);

  const findAssignedService = async () => {
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

        const assigned = (list as ActiveRequest[]).find(
          (item) => item.status === "accepted" || item.status === "on_route"
        );

        if (assigned) {
          setActiveRequest(assigned);
          return assigned;
        }
      } catch {
        // try next endpoint
      }
    }

    setActiveRequest(null);
    return null;
  };

  useEffect(() => {
    findAssignedService();
    const timer = setInterval(findAssignedService, 5000);
    return () => clearInterval(timer);
  }, []);

  const toggleActive = async () => {
    const next = !isActive;
    setIsActive(next);
    await SecureStore.setItemAsync("barber_is_active", next ? "1" : "0");
  };

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <View style={{ padding: 30, gap: 12, flex: 1, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: palette.text }}>Inicio Barbero</Text>
      <Text style={{ color: palette.text }}>Gestiona ofertas, contraofertas y servicios activos.</Text>

      <TouchableOpacity
        onPress={toggleActive}
        style={{
          backgroundColor: isActive ? "#0A7E07" : "#7a1c1c",
          padding: 14,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
          {isActive ? "Activo para recibir solicitudes" : "Inactivo para recibir solicitudes"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/jobs")}
        style={{ backgroundColor: palette.card, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}
      >
        <Text style={{ color: palette.text, textAlign: "center" }}>Ver ofertas disponibles</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/active")}
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 14, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: palette.text }}>Ir a servicio activo</Text>
      </TouchableOpacity>

      {activeRequest && (
        <View style={{ borderWidth: 1, borderColor: "#0A7E07", borderRadius: 8, padding: 12 }}>
          <Text style={{ color: palette.text, fontWeight: "700" }}>🔔 Oferta aceptada</Text>
          <Text style={{ color: palette.text }}>Tienes un servicio activo asignado.</Text>
          <Text style={{ color: palette.text }}>Solicitud #{activeRequest.id}</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/barber/active",
                params: {
                  id: String(activeRequest.id),
                  service_type: activeRequest.service_type || "",
                  address: activeRequest.address || "",
                  price: String(activeRequest.price ?? 0),
                  latitude: String(activeRequest.latitude ?? 0),
                  longitude: String(activeRequest.longitude ?? 0),
                  status: activeRequest.status || "accepted",
                },
              })
            }
            style={{ marginTop: 10, backgroundColor: "#0A7E07", padding: 10, borderRadius: 6 }}
          >
            <Text style={{ color: "#fff", textAlign: "center" }}>Abrir servicio asignado</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        onPress={async () => {
          const found = await findAssignedService();
          if (!found) {
            Alert.alert("Sin asignación", "Aún no tienes un servicio activo asignado.");
          }
        }}
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 14, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: palette.text }}>Revisar notificaciones de oferta aceptada</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 14, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center", color: palette.text }}>Mi perfil (saldo y resumen)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={{ borderWidth: 1, borderColor: "#dd0000", padding: 14, borderRadius: 8 }}
      >
        <Text style={{ color: "#dd0000", textAlign: "center" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}