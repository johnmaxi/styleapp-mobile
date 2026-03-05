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

const WOMPI_PUBLIC_KEY = "pub_prod_GW6xxfe09CgSSEwVnN8gu1xWx4HoliDi";

const AMOUNTS = [10000, 20000, 50000, 100000, 200000];

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
      Alert.alert("Monto maximo", "El monto maximo de recarga es $5.000.000 COP");
      return;
    }

    setLoading(true);
    try {
      // Backend genera la firma de integridad de forma segura
      const res = await api.post("/payments/wompi-link", {
        amount_in_cents: selectedAmount * 100,
        user_id: user?.id,
      });

      const { reference, integrity_signature, redirect_url } = res.data;

      const wompiUrl =
        `https://checkout.wompi.co/p/` +
        `?public-key=${WOMPI_PUBLIC_KEY}` +
        `&currency=COP` +
        `&amount-in-cents=${selectedAmount * 100}` +
        `&reference=${reference}` +
        `&signature:integrity=${integrity_signature}` +
        `&redirect-url=${encodeURIComponent(redirect_url)}` +
        `&customer-data:email=${encodeURIComponent(user?.email || "")}` +
        `&customer-data:full-name=${encodeURIComponent(user?.name || "")}`;

      const result = await WebBrowser.openBrowserAsync(wompiUrl, {
        dismissButtonStyle: "close",
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      if (result.type === "dismiss" || result.type === "cancel") {
        Alert.alert(
          "Recarga",
          "Si completaste el pago, tu saldo se actualizara en unos segundos.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo iniciar el pago");
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
        El saldo recargado se acredita a tu cuenta Style y se usa para pagar servicios.
      </Text>

      {/* MONTOS RAPIDOS */}
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        Selecciona un monto
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {AMOUNTS.map((a) => (
          <TouchableOpacity
            key={a}
            onPress={() => { setAmount(String(a)); setCustomAmount(false); }}
            style={{
              borderWidth: 1,
              borderColor: selectedAmount === a && !customAmount ? palette.primary : "#444",
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: selectedAmount === a && !customAmount ? palette.primary + "22" : "transparent",
            }}
          >
            <Text style={{
              color: selectedAmount === a && !customAmount ? palette.primary : "#ccc",
              fontWeight: "700",
            }}>
              ${a.toLocaleString("es-CO")}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={() => { setCustomAmount(true); setAmount(""); }}
          style={{
            borderWidth: 1,
            borderColor: customAmount ? palette.primary : "#444",
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: customAmount ? palette.primary + "22" : "transparent",
          }}
        >
          <Text style={{ color: customAmount ? palette.primary : "#ccc", fontWeight: "700" }}>
            Otro valor
          </Text>
        </TouchableOpacity>
      </View>

      {/* INPUT MONTO PERSONALIZADO */}
      {customAmount && (
        <View>
          <Text style={{ color: "#aaa", marginBottom: 6, fontSize: 12 }}>
            Ingresa el monto (minimo $1.000 — maximo $5.000.000)
          </Text>
          <View style={{
            flexDirection: "row", alignItems: "center",
            borderWidth: 1, borderColor: palette.primary, borderRadius: 8,
            paddingHorizontal: 12,
          }}>
            <Text style={{ color: palette.primary, fontWeight: "700", marginRight: 4 }}>$</Text>
            <TextInput
              placeholder="0"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={selectedAmount > 0 ? selectedAmount.toLocaleString("es-CO") : ""}
              onChangeText={(t) => setAmount(t.replace(/\D/g, ""))}
              style={{ flex: 1, paddingVertical: 12, color: palette.text, fontSize: 18 }}
            />
            <Text style={{ color: "#888" }}>COP</Text>
          </View>
        </View>
      )}

      {/* RESUMEN */}
      {selectedAmount >= 1000 && (
        <View style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 10,
          borderWidth: 1, borderColor: palette.primary + "55",
        }}>
          <Text style={{ color: "#aaa", marginBottom: 4 }}>Resumen de recarga</Text>
          <Text style={{ color: palette.text, fontSize: 16 }}>
            Monto:{" "}
            <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 20 }}>
              ${selectedAmount.toLocaleString("es-CO")} COP
            </Text>
          </Text>
          <Text style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
            Metodos: Tarjeta debito/credito, PSE, Nequi, Bancolombia
          </Text>
        </View>
      )}

      {/* BOTON PAGAR */}
      <TouchableOpacity
        onPress={handleRecharge}
        disabled={loading || selectedAmount < 1000}
        style={{
          backgroundColor: selectedAmount >= 1000 ? palette.primary : "#333",
          padding: 16, borderRadius: 10, alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{
          color: selectedAmount >= 1000 ? "#000" : "#666",
          fontWeight: "900", fontSize: 16,
        }}>
          {loading ? "Abriendo pasarela..." : "Pagar con Wompi"}
        </Text>
      </TouchableOpacity>

      {selectedAmount >= 1000 && (
        <Text style={{ color: "#666", fontSize: 11, textAlign: "center" }}>
          Seras redirigido a la pasarela segura de Wompi.
          Tu saldo se actualizara automaticamente al confirmar el pago.
        </Text>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa" }}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}