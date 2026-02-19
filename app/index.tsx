import { Redirect } from "expo-router";

export default function ClientIndex() {
  return <Redirect href="/client/home" />;

  /*
  const router = useRouter();

  useEffect(() => {
  async function bootstrap() {
    const session = await getSession();

    if (!session) {
      router.replace("../login");
      return;
    }

    if (session.user.role === "barber") {
      router.replace("/barber/home");
    } else {
      router.replace("/client");
    }
  }

  bootstrap();
}, [router]);


  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  ); */
}
