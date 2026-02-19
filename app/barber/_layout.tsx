
import { Stack } from "expo-router";


export default function BarberLayout() {
  return (
    
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="active" />
      <Stack.Screen name="bids" />
      <Stack.Screen name="jobs" />
      <Stack.Screen name="offer" />
      <Stack.Screen name="history" />
    </Stack>
  );
}