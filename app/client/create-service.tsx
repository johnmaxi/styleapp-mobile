import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";

export default function CreateService() {
  const router = useRouter();

  const [services, setServices] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const options = ["corte", "barba", "cejas", "manicure"];

  const toggleService = (service: string) => {
    setServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };

  const handleCreate = async () => {
    try {
      if (services.length === 0) {
        Alert.alert("Error", "Selecciona al menos un servicio");
        return;
      }

      if (!price) {
        Alert.alert("Error", "Ingresa un precio");
        return;
      }

      setLoading(true);

      // 🔥 PEDIR PERMISOS
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa ubicación");
        return;
      }

      // 🔥 OBTENER UBICACIÓN
      const location =
        await Location.getCurrentPositionAsync({});

      const { latitude, longitude } = location.coords;

      // 🔥 OBTENER DIRECCIÓN
      const addressData =
        await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

      const address =
        addressData[0]?.street +
        " " +
        addressData[0]?.city;

      await api.post("/service-requests", {
        service_type: services.join(","),
        price: Number(price),
        address: "Direccion MVP",
        latitude: 0,
        longitude: 0,
      });

      router.replace("/client/status");
    } catch (err: any) {
      console.log(
        "🔥 ERROR CREAR SERVICIO:",
        err?.response?.data || err.message
      );
      Alert.alert("Error", "No se pudo crear el servicio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 22, marginBottom: 20 }}>
        Crear servicio
      </Text>

      <Text style={{ marginBottom: 10 }}>
        ¿Qué servicio necesitas?
      </Text>

      {options.map(item => (
        <TouchableOpacity
          key={item}
          onPress={() => toggleService(item)}
          style={{
            flexDirection: "row",
            marginBottom: 8,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderWidth: 1,
              marginRight: 10,
              backgroundColor: services.includes(item)
                ? "#000"
                : "#fff",
            }}
          />
          <Text>{item}</Text>
        </TouchableOpacity>
      ))}

      <TextInput
        placeholder="Precio ofrecido"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
        style={{
          borderWidth: 1,
          marginBottom: 20,
          padding: 10,
        }}
      />

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: "#000",
          padding: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>
          {loading ? "Enviando..." : "Publicar servicio"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}