import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import api from "../../api";

async function postCounterOffer(id: string, price: number) {
  let lastError: any;

  const endpoints = [
    `/service-request/${id}/counter-offer`,
    `/service-requests/${id}/counter-offer`,
    `/service-request/${id}/offer`,
    `/service-requests/${id}/offer`,
    `/services/${id}/counter-offer`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log("➡️ PROBANDO ENDPOINT:", endpoint);
      return await api.post(endpoint, { price });
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      if (status && status !== 404) {
        throw err;
      }
    }
  }

  throw lastError || new Error("No se encontró endpoint de contraoferta");
}

export default function Offer() {
  const router = useRouter();
  const { id, price } = useLocalSearchParams<{ id: string; price?: string }>();
  const [counterPrice, setCounterPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCounterOffer = async () => {
    if (!id) {
      Alert.alert("Error", "No se encontró la solicitud");
      return;
    }

    if (!counterPrice) {
      Alert.alert("Error", "Ingresa un valor para contraofertar");
      return;
    }

    try {
      setLoading(true);
      await postCounterOffer(id, Number(counterPrice));

      Alert.alert(
        "Contraoferta enviada",
        "El cliente recibirá el nuevo valor para aceptar o rechazar."
      );
      router.replace("/barber/jobs");
    } catch (err: any) {
      console.log("❌ ERROR CONTRAOFERTA:", err?.response?.data || err.message);
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No se pudo enviar la contraoferta"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Nueva contraoferta</Text>
      <Text>Solicitud: #{id}</Text>
      <Text>Precio del cliente: ${price || "No definido"}</Text>

      <TextInput
        keyboardType="numeric"
        placeholder="Tu nuevo precio"
        value={counterPrice}
        onChangeText={setCounterPrice}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 8 }}
      />

      <TouchableOpacity
        onPress={sendCounterOffer}
        disabled={loading}
        style={{ backgroundColor: "#111", padding: 14, borderRadius: 8 }}
      >
        <Text style={{ color: "white", textAlign: "center" }}>
          {loading ? "Enviando..." : "Enviar contraoferta"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("/barber/jobs")}
        style={{ borderWidth: 1, borderColor: "#999", padding: 12, borderRadius: 8 }}
      >
        <Text style={{ textAlign: "center" }}>Cancelar y volver</Text>
      </TouchableOpacity>
    </View>
  );
}