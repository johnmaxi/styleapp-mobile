import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getPalette } from "../../utils/palette";

export default function CreateService() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [services, setServices] = useState<string[]>([]);
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const serviceOptions = useMemo<string[]>(
    () => ["corte", "barba", "cejas", "manicure"],
    []
  );

  useEffect(() => {
    const loadDefaults = async () => {
      const raw = await SecureStore.getItemAsync("styleapp_profile_defaults");
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw);
        if (parsed?.address) {
          setAddress(parsed.address);
        }
      } catch {
        // ignore invalid json
      }
    };

    loadDefaults();
  }, []);

  const toggleService = (service: string) => {
    setServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permiso requerido",
        "Activa ubicación para autocompletar dirección"
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const coords = location.coords;

    setLatitude(coords.latitude);
    setLongitude(coords.longitude);

    const reverse = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    const resolvedAddress = `${reverse[0]?.street || ""} ${
      reverse[0]?.city || ""
    }`.trim();
    if (resolvedAddress) {
      setAddress(resolvedAddress);
    }
  };

  const openLocator = async () => {
    const query = encodeURIComponent(address || "StyleApp Medellín");
    await WebBrowser.openBrowserAsync(
      `https://www.google.com/maps/search/?api=1&query=${query}`
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

      if (!address.trim()) {
        Alert.alert("Error", "Ingresa la dirección del servicio");
        return;
      }

      setLoading(true);

      let lat = latitude;
      let lng = longitude;

      if (!lat || !lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({});
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }
      }

      const res = await api.post("/service-requests", {
        service_type: services.join(","),
        price: Number(price),
        address,
        latitude: lat,
        longitude: lng,
      });

      const createdId = res?.data?.data?.id;

      Alert.alert(
        "Solicitud creada",
        "Buscando barberos para tus servicios seleccionados."
      );

      router.replace({
        pathname: "/client/status",
        params: createdId ? { id: String(createdId) } : undefined,
      });
    } catch (err: any) {
      console.log("🔥 ERROR CREAR SERVICIO:", err?.response?.data || err.message);
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No se pudo crear el servicio"
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
        rowGap: 10,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          marginBottom: 8,
          color: palette.text,
          fontWeight: "700",
        }}
      >
        Crear servicio
      </Text>

      <Text style={{ marginBottom: 6, color: palette.text }}>
        Selecciona uno o varios servicios:
      </Text>

      {serviceOptions.map((item: string) => (
        <TouchableOpacity
          key={item}
          onPress={() => toggleService(item)}
          style={{
            flexDirection: "row",
            marginBottom: 8,
            alignItems: "center",
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 10,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderWidth: 1,
              marginRight: 10,
              borderColor: palette.primary,
              backgroundColor: services.includes(item)
                ? palette.primary
                : "transparent",
              borderRadius: 6,
            }}
          />
          <Text style={{ color: palette.text, textTransform: "capitalize" }}>
            {item}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={{ marginTop: 8, color: palette.text }}>Dirección del servicio</Text>
      <TextInput
        placeholder="Dirección"
        placeholderTextColor="#888"
        value={address}
        onChangeText={setAddress}
        style={{
          borderWidth: 1,
          marginBottom: 8,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderColor: palette.primary,
          borderRadius: 8,
          color: palette.text,
        }}
      />

      <View style={{ flexDirection: "row", columnGap: 8 }}>
        <TouchableOpacity
          onPress={useCurrentLocation}
          style={{
            flex: 1,
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.primary,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>
            Usar mi ubicación
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openLocator}
          style={{
            flex: 1,
            backgroundColor: palette.card,
            borderWidth: 1,
            borderColor: palette.primary,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>
            Abrir localizador
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Precio ofrecido"
        placeholderTextColor="#888"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
        style={{
          borderWidth: 1,
          marginTop: 10,
          marginBottom: 14,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderColor: palette.primary,
          borderRadius: 8,
          color: palette.text,
        }}
      />

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          paddingVertical: 14,
          paddingHorizontal: 12,
          alignItems: "center",
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700" }}>
          {loading ? "Enviando..." : "Publicar servicio"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}