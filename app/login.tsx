import { useAuth } from "@/context/AuthContext";
import { getSession } from "@/store/authStore";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login(email, password);
      const session = await getSession();

      if (session?.user.role === "barber") {
        router.replace("/barber/home");
      } else if (session?.user.role === "client") {
        router.replace("/client/home");
      } else if (session?.user.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      console.log("❌ ERROR LOGIN:", err?.response?.data || err.message);
      Alert.alert("Error", "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 24, flex: 1, justifyContent: "center", backgroundColor: "#050505" }}>
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Image
          source={require("../assets/logo.png")}
          style={{ width: 120, height: 120, marginBottom: 12 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 28, fontWeight: "900", color: "#D4AF37" }}>STYLEAPP</Text>
        <Text style={{ color: "#fff", marginTop: 4 }}>Belleza a domicilio con estilo</Text>
      </View>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholderTextColor="#8a8a8a"
        style={{
          borderWidth: 1,
          borderColor: "#D4AF37",
          marginBottom: 10,
          padding: 12,
          borderRadius: 10,
          color: "#fff",
          backgroundColor: "#0f0f0f",
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#8a8a8a"
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#D4AF37",
          marginBottom: 16,
          padding: 12,
          borderRadius: 10,
          color: "#fff",
          backgroundColor: "#0f0f0f",
        }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: "#D4AF37",
          padding: 14,
          alignItems: "center",
          marginBottom: 20,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#000", fontSize: 16, fontWeight: "800" }}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}> 
        <Text
          style={{
            color: "#D4AF37",
            textAlign: "center",
            fontSize: 16,
            marginBottom: 10,
            textDecorationLine: "underline",
          }}
        >
          Registrarse
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
        <Text
          style={{
            color: "#D4AF37",
            textAlign: "center",
            fontSize: 16,
            textDecorationLine: "underline",
          }}
        >
          Recuperar contraseña
        </Text>
      </TouchableOpacity>
    </View>
  );
}