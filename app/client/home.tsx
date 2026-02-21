import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { clearSession } from "../../store/authStore";
import { getPalette } from "../../utils/palette";

export default function ClientHome() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const logout = async () => {
    await clearSession();
    router.replace("/login");
  };

  return (
    <View style={{ padding: 30, backgroundColor: palette.background, flex: 1 }}>
      <Text style={{ fontSize: 22, marginBottom: 20, color: palette.text }}>👋 Bienvenido cliente</Text>

      <TouchableOpacity
        onPress={() => router.push("/client/create-service")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
        }}
      >
        <Text style={{ color: palette.text }}>Solicitar servicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{ marginTop: 12, borderWidth: 1, borderColor: palette.primary, padding: 14, alignItems: "center" }}
      >
        <Text style={{ color: palette.text }}>Mi perfil (saldo y resumen)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={logout}
        style={{
          marginTop: 20,
          backgroundColor: "red",
          padding: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}