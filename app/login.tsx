// app/login.tsx
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
    if (!email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingresa email y contraseña");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password.trim());
      // RedirectGuard en _layout maneja la navegación según el rol
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Error al iniciar sesión";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>
        <Text
          style={{
            fontSize: 36,
            fontWeight: "900",
            color: "#D4AF37",
            textAlign: "center",
            marginBottom: 4,
          }}
        >
          ✂️ STYLEAPP
        </Text>
        <Text
          style={{ color: "#aaa", textAlign: "center", marginBottom: 36 }}
        >
          Servicios de belleza a domicilio
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />

        <TextInput
          placeholder="Contraseña"
          placeholderTextColor="#666"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={inputStyle}
        />

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: "#D4AF37",
            padding: 16,
            borderRadius: 10,
            marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text
            style={{
              color: "#000",
              textAlign: "center",
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </Text>
        </TouchableOpacity>

        {/* Ruta correcta: (auth)/register */}
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          style={{ marginTop: 20 }}
        >
          <Text
            style={{
              color: "#D4AF37",
              textAlign: "center",
              fontWeight: "700",
            }}
          >
            ¿No tienes cuenta? Regístrate
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#171717",
  borderRadius: 8,
  padding: 14,
  color: "#fff" as const,
  borderWidth: 1,
  borderColor: "#333",
  marginBottom: 12,
  fontSize: 15,
};
