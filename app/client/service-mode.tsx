// app/client/service-mode.tsx
// Pantalla 2: Cliente elige Agendar o Ya!
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";

export default function ServiceMode() {
  const router   = useRouter();
  const { user } = useAuth();
  const palette  = getPalette(user?.gender);
  const params   = useLocalSearchParams<{ proType: string; proLabel: string }>();

  const { proType, proLabel } = params;

  return (
    <ScrollView contentContainerStyle={{
      padding: 24, backgroundColor: palette.background,
      flexGrow: 1, gap: 16,
    }}>
      <Text style={{ fontSize: 22, fontWeight: "900", color: palette.primary, marginBottom: 4 }}>
        {proLabel || "Servicio"}
      </Text>
      <Text style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
        ¿Cómo deseas solicitar el servicio?
      </Text>

      {/* Solicitar YA */}
      <TouchableOpacity
        onPress={() => router.push({
          pathname: "/client/create-service" as any,
          params: { proType, proLabel, mode: "now" },
        })}
        style={{
          backgroundColor: "#0a2a0a", borderRadius: 16, padding: 24,
          borderWidth: 2, borderColor: "#4caf50", gap: 8,
        }}
      >
        <Text style={{ color: "#4caf50", fontWeight: "900", fontSize: 22 }}>
          ⚡ Solicitar servicio ¡YA!
        </Text>
        <Text style={{ color: "#aaa", fontSize: 14, lineHeight: 20 }}>
          Publica tu solicitud ahora y recibe ofertas de profesionales disponibles inmediatamente.
        </Text>
        <Text style={{ color: "#4caf50", fontSize: 12, marginTop: 4 }}>
          Tiempo de respuesta: 2 - 10 minutos
        </Text>
      </TouchableOpacity>

      {/* Agendar */}
      <TouchableOpacity
        onPress={() => router.push({
          pathname: "/client/schedule-service" as any,
          params: { proType, proLabel },
        })}
        style={{
          backgroundColor: "#0d1b2e", borderRadius: 16, padding: 24,
          borderWidth: 2, borderColor: "#2196F3", gap: 8,
        }}
      >
        <Text style={{ color: "#2196F3", fontWeight: "900", fontSize: 22 }}>
          📅 Agendar servicio
        </Text>
        <Text style={{ color: "#aaa", fontSize: 14, lineHeight: 20 }}>
          Programa tu cita para una fecha y hora específica. El profesional confirmará disponibilidad.
        </Text>
        <Text style={{ color: "#2196F3", fontSize: 12, marginTop: 4 }}>
          Recibirás recordatorio 1 hora antes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{ borderWidth: 1, borderColor: "#555", padding: 12,
          borderRadius: 10, alignItems: "center", marginTop: 8 }}
      >
        <Text style={{ color: "#aaa" }}>← Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
