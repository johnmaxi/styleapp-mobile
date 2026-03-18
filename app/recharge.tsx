// app/recharge.tsx
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../api";

const AMOUNTS = [10000, 20000, 50000, 100000, 200000];

// Detectar si estamos en modo pruebas (ACCESS TOKEN empieza con TEST-)
// El backend decide qué URL usar (init_point vs sandbox_init_point)
const IS_SANDBOX = true; // cambiar a true para pruebas locales

export default function RechargeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState(false);

  const selectedAmount = Number(amount.replace(/\D/g, "")) || 0;

  const handleRecharge = async () => {
    if (selectedAmount < 1000) {
      Alert.alert("Monto minimo", "El monto minimo de recarga es $1.000 COP");
      return;
    }
    if (selectedAmount > 5000000) {
      Alert.alert(
        "Monto maximo",
        "El monto maximo de recarga es $5.000.000 COP",
      );
      return;
    }

    setLoading(true);
    try {
      const amountInCents = selectedAmount * 100;

      const res = await api.post("/payments/mp-preference", {
        amount_in_cents: amountInCents,
      });

      const { checkout_url, sandbox_url, reference } = res.data;

      if (!checkout_url) {
        Alert.alert("Error", "No se pudo obtener el link de pago");
        return;
      }

      // En pruebas usar sandbox_url, en produccion usar checkout_url
      const urlToOpen = IS_SANDBOX ? sandbox_url || checkout_url : checkout_url;

      console.log("MP URL:", urlToOpen?.substring(0, 80) + "...");

      const result = await WebBrowser.openBrowserAsync(urlToOpen, {
        dismissButtonStyle: "close",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      if (result.type === "dismiss" || result.type === "cancel") {
        Alert.alert(
          "Recarga",
          "Si completaste el pago, tu saldo se actualizara en unos segundos.",
          [{ text: "Verificar", onPress: () => router.back() }],
        );
      }
    } catch (err: any) {
      console.log("MP ERROR:", JSON.stringify(err?.response?.data));
      Alert.alert(
        "Error",
        err?.response?.data?.error ||
          err?.message ||
          "No se pudo iniciar el pago",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        gap: 14,
        paddingBottom: 48,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
        Recargar saldo
      </Text>
      <Text style={{ color: "#888", fontSize: 13 }}>
        El saldo recargado se acredita a tu cuenta Style y se usa para pagar
        servicios.
      </Text>

      {/* MONTOS RAPIDOS */}
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        Selecciona un monto
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {AMOUNTS.map((a) => (
          <TouchableOpacity
            key={a}
            onPress={() => {
              setAmount(String(a));
              setCustomAmount(false);
            }}
            style={{
              borderWidth: 1,
              borderColor:
                selectedAmount === a && !customAmount
                  ? palette.primary
                  : "#444",
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor:
                selectedAmount === a && !customAmount
                  ? palette.primary + "22"
                  : "transparent",
            }}
          >
            <Text
              style={{
                color:
                  selectedAmount === a && !customAmount
                    ? palette.primary
                    : "#ccc",
                fontWeight: "700",
              }}
            >
              ${a.toLocaleString("es-CO")}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => {
            setCustomAmount(true);
            setAmount("");
          }}
          style={{
            borderWidth: 1,
            borderColor: customAmount ? palette.primary : "#444",
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: customAmount
              ? palette.primary + "22"
              : "transparent",
          }}
        >
          <Text
            style={{
              color: customAmount ? palette.primary : "#ccc",
              fontWeight: "700",
            }}
          >
            Otro valor
          </Text>
        </TouchableOpacity>
      </View>

      {/* INPUT PERSONALIZADO */}
      {customAmount && (
        <View>
          <Text style={{ color: "#aaa", marginBottom: 6, fontSize: 12 }}>
            Ingresa el monto (minimo $1.000 — maximo $5.000.000)
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: palette.primary,
              borderRadius: 8,
              paddingHorizontal: 12,
            }}
          >
            <Text
              style={{
                color: palette.primary,
                fontWeight: "700",
                marginRight: 4,
              }}
            >
              $
            </Text>
            <TextInput
              placeholder="0"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={
                selectedAmount > 0 ? selectedAmount.toLocaleString("es-CO") : ""
              }
              onChangeText={(t) => setAmount(t.replace(/\D/g, ""))}
              style={{
                flex: 1,
                paddingVertical: 12,
                color: palette.text,
                fontSize: 18,
              }}
            />
            <Text style={{ color: "#888" }}>COP</Text>
          </View>
        </View>
      )}

      {/* RESUMEN */}
      {selectedAmount >= 1000 && (
        <View
          style={{
            backgroundColor: palette.card,
            padding: 16,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.primary + "55",
          }}
        >
          <Text style={{ color: "#aaa", marginBottom: 4 }}>
            Resumen de recarga
          </Text>
          <Text style={{ color: palette.text, fontSize: 16 }}>
            Monto:{" "}
            <Text
              style={{
                color: palette.primary,
                fontWeight: "700",
                fontSize: 20,
              }}
            >
              ${selectedAmount.toLocaleString("es-CO")} COP
            </Text>
          </Text>
          <Text style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
            Metodos: Tarjeta de credito/debito, PSE, Nequi, Bancolombia
          </Text>
        </View>
      )}

      {/* LOGO MP */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingVertical: 4,
        }}
      >
        <Text style={{ color: "#555", fontSize: 12 }}>Pagos seguros con</Text>
        <Text style={{ color: "#009EE3", fontWeight: "900", fontSize: 14 }}>
          Mercado Pago
        </Text>
      </View>

      {/* BOTON PAGAR */}
      <TouchableOpacity
        onPress={handleRecharge}
        disabled={loading || selectedAmount < 1000}
        style={{
          backgroundColor: selectedAmount >= 1000 ? "#009EE3" : "#333",
          padding: 16,
          borderRadius: 10,
          alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text
          style={{
            color: selectedAmount >= 1000 ? "#fff" : "#666",
            fontWeight: "900",
            fontSize: 16,
          }}
        >
          {loading ? "Abriendo pasarela..." : "Pagar con Mercado Pago"}
        </Text>
      </TouchableOpacity>

      {selectedAmount >= 1000 && (
        <Text style={{ color: "#666", fontSize: 11, textAlign: "center" }}>
          Seras redirigido a la pasarela segura de Mercado Pago. Tu saldo se
          actualizara automaticamente al confirmar el pago.
        </Text>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
