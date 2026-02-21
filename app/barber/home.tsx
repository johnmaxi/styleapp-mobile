import { useAuth } from "@/context/AuthContext";
import { clearSession } from "@/store/authStore";
import { getPalette } from "@/utils/palette";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function BarberHome() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync("barber_is_active").then((value) => {
      if (value === "0") setIsActive(false);
    });
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
