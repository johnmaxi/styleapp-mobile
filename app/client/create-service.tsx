// app/client/create-service.tsx
import {
  PROFESSIONAL_TYPE_LABELS, ProfessionalType, SERVICE_CATALOG, ServiceItem, formatPrice,
} from "@/constants/services";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import api from "../../api";
import { useAuth } from "../../context/AuthContext";
import { getPalette } from "../../utils/palette";

const proTypeOptions: ProfessionalType[] = ["profesional", "estilista", "quiropodologo"];

const PAYMENT_OPTIONS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "pse", label: "PSE (transferencia en linea)" },
  { id: "nequi", label: "Nequi" },
  { id: "daviplata", label: "Daviplata" },
];

export default function CreateService() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [proType, setProType] = useState<ProfessionalType | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedSubOption, setSelectedSubOption] = useState<Record<string, string>>({});
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");

  const currentServices = useMemo<ServiceItem[]>(
    () => (proType ? SERVICE_CATALOG[proType] : []),
    [proType]
  );

  const minPrice = useMemo(() => {
    if (!proType || selectedServices.length === 0) return 0;
    let total = 0;
    for (const svcId of selectedServices) {
      const svc = currentServices.find((s) => s.id === svcId);
      if (!svc) continue;
      if (svc.subOptions) {
        const sub = svc.subOptions.find((s) => s.id === selectedSubOption[svcId]);
        total += sub?.minPrice ?? 0;
      } else {
        total += svc.minPrice;
      }
    }
    return total;
  }, [selectedServices, selectedSubOption, currentServices, proType]);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await SecureStore.getItemAsync("styleapp_profile_defaults");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.address) setAddress(parsed.address);
      } catch {}
    };
    load();
  }, []);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
    if (selectedServices.includes(id)) {
      setSelectedSubOption((prev) => { const c = { ...prev }; delete c[id]; return c; });
    }
  };

  const useCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso requerido", "Activa la ubicacion en tu dispositivo"); return; }
    const loc = await Location.getCurrentPositionAsync({});
    setLatitude(loc.coords.latitude);
    setLongitude(loc.coords.longitude);
    const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    const resolved = `${rev[0]?.street || ""} ${rev[0]?.city || ""}`.trim();
    if (resolved) setAddress(resolved);
  };

  const buildServiceType = () =>
    selectedServices.map((svcId) => {
      const svc = currentServices.find((s) => s.id === svcId);
      if (svc?.subOptions) {
        const sub = svc.subOptions.find((s) => s.id === selectedSubOption[svcId]);
        return sub?.label || svc.label;
      }
      return svc?.label || svcId;
    }).join(", ");

  const doCreate = async () => {
    setLoading(true);
    try {
      const rawToken = await SecureStore.getItemAsync("token");
      if (!rawToken) { Alert.alert("Sesion expirada", "Por favor inicia sesion nuevamente"); router.replace("/login"); return; }

      let lat = latitude;
      let lng = longitude;
      if (!lat || !lng) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({});
            lat = loc.coords.latitude; lng = loc.coords.longitude;
          }
        } catch {}
      }

      const res = await api.post("/service-requests", {
        service_type: buildServiceType(),
        professional_type: proType,
        price: Number(price),
        address, latitude: lat, longitude: lng,
        payment_method: paymentMethod,
      });

      const createdId = res?.data?.data?.id;
      Alert.alert("Solicitud creada", "Buscando profesionales...");
      router.replace({
        pathname: "/client/status",
        params: createdId
          ? { id: String(createdId), service_type: buildServiceType(), address, price: String(Number(price)), status: "open" }
          : undefined,
      });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) { Alert.alert("Sesion expirada", "Inicia sesion nuevamente"); router.replace("/login"); }
      else { Alert.alert("Error", err?.response?.data?.error || err?.message || "No se pudo crear el servicio"); }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!proType) { Alert.alert("Error", "Selecciona el tipo de profesional"); return; }
    if (selectedServices.length === 0) { Alert.alert("Error", "Selecciona al menos un servicio"); return; }
    for (const svcId of selectedServices) {
      const svc = currentServices.find((s) => s.id === svcId);
      if (svc?.subOptions && !selectedSubOption[svcId]) { Alert.alert("Error", `Selecciona el tipo de ${svc.label}`); return; }
    }
    if (!price || Number(price) <= 0) { Alert.alert("Error", "Ingresa un precio valido"); return; }
    if (!address.trim()) { Alert.alert("Error", "Ingresa la direccion del servicio"); return; }
    if (!paymentMethod) { Alert.alert("Error", "Selecciona un medio de pago"); return; }
    if (minPrice > 0 && Number(price) < minPrice) { setShowPriceModal(true); return; }
    await doCreate();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: palette.background, rowGap: 10, paddingBottom: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: palette.text, marginBottom: 8 }}>
        Solicitar servicio
      </Text>

      {/* TIPO PROFESIONAL */}
      <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 6 }}>
        1. Que tipo de profesional necesitas?
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {proTypeOptions.map((pt) => (
          <TouchableOpacity key={pt} onPress={() => { setProType(pt); setSelectedServices([]); setSelectedSubOption({}); }}
            style={{ flex: 1, borderWidth: 1, borderColor: palette.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 4, backgroundColor: proType === pt ? palette.primary : "transparent" }}>
            <Text style={{ color: proType === pt ? "#000" : palette.text, textAlign: "center", fontSize: 12, fontWeight: "700" }}>
              {PROFESSIONAL_TYPE_LABELS[pt]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SERVICIOS */}
      {proType && (
        <>
          <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 6 }}>2. Selecciona los servicios:</Text>
          {currentServices.map((svc) => {
            const isSelected = selectedServices.includes(svc.id);
            return (
              <View key={svc.id}>
                <TouchableOpacity onPress={() => toggleService(svc.id)}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, borderWidth: 1, borderColor: palette.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 10 }}>
                  <View style={{ width: 22, height: 22, borderWidth: 1, marginRight: 10, borderRadius: 6, borderColor: palette.primary, backgroundColor: isSelected ? palette.primary : "transparent" }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text }}>{svc.label}</Text>
                    {!svc.subOptions && <Text style={{ color: palette.primary, fontSize: 11 }}>Precio sugerido: {formatPrice(svc.minPrice)}</Text>}
                    {svc.subOptions && <Text style={{ color: "#888", fontSize: 11 }}>Selecciona el tipo abajo</Text>}
                  </View>
                </TouchableOpacity>
                {svc.subOptions && isSelected && (
                  <View style={{ marginLeft: 20, marginBottom: 8 }}>
                    {svc.subOptions.map((sub) => {
                      const isSel = selectedSubOption[svc.id] === sub.id;
                      return (
                        <TouchableOpacity key={sub.id} onPress={() => setSelectedSubOption((p) => ({ ...p, [svc.id]: sub.id }))}
                          style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, marginBottom: 4, borderWidth: 1, borderRadius: 8, borderColor: isSel ? palette.primary : "#444", backgroundColor: isSel ? palette.primary + "22" : "transparent" }}>
                          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, marginRight: 8, borderColor: palette.primary, backgroundColor: isSel ? palette.primary : "transparent" }} />
                          <Text style={{ color: palette.text, flex: 1, fontSize: 13 }}>{sub.label}</Text>
                          <Text style={{ color: palette.primary, fontSize: 11 }}>{formatPrice(sub.minPrice)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          {minPrice > 0 && (
            <View style={{ backgroundColor: palette.card, padding: 10, borderRadius: 8, marginTop: 4 }}>
              <Text style={{ color: palette.primary, fontWeight: "700" }}>Precio minimo sugerido: {formatPrice(minPrice)}</Text>
              <Text style={{ color: "#aaa", fontSize: 11 }}>Puedes ofrecer menos, pero recibiras menos ofertas</Text>
            </View>
          )}
        </>
      )}

      {/* DIRECCION */}
      <Text style={{ color: palette.text, fontWeight: "700", marginTop: 4 }}>Direccion del servicio</Text>
      <TextInput placeholder="Ingresa la direccion" placeholderTextColor="#888" value={address} onChangeText={setAddress}
        style={{ borderWidth: 1, paddingVertical: 12, paddingHorizontal: 12, borderColor: palette.primary, borderRadius: 8, color: palette.text, marginBottom: 6 }} />
      <TouchableOpacity onPress={useCurrentLocation}
        style={{ borderWidth: 1, borderColor: palette.primary, paddingVertical: 10, borderRadius: 8, marginBottom: 10, alignItems: "center" }}>
        <Text style={{ color: palette.text }}>Usar mi ubicacion actual (GPS)</Text>
      </TouchableOpacity>

      {/* PRECIO EN COP */}
      <Text style={{ color: palette.text, fontWeight: "700" }}>Tu oferta de precio</Text>
      <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.primary, borderRadius: 8, paddingHorizontal: 12, marginBottom: 10 }}>
        <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 16, marginRight: 4 }}>$</Text>
        <TextInput
          placeholder={minPrice > 0 ? Number(minPrice).toLocaleString("es-CO") : "0"}
          placeholderTextColor="#888"
          keyboardType="numeric"
          value={price ? Number(price).toLocaleString("es-CO") : ""}
          onChangeText={(t) => setPrice(t.replace(/\D/g, ""))}
          style={{ flex: 1, paddingVertical: 12, color: palette.text }}
        />
        <Text style={{ color: "#888", fontSize: 11 }}>COP</Text>
      </View>

      {/* MEDIO DE PAGO */}
      <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 6 }}>Medio de pago</Text>
      <View style={{ gap: 8, marginBottom: 10 }}>
        {PAYMENT_OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.id} onPress={() => setPaymentMethod(opt.id)}
            style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: paymentMethod === opt.id ? palette.primary : "#444", borderRadius: 8, padding: 12, backgroundColor: paymentMethod === opt.id ? palette.primary + "22" : "transparent" }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: palette.primary, backgroundColor: paymentMethod === opt.id ? palette.primary : "transparent", marginRight: 10 }} />
            <Text style={{ color: palette.text }}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity onPress={handleCreate} disabled={loading}
        style={{ backgroundColor: palette.primary, paddingVertical: 14, alignItems: "center", borderRadius: 10 }}>
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 16 }}>
          {loading ? "Publicando..." : "Publicar servicio"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}
        style={{ borderWidth: 1, borderColor: "#555", paddingVertical: 12, alignItems: "center", borderRadius: 10, marginTop: 4 }}>
        <Text style={{ color: "#aaa" }}>Cancelar</Text>
      </TouchableOpacity>

      {/* MODAL PRECIO BAJO */}
      <Modal visible={showPriceModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#000000bb", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#1a1a1a", borderRadius: 14, padding: 24, borderWidth: 1, borderColor: palette.primary }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginBottom: 8 }}>Precio por debajo del sugerido</Text>
            <Text style={{ color: "#ccc", marginBottom: 20 }}>
              El precio minimo sugerido es{" "}
              <Text style={{ color: palette.primary, fontWeight: "700" }}>{formatPrice(minPrice)}</Text>.
              {String.fromCharCode(10, 10)}Con un precio menor podrias recibir menos ofertas.
            </Text>
            <TouchableOpacity onPress={() => { setShowPriceModal(false); doCreate(); }}
              style={{ backgroundColor: palette.primary, padding: 13, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ color: "#000", textAlign: "center", fontWeight: "700" }}>Continuar y publicar igual</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowPriceModal(false)}
              style={{ borderWidth: 1, padding: 13, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ color: palette.primary, textAlign: "center" }}>Modificar el precio</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowPriceModal(false); router.back(); }} style={{ padding: 12 }}>
              <Text style={{ color: "#888", textAlign: "center" }}>Cancelar servicio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}