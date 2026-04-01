// app/index.tsx
// RedirectGuard en _layout.tsx maneja la navegación
// Este archivo solo existe para que Expo Router tenga una ruta raíz
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator color="#D4AF37" size="large" />
    </View>
  );
}
