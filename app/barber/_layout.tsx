import { AuthProvider } from "@/context/AuthContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="barber/home" />
        <Stack.Screen name="barber/active" />
        <Stack.Screen name="client/home" />
      </Stack>
    </AuthProvider>
  );
}
