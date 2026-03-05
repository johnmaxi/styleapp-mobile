// app/profile.tsx
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
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
        // Intentar cargar perfil completo con foto desde varios endpoints
        for (const endpoint of [
          `/usuarios/me/${user?.id}`,
          `/users/me`,
          `/auth/me`,
        ]) {
          try {
            const profileRes = await api.get(endpoint);
            const data = profileRes?.data?.user ?? profileRes?.data;
            if (data && (data.name || data.email || data.profile_photo)) {
              setProfileData(data);
              break;
            }
          } catch {}
        }

        // Cargar solicitudes segun rol
        const PROFESSIONAL_ROLES = ["barber", "estilista", "quiropodologo"];
        if (PROFESSIONAL_ROLES.includes(user?.role || "")) {
          try {
            const res = await api.get("/service-requests/my-history");
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setRequests(data);
          } catch {}
        } else {
          try {
            const res = await api.get("/service-requests/mine");
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setRequests(data);
          } catch {}
        }
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const rating = profileData?.rating ?? 0;
  // Obtener foto de perfil: primero del backend, luego del contexto de auth
  const profilePhoto = profileData?.profile_photo || (user as any)?.profile_photo || null;
  const displayName = profileData?.name || user?.name || user?.email || "Usuario";

  const ROLE_LABELS: Record<string, string> = {
    client: "Cliente",
    barber: "Barbero",
    estilista: "Estilista",
    quiropodologo: "Quiropodologo",
    admin: "Administrador",
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 24, backgroundColor: palette.background, gap: 12, paddingBottom: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: palette.text, marginBottom: 4 }}>Mi perfil</Text>

      {/* FOTO + NOMBRE */}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        {profilePhoto ? (
          <Image
            source={{ uri: profilePhoto }}
            style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 3, borderColor: palette.primary }}
            defaultSource={undefined}
          />
        ) : (
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: palette.card, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: palette.primary }}>
            <Text style={{ fontSize: 44, color: palette.primary }}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 20, marginTop: 10 }}>
          {displayName}
        </Text>
        <Text style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
          {ROLE_LABELS[user?.role || ""] || user?.role}
        </Text>
        {profileData?.phone && (
          <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>{profileData.phone}</Text>
        )}
      </View>

      {/* CALIFICACION */}
      <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, alignItems: "center" }}>
        <Text style={{ color: palette.text, fontWeight: "700", marginBottom: 8 }}>Calificacion</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <View key={star} style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: star <= Math.round(rating) ? palette.primary : "#222",
              alignItems: "center", justifyContent: "center",
              borderWidth: 1, borderColor: star <= Math.round(rating) ? palette.primary : "#444",
            }}>
              <Text style={{ color: star <= Math.round(rating) ? "#000" : "#555", fontWeight: "900" }}>{star}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>
          {rating > 0 ? `${Number(rating).toFixed(1)} / 5` : "Sin calificaciones aun"}
        </Text>
      </View>

      {/* RESUMEN */}
      <Text style={{ color: palette.text, fontWeight: "700", marginTop: 4 }}>Resumen de actividad</Text>
      <View style={{ backgroundColor: palette.card, padding: 14, borderRadius: 10, gap: 6 }}>
        <Text style={{ color: palette.text }}>Total servicios: {summary.total}</Text>
        {user?.role === "client" && <Text style={{ color: palette.text }}>Abiertos: {summary.open}</Text>}
        {user?.role === "client" && <Text style={{ color: palette.text }}>En curso: {summary.accepted}</Text>}
        <Text style={{ color: palette.text }}>Completados: {summary.completed}</Text>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>
          {user?.role === "client" ? "Total gastado" : "Total ganado"}: ${summary.spent.toLocaleString("es-CO")}
        </Text>
      </View>

      {/* RECARGAR SALDO */}
      <TouchableOpacity
        style={{ borderWidth: 1, borderColor: palette.primary, padding: 14, borderRadius: 10, alignItems: "center" }}
        onPress={() => router.push("/recharge" as any)}
      >
        <Text style={{ color: palette.primary, fontWeight: "700" }}>Recargar saldo</Text>
      </TouchableOpacity>

      {user?.role === "client" && (
        <TouchableOpacity
          onPress={() => router.push("/client/create-service")}
          style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: palette.text }}>Crear nueva solicitud</Text>
        </TouchableOpacity>
      )}

      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={() => router.push("/admin" as any)}
          style={{ borderWidth: 1, borderColor: palette.primary, padding: 12, borderRadius: 10, alignItems: "center" }}
        >
          <Text style={{ color: palette.text }}>Panel de administracion</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ marginTop: 4, borderWidth: 1, borderColor: "#555", padding: 12, borderRadius: 10, alignItems: "center" }}
      >
        <Text style={{ color: "#aaa" }}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}