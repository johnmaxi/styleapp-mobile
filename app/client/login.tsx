import { useAuth } from "@/context/AuthContext";
import api from "@/services/api";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔍 Test backend
  useEffect(() => {
    api
      .get("/")
      .then((res) => console.log("✅ API OK:", res.data))
      .catch((err) => console.log("❌ API ERROR:", err.message));
  }, []);

 const handleLogin = async () => {
  try {
    setLoading(true);
    console.log("📨 Enviando login...");

    await login(email, password);

    // ✅ CORRECTO: index.tsx es "/"
    router.replace("/");

  } catch (err: any) {
    console.log("❌ ERROR LOGIN:", err?.response?.data || err.message);
    Alert.alert("Error", "Credenciales inválidas");
  } finally {
    setLoading(false);
  }
};

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        Iniciar sesión
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, marginBottom: 20, padding: 10 }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: "#000",
          padding: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}