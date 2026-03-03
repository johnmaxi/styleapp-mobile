// app/client/home.tsx
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function ClientHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const displayName = user?.name?.split(" ")[0] || "Cliente";

  return (
    <View style={{ padding: 30, backgroundColor: palette.background, flex: 1, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "900", color: palette.primary, marginBottom: 8 }}>
        ✂️ STYLEAPP
      </Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 16 }}>
        👋 Bienvenido, {displayName}
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/client/create-service")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>✂️ Solicitar servicio</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/client/status")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>📋 Estado de mi solicitud</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>👤 Mi perfil</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: "#dd0000",
          padding: 14,
          alignItems: "center",
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#dd0000", fontWeight: "700" }}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}