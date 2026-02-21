import api from "@/services/api";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

type BarberCommission = {
  barber_id: number;
  barber_name?: string;
  completed_total?: number;
  commission_total?: number;
};

export default function AdminScreen() {
  const router = useRouter();
  const palette = getPalette("male");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BarberCommission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/commissions");
        const data: BarberCommission[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        setRows(data);
      } catch (err: any) {
        setError(
          err?.response?.data?.error ||
            "Backend pendiente: expone GET /admin/commissions para consolidado por barbero y total general."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalCommission = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.commission_total || 0), 0),
    [rows]
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 24, gap: 10, backgroundColor: palette.background }}>
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: "700" }}>Panel Administrador</Text>
      <Text style={{ color: palette.text }}>Comisión acumulada 10% por barbero</Text>

      {error && (
        <View style={{ backgroundColor: "#fff6e5", padding: 12, borderRadius: 8 }}>
          <Text style={{ color: "#8a5a00" }}>{error}</Text>
        </View>
      )}

      {rows.map((row) => (
        <View key={row.barber_id} style={{ borderWidth: 1, borderColor: "#444", borderRadius: 8, padding: 12 }}>
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {row.barber_name || `Barbero #${row.barber_id}`}
          </Text>
          <Text style={{ color: palette.text }}>Finalizadas: {row.completed_total || 0}</Text>
          <Text style={{ color: palette.text }}>10% acumulado: ${Number(row.commission_total || 0).toFixed(0)}</Text>
        </View>
      ))}

      <View style={{ backgroundColor: "#111", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: palette.primary }}>
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          10% total general: ${totalCommission.toFixed(0)}
        </Text>
      </View>

      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 10, borderWidth: 1, borderColor: palette.primary, padding: 12 }}>
        <Text style={{ color: palette.text, textAlign: "center" }}>Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
