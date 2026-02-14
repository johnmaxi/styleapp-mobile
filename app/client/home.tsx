import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function ClientHome() {
  const router = useRouter();

  const logout = async () => {
    await AsyncStorage.clear();
    router.replace("/login");
  };

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 22, marginBottom: 20 }}>
        👋 Bienvenido cliente
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/client/create-service")}
        style={{
          backgroundColor: "#000",
          padding: 16,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>
          Solicitar servicio
        </Text>
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
        <Text style={{ color: "#fff" }}>
          Cerrar sesión
        </Text>
      </TouchableOpacity>
    </View>
  );
}
