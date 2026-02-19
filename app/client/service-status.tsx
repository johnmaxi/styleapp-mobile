import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import api from "../../api";

export default function ServiceStatus() {
  const { id } = useLocalSearchParams();
  const [service, setService] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await api.get(`/services/${id}`);
      setService(res.data);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!service) return <Text>Cargando...</Text>;

  return (
    <View style={{ padding: 20 }}>
      <Text>Estado: {service.status}</Text>

      {service.counterOffer && (
        <>
          <Text>Oferta barbero: ${service.counterOffer}</Text>

          <TouchableOpacity
            onPress={() => api.post(`/services/${id}/accept`)}
            style={{ backgroundColor: "green", padding: 15 }}
          >
            <Text style={{ color: "white" }}>Aceptar trabajo</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
