import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";

type Bid = {
  id: number;
  barber_id?: number;
  status: "pending" | "accepted" | "rejected";
};

export default function Offer() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, price } = useLocalSearchParams<{ id: string; price?: string }>();
  const [counterPrice, setCounterPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const lastStatusRef = useRef<string | null>(null);

  const fetchMyBidsForRequest = useCallback(
    async (requestId: string) => {
      const endpoints = [
        `/bids/barber/request/${requestId}`,
        `/bids/me/request/${requestId}`,
        `/bids/my/request/${requestId}`,
        `/bids/request/${requestId}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          const bids: Bid[] = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];

          if (endpoint === `/bids/request/${requestId}` && user?.id) {
            return bids.filter((bid) => Number(bid.barber_id) === Number(user.id));
          }

          return bids;
        } catch {
          // try next endpoint
        }
      }

      return [];
    },
    [user?.id]
  );

  useEffect(() => {
    let mounted = true;

    async function checkBidState() {
      if (!id) return;

      try {
        const activeFlag = await SecureStore.getItemAsync("barber_is_active");
        setIsActive(activeFlag !== "0");

        const bids = await fetchMyBidsForRequest(id);
        if (!mounted) return;

        const myPending = bids.find((bid) => bid.status === "pending");
        const myAccepted = bids.find((bid) => bid.status === "accepted");
        const myRejected = bids.find((bid) => bid.status === "rejected");

        setBlocked(Boolean(myPending));

        if (myAccepted && lastStatusRef.current !== "accepted") {
          lastStatusRef.current = "accepted";
          Alert.alert(
            "✅ Oferta aceptada",
            "El cliente aceptó tu contraoferta. Se abrió tu servicio activo.",
            [
              {
                text: "Ir a servicio activo",
                onPress: () =>
                  router.replace({
                    pathname: "/barber/active",
                    params: {
                      id,
                      price: String(price || "0"),
                      status: "accepted",
                    },
                  }),
              },
            ]
          );
        }

        if (myRejected && lastStatusRef.current !== "rejected") {
          lastStatusRef.current = "rejected";
          Alert.alert(
            "❌ Contraoferta rechazada",
            "El cliente rechazó tu contraoferta. Puedes enviar una nueva mientras la solicitud siga abierta."
          );
        }

        if (myPending && lastStatusRef.current !== "pending") {
          lastStatusRef.current = "pending";
        }
      } catch (err: any) {
        console.log("❌ ERROR VALIDANDO BIDS:", err?.response?.data || err.message);
      }
    }

    checkBidState();
    const timer = setInterval(checkBidState, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [fetchMyBidsForRequest, id, price, router]);

  const sendCounterOffer = async () => {
    if (!id) {
      Alert.alert("Error", "No se encontró la solicitud");
      return;
    }

    if (!isActive) {
      Alert.alert("Inactivo", "Activa tu estado para enviar contraofertas.");
      return;
    }

    if (blocked) {
      Alert.alert(
        "Debes esperar",
        "Ya existe una contraoferta pendiente. Espera la respuesta del cliente."
      );
      return;
    }

    if (!counterPrice) {
      Alert.alert("Error", "Ingresa un valor para contraofertar");
      return;
    }

    try {
      setLoading(true);
      await api.post("/bids", {
        service_request_id: Number(id),
        amount: Number(counterPrice),
      });

      lastStatusRef.current = "pending";
      setBlocked(true);

      Alert.alert(
        "Contraoferta enviada",
        "El cliente podrá aceptarla o rechazarla. Te notificaremos en esta pantalla."
      );
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

      {!isActive && (
        <View style={{ backgroundColor: "#3a1010", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "#ff9b9b" }}>
            Estás inactivo. No puedes contraofertar solicitudes.
          </Text>
        </View>
      )}

      {blocked && (
        <View style={{ backgroundColor: "#fff6e5", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "#8a5a00" }}>
            Ya hay una contraoferta pendiente. Debes esperar respuesta del cliente.
          </Text>
        </View>
      )}

      <TextInput
        keyboardType="numeric"
        placeholder="Tu nuevo precio"
        value={counterPrice}
        onChangeText={setCounterPrice}
        editable={!blocked && isActive}
        style={{ borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 8 }}
      />

      <TouchableOpacity
        onPress={sendCounterOffer}
        disabled={loading || blocked || !isActive}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: 8,
          opacity: loading || blocked || !isActive ? 0.6 : 1,
        }}
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