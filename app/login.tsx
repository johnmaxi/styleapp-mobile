// app/login.tsx
import { saveLanguage } from "@/constants/i18n";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const LANGUAGES = [
  { code: "es", flag: "🇨🇴", label: "ES" },
  { code: "en", flag: "🇺🇸", label: "EN" },
];

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLangChange = async (code: string) => {
    await saveLanguage(code);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(
        t("common.required"),
        t("login.email") + " / " + t("login.password"),
      );
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password.trim());
      if (result?.approval_message) {
        setTimeout(() => {
          Alert.alert("🎉 ¡Cuenta aprobada!", result.approval_message!, [
            { text: "¡Empecemos!", style: "default" },
          ]);
        }, 800);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error || err?.message || t("login.error");
      if (status === 403) {
        const regStatus = err?.response?.data?.registration_status;
        if (regStatus === "pending") {
          Alert.alert(
            "⏳ Cuenta en revisión",
            "Tu registro está siendo revisado por nuestro equipo.\n\nRecibirás un email cuando tu cuenta sea aprobada (máx. 24 horas).",
            [{ text: "Entendido" }],
          );
        } else if (regStatus === "rejected") {
          Alert.alert("❌ Cuenta rechazada", msg, [{ text: "Entendido" }]);
        } else {
          Alert.alert(t("common.error"), msg);
        }
      } else {
        Alert.alert(t("common.error"), msg);
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
      {/* ── Selector de idioma ── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingTop: 56,
          paddingHorizontal: 24,
          gap: 8,
        }}
      >
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            onPress={() => handleLangChange(lang.code)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: i18n.language === lang.code ? "#D4AF37" : "#333",
              backgroundColor:
                i18n.language === lang.code ? "#D4AF3720" : "transparent",
            }}
          >
            <Text style={{ fontSize: 16 }}>{lang.flag}</Text>
            <Text
              style={{
                color: i18n.language === lang.code ? "#D4AF37" : "#555",
                fontWeight: "700",
                fontSize: 12,
              }}
            >
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, justifyContent: "center", padding: 28 }}>
        {/* Logo */}
        <Text
          style={{
            fontSize: 52,
            fontWeight: "900",
            color: "#D4AF37",
            textAlign: "center",
            marginBottom: 4,
            letterSpacing: 2,
          }}
        >
          Style
        </Text>
        <Text
          style={{
            color: "#555",
            textAlign: "center",
            fontSize: 13,
            marginBottom: 40,
            letterSpacing: 3,
          }}
        >
          A DOMICILIO
        </Text>

        {/* Email */}
        <TextInput
          placeholder={t("login.email")}
          placeholderTextColor="#444"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={{
            backgroundColor: "#141414",
            borderWidth: 1,
            borderColor: "#D4AF3740",
            borderRadius: 10,
            padding: 15,
            color: "#fff",
            fontSize: 15,
            marginBottom: 12,
          }}
        />

        {/* Password */}
        <TextInput
          placeholder={t("login.password")}
          placeholderTextColor="#444"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{
            backgroundColor: "#141414",
            borderWidth: 1,
            borderColor: "#D4AF3740",
            borderRadius: 10,
            padding: 15,
            color: "#fff",
            fontSize: 15,
            marginBottom: 8,
          }}
        />

        {/* Olvidé contraseña */}
        <TouchableOpacity
          onPress={() => router.push("/forgot-password" as any)}
          style={{ alignSelf: "flex-end", marginBottom: 24 }}
        >
          <Text style={{ color: "#D4AF3799", fontSize: 13 }}>
            {t("login.forgot")}
          </Text>
        </TouchableOpacity>

        {/* Botón login */}
        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: "#D4AF37",
            padding: 16,
            borderRadius: 12,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
            {loading ? t("common.loading") : t("login.button")}
          </Text>
        </TouchableOpacity>

        {/* Registro */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 24,
            gap: 6,
          }}
        >
          <Text style={{ color: "#555", fontSize: 14 }}>
            {t("login.noAccount")}
          </Text>
          <TouchableOpacity onPress={() => router.push("/register" as any)}>
            <Text style={{ color: "#D4AF37", fontWeight: "700", fontSize: 14 }}>
              {t("login.register")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
