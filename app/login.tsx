// app/login.tsx
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
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
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingresa email y contrasena");
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password.trim());

      // Mostrar mensaje de aprobación si el profesional acaba de ser aprobado
      if (result?.approval_message) {
        setTimeout(() => {
          Alert.alert(
            "🎉 ¡Cuenta aprobada!",
            result.approval_message!,
            [{ text: "¡Empecemos!", style: "default" }]
          );
        }, 800);
      }

    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error || err?.message || "Error al iniciar sesion";

      // Mensajes específicos para profesionales bloqueados
      if (status === 403) {
        const regStatus = err?.response?.data?.registration_status;
        if (regStatus === "pending") {
          Alert.alert(
            "⏳ Cuenta en revisión",
            "Tu registro está siendo revisado por nuestro equipo.\n\nRecibirás un email cuando tu cuenta sea aprobada (máx. 24 horas).",
            [{ text: "Entendido" }]
          );
        } else if (regStatus === "rejected") {
          Alert.alert(
            "❌ Registro rechazado",
            msg,
            [{ text: "Entendido" }]
          );
        } else {
          Alert.alert("Error", msg);
        }
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0d0d0d" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>

        <Text style={{
          fontSize: 42, fontWeight: "900", color: "#D4AF37",
          textAlign: "center", marginBottom: 6, letterSpacing: 2,
        }}>
          Style
        </Text>
        <Text style={{ color: "#666", textAlign: "center", marginBottom: 40, fontSize: 14 }}>
          Servicios de belleza a domicilio
        </Text>

        <TextInput
          placeholder="Email"
          placeholderTextColor="#444"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={inputStyle}
        />
        <TextInput
          placeholder="Contrasena"
          placeholderTextColor="#444"
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
            padding: 16, borderRadius: 10, marginTop: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#000", textAlign: "center", fontWeight: "900", fontSize: 16 }}>
            {loading ? "Ingresando..." : "Iniciar sesion"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(auth)/register")}
          style={{ marginTop: 20 }}
        >
          <Text style={{ color: "#D4AF37", textAlign: "center", fontWeight: "700" }}>
            No tienes cuenta? Registrate
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{
        paddingBottom: Platform.OS === "ios" ? 36 : 24,
        alignItems: "center",
        gap: 4,
      }}>
        <Text style={{ color: "#333", fontSize: 10, letterSpacing: 0.5 }}>
          desarrollado por
        </Text>
        <Image
          source={require("../assets/arelotech-logo.png")}
          style={{ width: 110, height: 36, resizeMode: "contain" }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#141414",
  borderRadius: 8,
  padding: 14,
  color: "#fff" as const,
  borderWidth: 1,
  borderColor: "#222",
  marginBottom: 12,
  fontSize: 15,
};
