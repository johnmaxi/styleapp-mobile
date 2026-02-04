import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function Jobs() {
  const router = useRouter();

  return (
    <View style={{ padding: 30 }}>
      <Text>Trabajos disponibles</Text>

      <TouchableOpacity
        onPress={() => router.push("/barber/active")}
        style={{ marginTop: 20 }}
      >
        <Text>✅ Aceptar trabajo</Text>
      </TouchableOpacity>
    </View>
  );
}