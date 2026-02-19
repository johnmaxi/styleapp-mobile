import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import api from "../../api";

interface ServiceRequest {
  id: number;
  client_id: number;
  service_type: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
  requested_at: string;
  services: string | null;
  price: string;
}

export default function Home() {
  const [services, setServices] = useState<ServiceRequest[]>([]);

  const fetchOpenServices = async () => {
    try {
      const res = await api.get("/service-requests/open");
      console.log("RESPUESTA BACKEND:", res.data);
      setServices(res.data.data);
    } catch (error: any) {
      console.log(
        "ERROR FETCH:",
        error.response?.data || error.message
      );
    }
  };

  useEffect(() => {
    fetchOpenServices();
  }, []);

  console.log("SERVICES:", services);

  return (
    <ScrollView style={{ padding: 20 }}>
      {services.length === 0 ? (
        <Text>No hay solicitudes abiertas</Text>
      ) : (
        services.map((item) => (
          <View
            key={item.id}
            style={{
              marginBottom: 15,
              padding: 15,
              backgroundColor: "#f2f2f2",
              borderRadius: 10,
            }}
          >
            <Text>Servicio: {item.service_type}</Text>
            <Text>Precio: ${item.price}</Text>
            <Text>Dirección: {item.address}</Text>
            <Text>Estado: {item.status}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}