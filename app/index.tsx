// app/index.tsx
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0d0d0d", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color="#D4AF37" size="large" />
    </View>
  );
}
