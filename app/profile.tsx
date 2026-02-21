import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { getBarberStats } from "../utils/barberStats";
import { getPalette } from "../utils/palette";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type Request = { status?: string; price?: number };

type BarberStats = {
  total: number;
  open: number;
  assigned: number;
  completed: number;
  gross: number;
  commission: number;
  net: number;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [barberStats, setBarberStats] = useState<BarberStats | null>(null);

  const palette = getPalette(user?.gender);

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === "barber") {
          const stats = await getBarberStats();
          setBarberStats(stats);
        } else {
          const res = await api.get("/service-requests");
          const data = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
              ? res.data.data
              : [];
          setRequests(data);
        }
      } catch {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.role]);

  const summary = useMemo(() => {
    const total = requests.length;
    const completed = requests.filter((r) => r.status === "completed").length;
    const open = requests.filter((r) => r.status === "open").length;
    const accepted = requests.filter((r) => r.status === "accepted" || r.status === "on_route").length;
    const spent = requests
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + Number(r.price || 0), 0);

    return { total, completed, open, accepted, spent };
  }, [requests]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 24, gap: 10, backgroundColor: palette.background }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: palette.text }}>Mi perfil</Text>
      <Text style={{ color: palette.text }}>Usuario: {user?.email}</Text>
      <Text style={{ color: palette.text }}>Rol: {user?.role}</Text>
      <Text style={{ color: palette.text }}>Género: {user?.gender || "No definido"}</Text>

      <Text style={{ marginTop: 10, color: palette.text, fontWeight: "700" }}>Resumen de solicitudes</Text>
      {user?.role === "barber" && barberStats ? (
        <>
          <Text style={{ color: palette.text }}>Totales: {barberStats.total}</Text>
          <Text style={{ color: palette.text }}>Abiertas: {barberStats.open}</Text>
          <Text style={{ color: palette.text }}>Asignadas/en curso: {barberStats.assigned}</Text>
          <Text style={{ color: palette.text }}>Completadas: {barberStats.completed}</Text>
          <Text style={{ color: palette.text }}>Ganancia bruta: ${barberStats.gross.toFixed(0)}</Text>
          <Text style={{ color: palette.text }}>Comisión app (10%): ${barberStats.commission.toFixed(0)}</Text>
          <Text style={{ color: palette.text, fontWeight: "700" }}>Saldo total estimado (90%): ${barberStats.net.toFixed(0)}</Text>
        </>
      ) : (
        <>
          <Text style={{ color: palette.text }}>Total: {summary.total}</Text>
          <Text style={{ color: palette.text }}>Abiertas: {summary.open}</Text>
          <Text style={{ color: palette.text }}>Asignadas/en curso: {summary.accepted}</Text>
          <Text style={{ color: palette.text }}>Completadas: {summary.completed}</Text>
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            Saldo gastado: ${summary.spent}
          </Text>
        </>
      )}


      {user?.role === "client" && (
        <TouchableOpacity
          onPress={() => router.push("/client/create-service")}
          style={{ marginTop: 12, borderWidth: 1, borderColor: palette.primary, padding: 12 }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Crear nueva solicitud</Text>
        </TouchableOpacity>
      )}

      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={() => router.push("/admin")}
          style={{ marginTop: 16, borderWidth: 1, borderColor: palette.primary, padding: 12 }}
        >
          <Text style={{ color: palette.text, textAlign: "center" }}>Panel de administración</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ marginTop: 20, borderWidth: 1, borderColor: palette.primary, padding: 12 }}
      >
        <Text style={{ color: palette.text, textAlign: "center" }}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}
