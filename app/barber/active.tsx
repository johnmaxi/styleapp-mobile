// app/barber/active.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

type ServiceRequest = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  client_id?: number;
  assigned_barber_id?: number;
  payment_method?: string;
  latitude?: number;
  longitude?: number;
};

type ClientInfo = {
  id: number;
  name?: string;
  phone?: string;
};

type GPSCoords = {
  latitude: number;
  longitude: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  pse:      "PSE",
  nequi:    "Nequi",
  daviplata:"Daviplata",
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  accepted:  { label: "Ve al cliente",        color: "#D4AF37" },
  on_route:  { label: "En camino al cliente", color: "#2196F3" },
  completed: { label: "Servicio completado",   color: "#4caf50" },
  cancelled: { label: "Servicio cancelado",    color: "#dd0000" },
};

export default function BarberActive() {
  const router  = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params  = useLocalSearchParams<{
    id: string; service_type?: string; address?: string; price?: string;
  }>();

  const [request, setRequest]       = useState<ServiceRequest | null>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [loading, setLoading]       = useState(false);
  const [myCoords, setMyCoords]     = useState<GPSCoords | null>(null);
  const [clientCoords, setClientCoords] = useState<GPSCoords | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);

  const locationSub  = useRef<Location.LocationSubscription | null>(null);
  const mapRef       = useRef<MapView>(null);

  // ── Cargar datos del servicio ────────────────────────────────────────────
  const loadRequest = useCallback(async () => {
    if (!params.id) return;
    try {
      for (const path of [`/service-requests/${params.id}`, `/service-request/${params.id}`]) {
        try {
          const res  = await api.get(path);
          const data = res.data?.data || res.data?.request || res.data;
          if (data?.id) {
            setRequest(data);
            if (data.client_id && !clientInfo) {
              try {
                const cr    = await api.get(`/usuarios/me/${data.client_id}`);
                const cdata = cr.data?.user || cr.data;
                if (cdata) setClientInfo({ id: cdata.id, name: cdata.name, phone: cdata.phone });
              } catch {}
            }
            // Coordenadas del cliente (lugar del servicio)
            if (data.latitude && data.longitude) {
              setClientCoords({ latitude: data.latitude, longitude: data.longitude });
            }
            break;
          }
        } catch (e: any) {
          if (e?.response?.status !== 404) throw e;
        }
      }
    } catch {}
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      setRequest({
        id: Number(params.id),
        service_type: params.service_type,
        address:      params.address,
        price:        params.price ? Number(params.price) : undefined,
        status:       "accepted",
      });
    }
    loadRequest();
    const timer = setInterval(loadRequest, 8000);
    return () => clearInterval(timer);
  }, [loadRequest]);

  // ── GPS: publicar ubicacion en Firebase ──────────────────────────────────
  const startTracking = useCallback(async () => {
    if (trackingActive || !params.id) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Activa la ubicacion para que el cliente pueda seguirte.");
      return;
    }

    setTrackingActive(true);

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy:          Location.Accuracy.High,
        timeInterval:      5000,   // cada 5 segundos
        distanceInterval:  10,     // o cada 10 metros
      },
      async (loc) => {
        const coords = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading:   loc.coords.heading || 0,
          updated_at: Date.now(),
        };
        setMyCoords(coords);

        // Publicar en Firebase
        try {
          await database()
            .ref(`tracking/service_${params.id}`)
            .set(coords);
        } catch {}
      }
    );
  }, [params.id, trackingActive]);

  const stopTracking = useCallback(async () => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
    setTrackingActive(false);

    // Limpiar Firebase al terminar
    if (params.id) {
      try {
        await database().ref(`tracking/service_${params.id}`).remove();
      } catch {}
    }
  }, [params.id]);

  // Iniciar tracking automaticamente cuando status es on_route
  useEffect(() => {
    if (request?.status === "on_route") {
      startTracking();
    }
    return () => {
      if (request?.status === "completed" || request?.status === "cancelled") {
        stopTracking();
      }
    };
  }, [request?.status]);

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  // ── Centrar mapa ─────────────────────────────────────────────────────────
  const centerMap = () => {
    if (!mapRef.current) return;
    const coords = myCoords || clientCoords;
    if (!coords) return;
    mapRef.current.animateToRegion({
      ...coords,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 500);
  };

  // ── Acciones ─────────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!request?.id) return;
    setLoading(true);
    try {
      await api.patch(`/service-requests/${request.id}/status`, { status: newStatus });
      setRequest((prev) => prev ? { ...prev, status: newStatus } : prev);

      if (newStatus === "on_route") {
        startTracking();
      }

      if (newStatus === "completed") {
        await stopTracking();
        router.replace({
          pathname: "/rating",
          params: {
            service_request_id: String(request.id),
            rated_id:   String(request.client_id || ""),
            rated_name: clientInfo?.name || "el cliente",
            redirect:   "/barber/home",
          },
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo actualizar el estado");
    } finally {
      setLoading(false);
    }
  };

  const confirmComplete = () => {
    Alert.alert(
      "Finalizar servicio",
      "Confirmas que el servicio fue completado?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Si, finalizar", onPress: () => updateStatus("completed") },
      ]
    );
  };

  const statusInfo = STATUS_INFO[request?.status || "accepted"] || STATUS_INFO.accepted;

  // Region del mapa — prioridad: mi ubicacion, luego la del cliente
  const mapRegion = myCoords
    ? { ...myCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : clientCoords
    ? { ...clientCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : null;

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: palette.background,
        gap: 12,
        paddingBottom: 40,
      }}
    >
      {/* MAPA */}
      {mapRegion ? (
        <View style={{ height: 260, position: "relative" }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsTraffic={false}
          >
            {/* Mi ubicacion (profesional) */}
            {myCoords && (
              <Marker
                coordinate={myCoords}
                title="Tu ubicacion"
                pinColor="#2196F3"
              />
            )}
            {/* Ubicacion del cliente / servicio */}
            {clientCoords && (
              <Marker
                coordinate={clientCoords}
                title={clientInfo?.name || "Cliente"}
                description={request?.address}
                pinColor="#D4AF37"
              />
            )}
          </MapView>

          {/* Boton centrar */}
          <TouchableOpacity
            onPress={centerMap}
            style={{
              position: "absolute", bottom: 12, right: 12,
              backgroundColor: "#000000cc", borderRadius: 8,
              padding: 8, borderWidth: 1, borderColor: "#444",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18 }}>◎</Text>
          </TouchableOpacity>

          {/* Indicador tracking */}
          <View style={{
            position: "absolute", top: 10, left: 10,
            backgroundColor: trackingActive ? "#0a2a0a" : "#1a1a1a",
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
            borderWidth: 1, borderColor: trackingActive ? "#4caf50" : "#555",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <View style={{
              width: 8, height: 8, borderRadius: 4,
              backgroundColor: trackingActive ? "#4caf50" : "#555",
            }} />
            <Text style={{ color: trackingActive ? "#4caf50" : "#888", fontSize: 11 }}>
              {trackingActive ? "GPS activo" : "GPS inactivo"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{
          height: 120, backgroundColor: "#1a1a1a", alignItems: "center",
          justifyContent: "center", gap: 8,
        }}>
          <Text style={{ color: "#888", fontSize: 13 }}>
            Mapa disponible al iniciar el camino
          </Text>
          <Text style={{ color: "#555", fontSize: 11 }}>
            Toca "Estoy en camino" para activar el GPS
          </Text>
        </View>
      )}

      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: palette.text }}>
          Servicio activo
        </Text>

        {/* STATUS */}
        <View style={{
          backgroundColor: palette.card, padding: 16, borderRadius: 12,
          borderWidth: 2, borderColor: statusInfo.color,
        }}>
          <Text style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}>
            {statusInfo.label}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
            Solicitud #{request?.id}
          </Text>
        </View>

        {/* DETALLES */}
        <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, gap: 6 }}>
          <Text style={{ color: palette.text }}>
            Servicio: {request?.service_type || params.service_type || "-"}
          </Text>
          <Text style={{ color: palette.text }}>
            Direccion: {request?.address || params.address || "-"}
          </Text>
          <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 16 }}>
            Valor: ${(request?.price ?? Number(params.price ?? 0)).toLocaleString("es-CO")} COP
          </Text>
          {request?.payment_method && (
            <Text style={{ color: "#aaa" }}>
              Pago: {PAYMENT_LABELS[request.payment_method] || request.payment_method}
            </Text>
          )}
          {clientInfo?.name && (
            <Text style={{ color: "#ccc" }}>Cliente: {clientInfo.name}</Text>
          )}
        </View>

        {/* CHAT Y LLAMADA */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push({
              pathname: "/chat/[serviceRequestId]",
              params: { serviceRequestId: String(request?.id), otherUserName: clientInfo?.name || "Cliente" },
            })}
            style={{
              flex: 1, backgroundColor: "#1a1a2e", padding: 16,
              borderRadius: 10, borderWidth: 1, borderColor: "#4a90e2", alignItems: "center",
            }}
          >
            <Text style={{ color: "#4a90e2", fontWeight: "700", fontSize: 15 }}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (clientInfo?.phone) Linking.openURL("tel:" + clientInfo.phone);
              else Alert.alert("Sin telefono", "El cliente no tiene telefono registrado");
            }}
            style={{
              flex: 1, backgroundColor: "#0a2a0a", padding: 16,
              borderRadius: 10, borderWidth: 1, borderColor: "#4caf50", alignItems: "center",
            }}
          >
            <Text style={{ color: "#4caf50", fontWeight: "700", fontSize: 15 }}>Llamar</Text>
          </TouchableOpacity>
        </View>

        {/* ACCIONES */}
        {request?.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateStatus("on_route")}
            disabled={loading}
            style={{ backgroundColor: "#1f4eb5", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {loading ? "Actualizando..." : "Estoy en camino"}
            </Text>
          </TouchableOpacity>
        )}

        {request?.status === "on_route" && (
          <>
            {!trackingActive && (
              <TouchableOpacity
                onPress={startTracking}
                style={{
                  backgroundColor: "#1a2a1a", padding: 12, borderRadius: 10,
                  alignItems: "center", borderWidth: 1, borderColor: "#4caf50",
                }}
              >
                <Text style={{ color: "#4caf50", fontWeight: "700" }}>
                  Reactivar GPS
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={confirmComplete}
              disabled={loading}
              style={{ backgroundColor: "#0A7E07", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                {loading ? "Finalizando..." : "Finalizar servicio"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/barber/home")}
          style={{ borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}