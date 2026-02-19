import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../api";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔍 TEST BACKEND (solo debug)
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
      router.replace("/");
    } catch (err: any) {
      console.log("❌ ERROR LOGIN:", err?.response?.data || err.message);
      Alert.alert("Error", "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 30, flex: 1, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, marginBottom: 20, textAlign: "center" }}>
        Iniciar sesión
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#000",
          marginBottom: 10,
          padding: 10,
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#000",
          marginBottom: 20,
          padding: 10,
        }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{
          backgroundColor: "#000",
          padding: 15,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16 }}>
          {loading ? "Ingresando..." : "Ingresar"}
        </Text>
      </TouchableOpacity>

      {/* 👇 OPCIONES VISIBLES (SIN Link, SIN ESTILOS INVISIBLES) */}
      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        
        <Text
          style={{
            color: "#000",
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
            color: "#000",
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