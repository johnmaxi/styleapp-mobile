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

  const createRequestWithFallback = async (payload: {
    service_type: string;
    price: number;
    address: string;
    latitude: number | null;
    longitude: number | null;
  }) => {
    const baseURL = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const baseNoApi = baseURL.replace(/\/api$/, "");

    const endpointCandidates = [
      "/service-requests",
      "/service-requests/create",
      "/service-request",
      "/service-request/create",
      "/jobrequest",
      `${baseNoApi}/service-requests`,
      `${baseNoApi}/service-requests/create`,
      `${baseNoApi}/service-request`,
      `${baseNoApi}/service-request/create`,
      `${baseNoApi}/jobrequest`,
      `${baseNoApi}/api/service-requests`,
      `${baseNoApi}/api/service-requests/create`,
      `${baseNoApi}/api/service-request`,
      `${baseNoApi}/api/service-request/create`,
      `${baseNoApi}/api/jobrequest`,
    ];

    const attemptedEndpoints: string[] = [];
    const attemptedSet = new Set<string>();
    let lastError: any = null;

    for (const endpoint of endpointCandidates) {
      try {
        const resolved = endpoint.startsWith("http")
          ? endpoint
          : `${baseURL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

        if (attemptedSet.has(resolved)) {
          continue;
        }
        attemptedSet.add(resolved);
        attemptedEndpoints.push(resolved);
        console.log("🧪 PROBANDO ENDPOINT CREAR:", resolved);

        const res = endpoint.startsWith("http")
          ? await api.post(endpoint, payload, { baseURL: "" })
          : await api.post(endpoint, payload);

        return res;
      } catch (err: any) {
        const statusCode = err?.response?.status;
        console.log(
          "⚠️ FALLÓ ENDPOINT CREAR:",
          endpoint,
          statusCode,
          err?.response?.data || err.message
        );
        if (statusCode !== 404) {
          throw err;
        }
        lastError = err;
      }
    }

    const fallbackError =
      lastError || new Error("No existe endpoint para crear solicitud");
    (fallbackError as any).attemptedEndpoints = attemptedEndpoints;
    (fallbackError as any).baseURL = api.defaults.baseURL;
    throw fallbackError;
  };

  const diagnoseMountedRoutes = async () => {
    const checks = [
      "/",
      "/service-request",
      "/service-requests",
      "/service-requests/open",
      "/api/service-requests",
      "/api/service-requests/open",
    ];

    const results: string[] = [];

    for (const path of checks) {
      try {
        const res = await api.get(path, { validateStatus: () => true });
        results.push(`${path} => ${res.status}`);
      } catch {
        results.push(`${path} => network_error`);
      }
    }

    return results;
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

      const res = await createRequestWithFallback({
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
        params: createdId
          ? {
              id: String(createdId),
              service_type: services.join(","),
              address,
              price: String(Number(price)),
              latitude: lat != null ? String(lat) : undefined,
              longitude: lng != null ? String(lng) : undefined,
              status: "open",
            }
          : undefined,
      });
    } catch (err: any) {
      console.log("🔥 ERROR CREAR SERVICIO:", err?.response?.data || err.message);
      const statusCode = err?.response?.status;
      if (statusCode === 404) {
        const attempted = (err as any)?.attemptedEndpoints;
        const baseURL = (err as any)?.baseURL || api.defaults.baseURL;
        const diagnostics = await diagnoseMountedRoutes();
        Alert.alert(
          "Endpoint no encontrado",
          `No se encontró ruta para crear solicitud.\n\nBaseURL app: ${baseURL}\nRutas probadas: ${Array.isArray(attempted) ? attempted.join(", ") : "(sin datos)"}\nDiagnóstico rápido: ${diagnostics.join(" | ")}\n\nVerifica en el proceso backend ACTIVO:\n1) app.use('/api/service-requests', serviceRequestRoutes)\n2) router.post('/', controller.create) (o '/create') dentro de service-request.routes.js\n3) confirma que serviceRequestRoutes se exporta/importa sin errores\n4) reinicia el backend después de cambios.`
        );
      } else {
        Alert.alert(
          "Error",
          err?.response?.data?.error || "No se pudo crear el servicio"
        );
      }
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