import { getSession } from "@/store/authStore";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
  async function bootstrap() {
    const session = await getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    if (session.user.role === "barber") {
      router.replace("/barber/home");
    } else {
      router.replace("/client/home");
    }
  }

  bootstrap();
}, [router]);


  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
