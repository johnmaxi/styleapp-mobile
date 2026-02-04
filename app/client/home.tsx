import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function ClientHome() {
  const router = useRouter();

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 22, marginBottom: 20 }}>
        👋 Bienvenido cliente
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/create-service")}
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
    </View>
  );
}
