// app/profile.tsx
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { getPalette } from "../utils/palette";

type Request = { status?: string; price?: number };

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  const palette = getPalette(user?.gender);

  useEffect(() => {
    (async () => {
      try {
        // Cargar perfil completo con foto
        const profileRes = await api.get(`/usuarios/me/${user?.id}`);
        setProfileData(profileRes?.data?.user ?? profileRes?.data);

        // Cargar solicitudes
        const res = await api.get("/service-requests/mine");
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        setRequests(data);
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const summary = useMemo(() => {
    const completed = requests.filter((r) => r.status === "completed").length;
    const open = requests.filter((r) => r.status === "open").length;
    const accepted = requests.filter((r) => r.status === "accepted" || r.status === "on_route").length;
    const spent = requests
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + Number(r.price || 0), 0);
    return { total: requests.length, completed, open, accepted, spent };
  }, [requests]);

  const renderStars = (rating: number) => {
    return [1, 2, 3, 4, 5].map((star) => (
      <Text key={star} style={{ fontSize: 20, color: star <= rating ? palette.primary : "#444" }}>★</Text>
    ));
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const rating = profileData?.rating ?? 0;
  const profilePhoto = profileData?.profile_photo;

  return (
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: palette.background, gap: 10 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: palette.text, marginBottom: 8 }}>Mi perfil</Text>

      {/* FOTO DE PERFIL */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        {profilePhoto ? (
          <Image
            source={{ uri: profilePhoto }}
            style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: palette.primary }}
          />
        ) : (
          <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: palette.primary }}>
            <Text style={{ fontSize: 40 }}>👤</Text>
          </View>
        )}
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 18, marginTop: 8 }}>
          {profileData?.name || user?.email}
        </Text>
      </View>

      {/* CALIFICACIONES */}
      <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, alignItems: "center" }}>
        <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 6 }}>Calificación</Text>
        <View style={{ flexDirection: "row" }}>{renderStars(Math.round(rating))}</View>
        <Text style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
          {rating > 0 ? `${rating.toFixed(1)} / 5` : "Sin calificaciones aún"}
        </Text>
      </View>

      {/* RESUMEN */}
      <Text style={{ marginTop: 10, color: palette.text, fontWeight: "700" }}>Resumen de actividad</Text>
      <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, gap: 6 }}>
        <Text style={{ color: palette.text }}>Total solicitudes: {summary.total}</Text>
        <Text style={{ color: palette.text }}>Abiertas: {summary.open}</Text>
        <Text style={{ color: palette.text }}>En curso: {summary.accepted}</Text>
        <Text style={{ color: palette.text }}>Completadas: {summary.completed}</Text>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>
          {user?.role === "client" ? "Total gastado" : "Total ganado"}: ${summary.spent.toLocaleString("es-CO")}
        </Text>
      </View>

      {/* RECARGAR SALDO */}
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 14, borderRadius: 10, alignItems: "center", marginTop: 4 }}
        onPress={() => alert("Función de recarga disponible próximamente")}
      >
        <Text style={{ color: palette.primary, fontWeight: "700" }}>💳 Recargar saldo</Text>
      </TouchableOpacity>

      {user?.role === "client" && (
        <TouchableOpacity
          onPress={() => router.push("/client/create-service")}
          style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Crear nueva solicitud</Text>
        </TouchableOpacity>
      )}

      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={() => router.push("/admin")}
          style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Panel de administración</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ marginTop: 8, borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa", textAlign: "center" }}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}