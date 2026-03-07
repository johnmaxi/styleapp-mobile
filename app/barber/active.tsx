// app/barber/active.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getRouteCoords, LatLng } from "@/utils/directions";
import { getPalette } from "@/utils/palette";
import database from "@react-native-firebase/database";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Linking,
  ScrollView,
  Text, TouchableOpacity, View
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

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
  heading?: number;
  updated_at?: number;
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo", pse: "PSE", nequi: "Nequi", daviplata: "Daviplata",
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  accepted:  { label: "Dirígete al cliente",   color: "#D4AF37" },
  on_route:  { label: "En camino al cliente",  color: "#2196F3" },
  arrived:   { label: "Llegaste al cliente",   color: "#9C27B0" },
  completed: { label: "Servicio completado",   color: "#4caf50" },
  cancelled: { label: "Servicio cancelado",    color: "#dd0000" },
};

export default function BarberActive() {
  const router   = useRouter();
  const { user } = useAuth();
  const palette  = getPalette(user?.gender);
  const params   = useLocalSearchParams<{
    id: string; service_type?: string; address?: string;
    price?: string; status?: string;
  }>();

  const [request, setRequest]               = useState<ServiceRequest | null>(null);
  const [clientInfo, setClientInfo]         = useState<ClientInfo | null>(null);
  const [loading, setLoading]               = useState(false);
  const [myCoords, setMyCoords]             = useState<GPSCoords | null>(null);
  const [clientCoords, setClientCoords]     = useState<GPSCoords | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [routeCoords, setRouteCoords]       = useState<LatLng[]>([]);
  const [loadingRoute, setLoadingRoute]     = useState(false);

  const locationSub   = useRef<Location.LocationSubscription | null>(null);
  const mapRef        = useRef<MapView>(null);
  const clientInfoRef = useRef<ClientInfo | null>(null);
  // Throttle: solo recalcular ruta cada 30 segundos o si el profesional se movió >50m
  const lastRouteCalc = useRef<number>(0);
  const lastRoutePos  = useRef<LatLng | null>(null);

  // ── Calcular/actualizar ruta ───────────────────────────────────────────────
  const updateRoute = useCallback(async (from: LatLng, to: LatLng) => {
    const now = Date.now();
    const lastPos = lastRoutePos.current;

    // Calcular distancia desde último cálculo
    let movedEnough = true;
    if (lastPos) {
      const dlat = (from.latitude - lastPos.latitude) * 111000;
      const dlng = (from.longitude - lastPos.longitude) * 111000 * Math.cos(from.latitude * Math.PI / 180);
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);
      movedEnough = dist > 50; // más de 50 metros
    }

    // Solo recalcular si: primera vez, movió >50m, o pasaron >30s
    if (!lastPos || movedEnough || (now - lastRouteCalc.current) > 30000) {
      setLoadingRoute(true);
      lastRouteCalc.current = now;
      lastRoutePos.current  = from;
      try {
        const coords = await getRouteCoords(from, to);
        setRouteCoords(coords);
      } finally {
        setLoadingRoute(false);
      }
    }
  }, []);

  // ── Cargar datos del servicio ─────────────────────────────────────────────
  const loadRequest = useCallback(async () => {
    if (!params.id) return;
    try {
      for (const path of [`/service-requests/${params.id}`, `/service-request/${params.id}`]) {
        try {
          const res  = await api.get(path);
          const data = res.data?.data || res.data?.request || res.data;
          if (data?.id) {
            setRequest(data);
            if (data.latitude && data.longitude) {
              const dest = { latitude: data.latitude, longitude: data.longitude };
              setClientCoords(dest);
            }
            if (data.client_id && !clientInfoRef.current) {
              try {
                const cr    = await api.get(`/usuarios/me/${data.client_id}`);
                const cdata = cr.data?.user || cr.data;
                if (cdata?.name) {
                  const info = { id: cdata.id, name: cdata.name, phone: cdata.phone };
                  setClientInfo(info);
                  clientInfoRef.current = info;
                }
              } catch {}
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
        id:           Number(params.id),
        service_type: params.service_type,
        address:      params.address,
        price:        params.price ? Number(params.price) : undefined,
        status:       params.status || "accepted",
      });
    }
    loadRequest();
    const timer = setInterval(loadRequest, 8000);
    return () => clearInterval(timer);
  }, [loadRequest]);

  // Cuando tenemos mi posición Y el destino → calcular ruta
  useEffect(() => {
    if (myCoords && clientCoords && request?.status !== "arrived" && request?.status !== "completed") {
      updateRoute(
        { latitude: myCoords.latitude, longitude: myCoords.longitude },
        { latitude: clientCoords.latitude, longitude: clientCoords.longitude }
      );
    }
    // Si llegó o completó, limpiar ruta
    if (request?.status === "arrived" || request?.status === "completed") {
      setRouteCoords([]);
    }
  }, [myCoords, clientCoords, request?.status]);

  // ── GPS Tracking ──────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (trackingActive || !params.id) return;

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso de ubicacion requerido",
        "Ve a Ajustes > Permisos > Ubicacion y actívala.",
        [{ text: "OK" }]
      );
      return;
    }
    await Location.requestBackgroundPermissionsAsync().catch(() => {});
    setTrackingActive(true);

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy:         Location.Accuracy.BestForNavigation,
        timeInterval:     3000,
        distanceInterval: 5,
      },
      async (loc) => {
        const coords: GPSCoords = {
          latitude:   loc.coords.latitude,
          longitude:  loc.coords.longitude,
          heading:    loc.coords.heading ?? 0,
          updated_at: Date.now(),
        };
        setMyCoords(coords);

        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta:  0.008,
          longitudeDelta: 0.008,
        }, 300);

        try {
          await database()
            .ref(`tracking/service_${params.id}`)
            .set(coords);
        } catch (e) {
          console.log("Firebase write error:", e);
        }
      }
    );
  }, [params.id, trackingActive]);

  const stopTracking = useCallback(async () => {
    locationSub.current?.remove();
    locationSub.current = null;
    setTrackingActive(false);
    setRouteCoords([]);
    if (params.id) {
      try { await database().ref(`tracking/service_${params.id}`).remove(); } catch {}
    }
  }, [params.id]);

  useEffect(() => {
    const s = request?.status;
    if ((s === "accepted" || s === "on_route" || s === "arrived") && !trackingActive) {
      startTracking();
    }
    if (s === "completed" || s === "cancelled") {
      stopTracking();
    }
  }, [request?.status]);

  useEffect(() => {
    return () => { stopTracking(); };
  }, []);

  // ── Acciones ──────────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: string) => {
    if (!request?.id) return;
    setLoading(true);
    try {
      await api.patch(`/service-requests/${request.id}/status`, { status: newStatus });
      setRequest((prev) => prev ? { ...prev, status: newStatus } : prev);

      if (newStatus === "on_route" && !trackingActive) startTracking();

      if (newStatus === "completed") {
        await stopTracking();
        router.replace({
          pathname: "/rating",
          params: {
            service_request_id: String(request.id),
            rated_id:           String(request.client_id || ""),
            rated_name:         clientInfoRef.current?.name || "el cliente",
            redirect:           "/barber/home",
          },
        });
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo actualizar el estado");
    } finally {
      setLoading(false);
    }
  };

  const confirmArrived = () => {
    Alert.alert(
      "Llegaste al destino?",
      `Confirma que llegaste a:\n${request?.address || "la ubicacion del cliente"}`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, llegue", onPress: () => updateStatus("arrived") },
      ]
    );
  };

  const confirmComplete = () => {
    Alert.alert(
      "Finalizar servicio",
      "Confirmas que el servicio fue completado?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, finalizar", onPress: () => updateStatus("completed") },
      ]
    );
  };

  const statusInfo = STATUS_INFO[request?.status || "accepted"] || STATUS_INFO.accepted;

  const mapRegion = myCoords
    ? { ...myCoords,     latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : clientCoords
    ? { ...clientCoords, latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : null;

  return (
    <ScrollView contentContainerStyle={{
      backgroundColor: palette.background, paddingBottom: 40,
    }}>

      {/* ── MAPA ── */}
      <View style={{ height: 320, backgroundColor: "#111" }}>
        {mapRegion ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            showsUserLocation={false}
            showsTraffic={false}
          >
            {/* ── RUTA AZUL por calles reales ── */}
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#2196F3"
                strokeWidth={4}
                lineDashPattern={undefined}
                geodesic={true}
              />
            )}

            {/* Pin profesional — azul */}
            {myCoords && (
              <Marker
                coordinate={myCoords}
                title="Tu ubicacion"
                pinColor="#2196F3"
              />
            )}

            {/* Pin destino — dorado */}
            {clientCoords && (
              <Marker
                coordinate={clientCoords}
                title={clientInfo?.name || "Destino"}
                description={request?.address}
                pinColor="#D4AF37"
              />
            )}
          </MapView>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#555", fontSize: 13 }}>Cargando mapa...</Text>
            <Text style={{ color: "#444", fontSize: 11 }}>Asegúrate de tener GPS activado</Text>
          </View>
        )}

        {/* Badge GPS */}
        <View style={{
          position: "absolute", top: 10, left: 10,
          backgroundColor: trackingActive ? "#0a2a0acc" : "#1a1a1acc",
          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
          borderWidth: 1, borderColor: trackingActive ? "#4caf50" : "#444",
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

        {/* Badge ruta */}
        {routeCoords.length > 1 && (
          <View style={{
            position: "absolute", top: 10, right: 10,
            backgroundColor: "#00000099",
            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
            borderWidth: 1, borderColor: "#2196F355",
            flexDirection: "row", alignItems: "center", gap: 6,
          }}>
            <View style={{ width: 16, height: 3, backgroundColor: "#2196F3", borderRadius: 2 }} />
            <Text style={{ color: "#2196F3", fontSize: 11 }}>
              {loadingRoute ? "Actualizando ruta..." : "Ruta activa"}
            </Text>
          </View>
        )}

        {/* Botón centrar */}
        <TouchableOpacity
          onPress={() => {
            // Si hay ruta, mostrar ambos puntos
            if (myCoords && clientCoords && mapRef.current) {
              mapRef.current.fitToCoordinates(
                [
                  { latitude: myCoords.latitude, longitude: myCoords.longitude },
                  { latitude: clientCoords.latitude, longitude: clientCoords.longitude },
                ],
                { edgePadding: { top: 60, right: 40, bottom: 40, left: 40 }, animated: true }
              );
            } else {
              const coords = myCoords || clientCoords;
              if (coords && mapRef.current) {
                mapRef.current.animateToRegion(
                  { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500
                );
              }
            }
          }}
          style={{
            position: "absolute", bottom: 12, right: 12,
            backgroundColor: "#000000cc", borderRadius: 8,
            padding: 10, borderWidth: 1, borderColor: "#444",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 18 }}>⊕</Text>
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: palette.text }}>
          Servicio activo
        </Text>

        {/* STATUS */}
        <View style={{
          backgroundColor: palette.card, padding: 14, borderRadius: 12,
          borderWidth: 2, borderColor: statusInfo.color,
        }}>
          <Text style={{ color: statusInfo.color, fontWeight: "900", fontSize: 16 }}>
            {statusInfo.label}
          </Text>
          <Text style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>
            Solicitud #{request?.id}
          </Text>
        </View>

        {/* DETALLES */}
        <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, gap: 5 }}>
          <Text style={{ color: palette.text }}>
            Servicio: {request?.service_type || params.service_type || "-"}
          </Text>
          <Text style={{ color: palette.text }}>
            Dirección: {request?.address || params.address || "-"}
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
              params: {
                serviceRequestId: String(request?.id),
                otherUserName:    clientInfo?.name || "Cliente",
              },
            })}
            style={{
              flex: 1, backgroundColor: "#0d1b2e", padding: 14,
              borderRadius: 10, borderWidth: 1, borderColor: "#4a90e2",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#4a90e2", fontWeight: "700" }}>💬 Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (clientInfo?.phone) Linking.openURL("tel:" + clientInfo.phone);
              else Alert.alert("Sin teléfono", "El cliente no tiene teléfono registrado");
            }}
            style={{
              flex: 1, backgroundColor: "#0a2a0a", padding: 14,
              borderRadius: 10, borderWidth: 1, borderColor: "#4caf50",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#4caf50", fontWeight: "700" }}>📞 Llamar</Text>
          </TouchableOpacity>
        </View>

        {/* GPS inactivo */}
        {!trackingActive && (
          ["accepted", "on_route", "arrived"].includes(request?.status || "")
        ) && (
          <TouchableOpacity
            onPress={startTracking}
            style={{
              backgroundColor: "#1a1a1a", padding: 12, borderRadius: 10,
              alignItems: "center", borderWidth: 1, borderColor: "#888",
            }}
          >
            <Text style={{ color: "#aaa", fontWeight: "700" }}>📍 Activar GPS</Text>
          </TouchableOpacity>
        )}

        {/* ACCEPTED → En camino */}
        {request?.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateStatus("on_route")}
            disabled={loading}
            style={{
              backgroundColor: "#1f4eb5", padding: 14,
              borderRadius: 10, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {loading ? "Actualizando..." : "🚗 Estoy en camino"}
            </Text>
          </TouchableOpacity>
        )}

        {/* ON_ROUTE → Llegué */}
        {request?.status === "on_route" && (
          <TouchableOpacity
            onPress={confirmArrived}
            disabled={loading}
            style={{
              backgroundColor: "#6a1fb5", padding: 14,
              borderRadius: 10, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {loading ? "Actualizando..." : "📍 Llegué al destino"}
            </Text>
          </TouchableOpacity>
        )}

        {/* ARRIVED → Finalizar */}
        {request?.status === "arrived" && (
          <TouchableOpacity
            onPress={confirmComplete}
            disabled={loading}
            style={{
              backgroundColor: "#0A7E07", padding: 14,
              borderRadius: 10, alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {loading ? "Finalizando..." : "✅ Finalizar servicio"}
            </Text>
          </TouchableOpacity>
        )}

        {/* ON_ROUTE puede finalizar directo también */}
        {request?.status === "on_route" && (
          <TouchableOpacity
            onPress={confirmComplete}
            disabled={loading}
            style={{
              backgroundColor: "transparent", padding: 12,
              borderRadius: 10, alignItems: "center",
              borderWidth: 1, borderColor: "#4caf50",
            }}
          >
            <Text style={{ color: "#4caf50", fontWeight: "700" }}>
              Finalizar servicio directamente
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/barber/home")}
          style={{
            borderWidth: 1, borderColor: "#555",
            padding: 12, borderRadius: 10, alignItems: "center",
          }}
        >
          <Text style={{ color: "#aaa" }}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}