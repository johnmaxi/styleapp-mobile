import { clearSession } from "@/store/authStore";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function BarberHome() {
  const router = useRouter();

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 24 }}>Inicio Barbero</Text>

      {/* ✅ RUTA ABSOLUTA (TS + Expo Router OK) */}
      <TouchableOpacity onPress={() => router.push("/barber/jobs")}>
        <Text>📋 Ver trabajos</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={logout} style={{ marginTop: 30 }}>
        <Text style={{ color: "red" }}>🚪 Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}