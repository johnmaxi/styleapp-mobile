import { Text, View } from "react-native";

export default function ServiceStatus() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 30,
      }}
    >
      <Text style={{ fontSize: 20, marginBottom: 10 }}>
        🔍 Buscando barbero
      </Text>

      <Text style={{ textAlign: "center" }}>
        Tu solicitud fue enviada correctamente.
        En breve recibirás una oferta.
      </Text>
    </View>
  );
}