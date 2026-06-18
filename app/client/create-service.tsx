// app/client/create-service.tsx
import {
  PROFESSIONAL_TYPE_LABELS,
  ProfessionalType,
  SERVICE_CATALOG,
  ServiceItem,
  formatPrice,
} from "@/constants/services";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getPalette } from "../../utils/palette";

const proTypeOptions: ProfessionalType[] = [
  "profesional",
  "estilista",
  "quiropodologo",
];

const PAYMENT_OPTIONS = [
  { id: "efectivo", label: "💵  Efectivo" },
  { id: "nequi", label: "📱  Nequi / Bancolombia / Llaves" },
];

export default function CreateService() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const palette = getPalette(user?.gender);

  const params = useLocalSearchParams<{
    proType?: string;
    mode?: string;
    scheduled_at?: string;
    preset_services?: string;
    notes?: string;
  }>();

  const [proType, setProType] = useState<ProfessionalType | null>(
    (params.proType as ProfessionalType) || null,
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    params.preset_services
      ? params.preset_services.split(",").filter(Boolean)
      : [],
  );
  const [selectedSubOption, setSelectedSubOption] = useState<
    Record<string, string>
  >({});
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const isScheduled = params.mode === "scheduled";
  const scheduledAt = params.scheduled_at || null;

  const mapRef = useRef<MapView>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentServices = useMemo<ServiceItem[]>(
    () => (proType ? SERVICE_CATALOG[proType] : []),
    [proType],
  );

  const minPrice = useMemo(() => {
    if (!proType || selectedServices.length === 0) return 0;
    let total = 0;
    for (const svcId of selectedServices) {
      const svc = currentServices.find((s) => s.id === svcId);
      if (!svc) continue;
      if (svc.subOptions) {
        const sub = svc.subOptions.find(
          (s) => s.id === selectedSubOption[svcId],
        );
        total += sub?.minPrice ?? 0;
      } else {
        total += svc.minPrice;
      }
    }
    return total;
  }, [selectedServices, selectedSubOption, currentServices, proType]);

  const geocodeAddress = async (text: string) => {
    if (!text || text.trim().length < 8) return;
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(text);
      if (results?.length > 0) {
        const { latitude: lat, longitude: lng } = results[0];
        setLatitude(lat);
        setLongitude(lng);
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      }
    } catch {
    } finally {
      setGeocoding(false);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => geocodeAddress(text), 1200);
  };

  useEffect(() => {
    const loadDefault = async () => {
      if (user?.address) {
        setAddress(user.address);
        geocodeAddress(user.address);
        return;
      }
      try {
        const raw = await SecureStore.getItemAsync("styleapp_profile_defaults");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.address) {
            setAddress(parsed.address);
            geocodeAddress(parsed.address);
          }
        }
      } catch {}
    };
    loadDefault();
  }, [user?.address]);

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Activa la ubicacion en tu dispositivo");
      return;
    }
    setGeocoding(true);
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      const rev = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (rev?.length > 0) {
        const r = rev[0];
        const parts = [r.street, r.streetNumber, r.district, r.city]
          .filter(Boolean)
          .join(", ");
        setAddress(
          parts ||
            `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
        );
      }
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    } catch {
      Alert.alert("Error", "No se pudo obtener tu ubicacion");
    } finally {
      setGeocoding(false);
    }
  };

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
    if (selectedServices.includes(id)) {
      setSelectedSubOption((prev) => {
        const c = { ...prev };
        delete c[id];
        return c;
      });
    }
  };

  const buildServiceType = () =>
    selectedServices
      .map((svcId) => {
        const svc = currentServices.find((s) => s.id === svcId);
        if (svc?.subOptions) {
          const sub = svc.subOptions.find(
            (s) => s.id === selectedSubOption[svcId],
          );
          return sub?.label || svc.label;
        }
        return svc?.label || svcId;
      })
      .join(", ");

  const doCreate = async () => {
    setLoading(true);
    try {
      const rawToken = await SecureStore.getItemAsync("token");
      if (!rawToken) {
        Alert.alert("Sesion expirada", "Por favor inicia sesion nuevamente");
        router.replace("/login");
        return;
      }
      let lat = latitude;
      let lng = longitude;
      if (!lat || !lng) {
        if (address.trim().length >= 5) {
          try {
            const results = await Location.geocodeAsync(address);
            if (results?.length > 0) {
              lat = results[0].latitude;
              lng = results[0].longitude;
            }
          } catch {}
        }
        if (!lat || !lng) {
          try {
            const { status } =
              await Location.requestForegroundPermissionsAsync();
            if (status === "granted") {
              const loc = await Location.getCurrentPositionAsync({});
              lat = loc.coords.latitude;
              lng = loc.coords.longitude;
            }
          } catch {}
        }
      }
      const res = await api.post("/service-requests", {
        service_type: buildServiceType(),
        professional_type: proType,
        price: Number(price),
        address,
        latitude: lat,
        longitude: lng,
        payment_method: paymentMethod,
        scheduled_at: scheduledAt || undefined,
        scheduling_notes: params.notes || undefined,
      });
      const createdId = res?.data?.data?.id;
      Alert.alert(
        isScheduled ? "Servicio agendado" : "Solicitud creada",
        isScheduled
          ? "Tu servicio fue agendado. Recibirás recordatorio 1 hora antes."
          : "Buscando profesionales...",
      );
      router.replace({
        pathname: "/client/status",
        params: createdId
          ? {
              id: String(createdId),
              service_type: buildServiceType(),
              address,
              price: String(Number(price)),
              latitude: String(lat ?? ""),
              longitude: String(lng ?? ""),
              status: "open",
            }
          : undefined,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        Alert.alert("Sesion expirada", "Inicia sesion nuevamente");
        router.replace("/login");
      } else {
        Alert.alert(
          "Error",
          err?.response?.data?.error ||
            err?.message ||
            "No se pudo crear el servicio",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!proType) {
      Alert.alert("Error", "Selecciona el tipo de profesional");
      return;
    }
    if (selectedServices.length === 0) {
      Alert.alert("Error", "Selecciona al menos un servicio");
      return;
    }
    for (const svcId of selectedServices) {
      const svc = currentServices.find((s) => s.id === svcId);
      if (svc?.subOptions && !selectedSubOption[svcId]) {
        Alert.alert("Error", `Selecciona el tipo de ${svc.label}`);
        return;
      }
    }
    if (!price || Number(price) <= 0) {
      Alert.alert("Error", "Ingresa un precio valido");
      return;
    }
    if (!address.trim()) {
      Alert.alert("Error", "Ingresa la direccion del servicio");
      return;
    }
    if (!paymentMethod) {
      Alert.alert("Error", "Selecciona un medio de pago");
      return;
    }
    if (minPrice > 0 && Number(price) < minPrice) {
      setShowPriceModal(true);
      return;
    }
    await doCreate();
  };

  const mapCoords = latitude && longitude ? { latitude, longitude } : null;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        rowGap: 10,
        paddingBottom: 40,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: palette.text,
          marginBottom: 8,
        }}
      >
        {isScheduled
          ? `📅 ${t("client.createService.scheduledTitle")}`
          : t("client.createService.title")}
      </Text>

      {isScheduled && scheduledAt && (
        <View
          style={{
            backgroundColor: "#0d1b2e",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: "#2196F3",
            marginBottom: 4,
          }}
        >
          <Text style={{ color: "#2196F3", fontWeight: "700" }}>
            📅{" "}
            {new Date(scheduledAt).toLocaleString("es-CO", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
            ⏰ Recibirás recordatorio 1 hora antes
          </Text>
        </View>
      )}

      {!params.proType && (
        <>
          <Text
            style={{
              color: palette.primary,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            1. Que tipo de profesional necesitas?
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {proTypeOptions.map((pt) => (
              <TouchableOpacity
                key={pt}
                onPress={() => {
                  setProType(pt);
                  setSelectedServices([]);
                  setSelectedSubOption({});
                }}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: palette.primary,
                  borderRadius: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 4,
                  backgroundColor:
                    proType === pt ? palette.primary : "transparent",
                }}
              >
                <Text
                  style={{
                    color: proType === pt ? "#000" : palette.text,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {PROFESSIONAL_TYPE_LABELS[pt]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {proType && (
        <>
          <Text
            style={{
              color: palette.primary,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            {params.proType
              ? "Selecciona los servicios:"
              : "2. Selecciona los servicios:"}
          </Text>
          {currentServices.map((svc) => {
            const isSelected = selectedServices.includes(svc.id);
            return (
              <View key={svc.id}>
                <TouchableOpacity
                  onPress={() => toggleService(svc.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4,
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
                      borderRadius: 6,
                      borderColor: palette.primary,
                      backgroundColor: isSelected
                        ? palette.primary
                        : "transparent",
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text }}>{svc.label}</Text>
                    {!svc.subOptions && (
                      <Text style={{ color: palette.primary, fontSize: 11 }}>
                        Precio sugerido: {formatPrice(svc.minPrice)}
                      </Text>
                    )}
                    {svc.subOptions && (
                      <Text style={{ color: "#888", fontSize: 11 }}>
                        Selecciona el tipo abajo
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                {svc.subOptions && isSelected && (
                  <View style={{ marginLeft: 20, marginBottom: 8 }}>
                    {svc.subOptions.map((sub) => {
                      const isSel = selectedSubOption[svc.id] === sub.id;
                      return (
                        <TouchableOpacity
                          key={sub.id}
                          onPress={() =>
                            setSelectedSubOption((p) => ({
                              ...p,
                              [svc.id]: sub.id,
                            }))
                          }
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 8,
                            paddingHorizontal: 10,
                            marginBottom: 4,
                            borderWidth: 1,
                            borderRadius: 8,
                            borderColor: isSel ? palette.primary : "#444",
                            backgroundColor: isSel
                              ? palette.primary + "22"
                              : "transparent",
                          }}
                        >
                          <View
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 8,
                              borderWidth: 2,
                              marginRight: 8,
                              borderColor: palette.primary,
                              backgroundColor: isSel
                                ? palette.primary
                                : "transparent",
                            }}
                          />
                          <Text
                            style={{
                              color: palette.text,
                              flex: 1,
                              fontSize: 13,
                            }}
                          >
                            {sub.label}
                          </Text>
                          <Text
                            style={{ color: palette.primary, fontSize: 11 }}
                          >
                            {formatPrice(sub.minPrice)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          {minPrice > 0 && (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 10,
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                Precio minimo sugerido: {formatPrice(minPrice)}
              </Text>
              <Text style={{ color: "#aaa", fontSize: 11 }}>
                Puedes ofrecer menos, pero recibiras menos ofertas
              </Text>
            </View>
          )}
        </>
      )}

      <Text style={{ color: palette.text, fontWeight: "700", marginTop: 4 }}>
        Direccion del servicio
      </Text>
      {user?.address && address === user.address && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#1a1a0a",
            padding: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#D4AF3760",
          }}
        >
          <Text style={{ color: "#D4AF37", fontSize: 11 }}>
            📋 Dirección cargada desde tu perfil. Puedes modificarla.
          </Text>
        </View>
      )}
      <TextInput
        placeholder="Ingresa la direccion donde se realizará el servicio"
        placeholderTextColor="#888"
        value={address}
        onChangeText={handleAddressChange}
        style={{
          borderWidth: 1,
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderColor: geocoding ? "#D4AF37" : palette.primary,
          borderRadius: 8,
          color: palette.text,
          marginBottom: 4,
        }}
      />
      {geocoding && (
        <Text style={{ color: "#D4AF37", fontSize: 11, marginBottom: 4 }}>
          🔍 Localizando dirección...
        </Text>
      )}
      {mapCoords && !geocoding && (
        <Text style={{ color: "#4caf50", fontSize: 11, marginBottom: 4 }}>
          ✓ Dirección encontrada
        </Text>
      )}

      {mapCoords && (
        <View
          style={{
            height: 180,
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: palette.primary + "55",
            marginBottom: 6,
          }}
        >
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              ...mapCoords,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            scrollEnabled
            zoomEnabled
          >
            <Marker
              coordinate={mapCoords}
              title="Lugar del servicio"
              description={address}
              pinColor="#D4AF37"
            />
          </MapView>
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              backgroundColor: "#000000cc",
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: "#D4AF37", fontSize: 10 }}>
              📍 Lugar del servicio
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={useCurrentLocation}
        disabled={geocoding}
        style={{
          borderWidth: 1,
          borderColor: palette.primary,
          paddingVertical: 10,
          borderRadius: 8,
          marginBottom: 6,
          alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text }}>
          {geocoding
            ? t("client.createService.locating")
            : `📍 ${t("client.createService.useLocation")}`}
        </Text>
      </TouchableOpacity>

      <Text style={{ color: palette.text, fontWeight: "700" }}>
        Tu oferta de precio
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 8,
          paddingHorizontal: 12,
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: palette.primary,
            fontWeight: "700",
            fontSize: 16,
            marginRight: 4,
          }}
        >
          $
        </Text>
        <TextInput
          placeholder={
            minPrice > 0 ? Number(minPrice).toLocaleString("es-CO") : "0"
          }
          placeholderTextColor="#888"
          keyboardType="numeric"
          value={price ? Number(price).toLocaleString("es-CO") : ""}
          onChangeText={(txt) => setPrice(txt.replace(/\D/g, ""))}
          style={{ flex: 1, paddingVertical: 12, color: palette.text }}
        />
        <Text style={{ color: "#888", fontSize: 11 }}>COP</Text>
      </View>

      <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 6 }}>
        Medio de pago
      </Text>
      <View
        style={{
          backgroundColor: "#0d1b2e",
          borderRadius: 8,
          padding: 10,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: "#1e3a5c",
        }}
      >
        <Text style={{ color: "#888", fontSize: 11 }}>
          💵 <Text style={{ color: "#ccc" }}>Efectivo</Text> o 📱{" "}
          <Text style={{ color: "#ccc" }}>Nequi/Bancolombia/Llaves</Text> — el
          profesional confirma el pago al finalizar el servicio.
        </Text>
      </View>
      <View style={{ gap: 8, marginBottom: 10 }}>
        {PAYMENT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            onPress={() => setPaymentMethod(opt.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: paymentMethod === opt.id ? palette.primary : "#444",
              borderRadius: 8,
              padding: 12,
              backgroundColor:
                paymentMethod === opt.id
                  ? palette.primary + "22"
                  : "transparent",
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: palette.primary,
                backgroundColor:
                  paymentMethod === opt.id ? palette.primary : "transparent",
                marginRight: 10,
              }}
            />
            <Text style={{ color: palette.text, flex: 1 }}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: palette.primary,
          paddingVertical: 14,
          alignItems: "center",
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
          {loading
            ? t("common.loading")
            : isScheduled
              ? t("client.createService.confirmBooking")
              : t("client.createService.publish")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          paddingVertical: 12,
          alignItems: "center",
          borderRadius: 10,
          marginTop: 4,
        }}
      >
        <Text style={{ color: "#aaa" }}>Cancelar</Text>
      </TouchableOpacity>

      <Modal visible={showPriceModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "#000000bb",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderRadius: 14,
              padding: 24,
              borderWidth: 1,
              borderColor: palette.primary,
            }}
          >
            <Text
              style={{
                color: palette.text,
                fontWeight: "700",
                fontSize: 17,
                marginBottom: 10,
              }}
            >
              Precio menor al sugerido
            </Text>
            <Text style={{ color: "#ccc", marginBottom: 20 }}>
              El precio minimo sugerido es{" "}
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                {formatPrice(minPrice)}
              </Text>
              .{"\n\n"}
              Con un precio menor podrias recibir menos ofertas.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowPriceModal(false);
                doCreate();
              }}
              style={{
                backgroundColor: palette.primary,
                padding: 13,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: "#000",
                  textAlign: "center",
                  fontWeight: "700",
                }}
              >
                Continuar y publicar igual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowPriceModal(false)}
              style={{
                borderWidth: 1,
                borderColor: palette.primary,
                padding: 13,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: palette.primary, textAlign: "center" }}>
                Modificar el precio
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowPriceModal(false);
                router.back();
              }}
              style={{ padding: 12 }}
            >
              <Text style={{ color: "#888", textAlign: "center" }}>
                Cancelar servicio
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
