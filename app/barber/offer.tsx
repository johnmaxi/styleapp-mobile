// app/barber/offer.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from "react-native";

export default function OfferScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params  = useLocalSearchParams<{
    requestId?:    string;
    currentPrice?: string;
    serviceType?:  string;
    address?:      string;
  }>();

  const [rawAmount, setRawAmount] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Info del servicio — puede venir en params o cargarse del backend
  const [serviceType, setServiceType] = useState(params.serviceType || "");
  const [address,     setAddress]     = useState(params.address     || "");
  const [price,       setPrice]       = useState(Number(params.currentPrice || 0));
  const [paymentMethod, setPaymentMethod] = useState("");

  // Cargar info del servicio si no vino en params
  useEffect(() => {
    const needsLoad = !serviceType || serviceType === "No definido" || !address;
    if (!needsLoad || !params.requestId) return;

    setLoadingInfo(true);
    api.get(`/service-requests/${params.requestId}`)
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data?.service_type) setServiceType(data.service_type);
        if (data?.address)      setAddress(data.address);
        if (data?.price)        setPrice(Number(data.price));
        if (data?.payment_method) setPaymentMethod(data.payment_method);
      })
      .catch(() => {})
      .finally(() => setLoadingInfo(false));
  }, [params.requestId]);

  const formatCOP = (val: string): string => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("es-CO");
  };

  const handleAmountChange = (val: string) => {
    setRawAmount(val.replace(/\D/g, ""));
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
      Alert.alert(
        "Contraoferta enviada",
        `Tu oferta de $${amount.toLocaleString("es-CO")} fue enviada al cliente.`
      );
      router.replace("/barber/jobs");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo enviar la contraoferta");
    } finally {
      setLoading(false);
    }
  };

  const PAYMENT_LABELS: Record<string, string> = {
    efectivo: "💵 Efectivo",
    nequi:    "📱 Nequi",
    pse:      "🏦 PSE",
    tarjeta:  "💳 Tarjeta",
  };

  return (
    <View style={{
      flex: 1, backgroundColor: palette.background,
      padding: 28, justifyContent: "center",
    }}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text, marginBottom: 20 }}>
        Enviar contraoferta
      </Text>

      {/* Info del servicio */}
      <View style={{
        backgroundColor: palette.card, padding: 16,
        borderRadius: 12, marginBottom: 20,
        borderWidth: 1, borderColor: palette.primary + "55",
      }}>
        {loadingInfo ? (
          <ActivityIndicator color={palette.primary} />
        ) : (
          <>
            <Text style={{ color: "#aaa", fontSize: 12 }}>Servicio</Text>
            <Text style={{ color: palette.text, fontWeight: "700", fontSize: 16, marginBottom: 8 }}>
              {serviceType || "Cargando..."}
            </Text>

            <Text style={{ color: "#aaa", fontSize: 12 }}>Dirección</Text>
            <Text style={{ color: palette.text, marginBottom: 8 }}>
              {address || "Cargando..."}
            </Text>

            <Text style={{ color: "#aaa", fontSize: 12 }}>Precio del cliente</Text>
            <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 20, marginBottom: 8 }}>
              ${price.toLocaleString("es-CO")} COP
            </Text>

            {paymentMethod && (
              <>
                <Text style={{ color: "#aaa", fontSize: 12 }}>Método de pago</Text>
                <Text style={{ color: "#D4AF37", fontWeight: "600" }}>
                  {PAYMENT_LABELS[paymentMethod] || paymentMethod}
                </Text>
              </>
            )}
          </>
        )}
      </View>

      <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 8 }}>
        Tu oferta (en pesos colombianos)
      </Text>

      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#1a1a1a", borderWidth: 1,
        borderColor: palette.primary, borderRadius: 10,
        paddingHorizontal: 14, marginBottom: 8,
      }}>
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
        style={{
          backgroundColor: palette.primary, padding: 16,
          borderRadius: 10, opacity: loading ? 0.7 : 1, marginBottom: 12,
        }}
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
