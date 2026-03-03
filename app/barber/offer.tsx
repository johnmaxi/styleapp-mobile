// app/barber/offer.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function OfferScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params = useLocalSearchParams<{
    requestId?: string;
    currentPrice?: string;
    serviceType?: string;
    address?: string;
  }>();

  const [rawAmount, setRawAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Formatea el número mientras escribe: 50000 → $50.000
  const formatCOP = (val: string): string => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("es-CO");
  };

  const handleAmountChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    setRawAmount(digits);
  };

  const handleSubmit = async () => {
    const amount = Number(rawAmount);
    if (!amount || amount < 1000) {
      Alert.alert("Monto inválido", "Ingresa un valor mayor a $1.000");
      return;
    }

    setLoading(true);
    try {
      await api.post("/bids", {
        service_request_id: Number(params.requestId),
        amount,
      });
      Alert.alert("Contraoferta enviada", `Tu oferta de $${amount.toLocaleString("es-CO")} fue enviada al cliente.`);
      router.replace("/barber/jobs");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo enviar la contraoferta");
    } finally {
      setLoading(false);
    }
  };

  const currentPrice = Number(params.currentPrice || 0);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, padding: 28, justifyContent: "center" }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 20 }}>
        Enviar contraoferta
      </Text>

      <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, marginBottom: 20 }}>
        <Text style={{ color: "#aaa", fontSize: 13 }}>Servicio</Text>
        <Text style={{ color: palette.text, fontWeight: "700" }}>{params.serviceType || "No definido"}</Text>
        <Text style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>Dirección</Text>
        <Text style={{ color: palette.text }}>{params.address || "No definida"}</Text>
        <Text style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>Precio del cliente</Text>
        <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 18 }}>
          ${currentPrice.toLocaleString("es-CO")}
        </Text>
      </View>

      <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 8 }}>
        Tu oferta (en pesos colombianos)
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: palette.primary, borderRadius: 10, paddingHorizontal: 14, marginBottom: 8 }}>
        <Text style={{ color: palette.primary, fontSize: 20, fontWeight: "700", marginRight: 6 }}>$</Text>
        <TextInput
          placeholder="Ej: 50.000"
          placeholderTextColor="#555"
          keyboardType="numeric"
          value={formatCOP(rawAmount)}
          onChangeText={handleAmountChange}
          style={{ flex: 1, color: "#fff", fontSize: 22, fontWeight: "700", paddingVertical: 14 }}
        />
        <Text style={{ color: "#aaa", fontSize: 12 }}>COP</Text>
      </View>

      {rawAmount ? (
        <Text style={{ color: palette.primary, marginBottom: 20, textAlign: "center" }}>
          Oferta: ${Number(rawAmount).toLocaleString("es-CO")} pesos colombianos
        </Text>
      ) : (
        <Text style={{ color: "#555", marginBottom: 20, textAlign: "center", fontSize: 12 }}>
          Ingresa el valor en pesos
        </Text>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading}
        style={{ backgroundColor: palette.primary, padding: 16, borderRadius: 10, opacity: loading ? 0.7 : 1, marginBottom: 12 }}
      >
        <Text style={{ color: "#000", textAlign: "center", fontWeight: "900", fontSize: 16 }}>
          {loading ? "Enviando..." : "Enviar contraoferta"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ borderWidth: 1, borderColor: "#555", padding: 14, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa" }}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}
