import { Text, View } from "react-native";

export default function TestScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "yellow",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 30, color: "black" }}>
        🚨 TEST ROUTER FUNCIONA 🚨
      </Text>
    </View>
  );
}