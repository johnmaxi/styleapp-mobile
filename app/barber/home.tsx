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

    <View style={{ padding: 30, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "700" }}>Inicio Barbero</Text>
      <Text>Gestiona ofertas, contraofertas y servicios activos.</Text>

      <TouchableOpacity
        onPress={() => router.push("/barber/jobs")}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>Ver ofertas disponibles</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/active")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 14, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center" }}>Ir a servicio activo</Text>
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