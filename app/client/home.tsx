// app/client/home.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type ActiveRequest = {
  id: number;
  service_type?: string;
  status?: string;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Buscando profesional",
  accepted: "Profesional asignado",
  on_route: "Profesional en camino",
  arrived: "Profesional llegó",
};

export default function ClientHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);
  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(
    null,
  );
  const [checking, setChecking] = useState(true);

  const displayName = user?.name?.split(" ")[0] || "Cliente";

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        setChecking(true);
        try {
          for (const path of [
            "/service-requests/mine",
            "/service-request/mine",
          ]) {
            try {
              const res = await api.get(path);
              const rows: ActiveRequest[] = Array.isArray(res.data)
                ? res.data
                : res.data?.data || [];
              const active = rows.find(
                (r) => r.status !== "completed" && r.status !== "cancelled",
              );
              if (!cancelled) setActiveRequest(active || null);
              break;
            } catch (e: any) {
              if (e?.response?.status !== 404) throw e;
            }
          }
        } catch {
          if (!cancelled) setActiveRequest(null);
        } finally {
          if (!cancelled) setChecking(false);
        }
      };
      check();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const goToStatus = () => {
    if (!activeRequest) return;
    router.push({
      pathname: "/client/status",
      params: { id: String(activeRequest.id) },
    });
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: palette.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <View
      style={{
        padding: 30,
        backgroundColor: palette.background,
        flex: 1,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: palette.primary,
          marginBottom: 8,
        }}
      >
        STYLEAPP
      </Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 8 }}>
        Bienvenido, {displayName}
      </Text>

      {/* Banner servicio activo */}
      {activeRequest && (
        <TouchableOpacity
          onPress={goToStatus}
          style={{
            backgroundColor: "#0a2a0a",
            padding: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: "#0A7E07",
            marginBottom: 4,
          }}
        >
          <Text style={{ color: "#4caf50", fontWeight: "900", fontSize: 15 }}>
            Servicio en curso
          </Text>
          <Text style={{ color: "#aaa", marginTop: 4, fontSize: 13 }}>
            {activeRequest.service_type} —{" "}
            {STATUS_LABEL[activeRequest.status || ""] || activeRequest.status}
          </Text>
          <Text
            style={{
              color: "#4caf50",
              marginTop: 6,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            Toca para gestionar tu solicitud
          </Text>
        </TouchableOpacity>
      )}

      {/* Solicitar / continuar */}
      <TouchableOpacity
        onPress={() => {
          if (activeRequest) goToStatus();
          else router.push("/client/create-service");
        }}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          {activeRequest
            ? "Continuar solicitud activa"
            : "✂️ Solicitar servicio"}
        </Text>
      </TouchableOpacity>

      {activeRequest && (
        <TouchableOpacity
          onPress={goToStatus}
          style={{
            backgroundColor: palette.card,
            padding: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            Estado de mi solicitud
          </Text>
        </TouchableOpacity>
      )}

      {/* ── NUEVO: IA para cortes de cabello ── */}
      <TouchableOpacity
        onPress={() => router.push("/client/haircut-ai" as any)}
        style={{
          backgroundColor: "#0d1520",
          padding: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#4a90e2",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 28 }}>🤖</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#4a90e2", fontWeight: "900", fontSize: 14 }}>
            IA: Descubre tu corte ideal
          </Text>
          <Text style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
            Sube tu foto y recibe recomendaciones personalizadas
          </Text>
        </View>
        <Text style={{ color: "#4a90e2", fontSize: 18 }}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          alignItems: "center",
          borderWidth: 1,
          borderColor: palette.primary,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          Mi perfil
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: "#dd0000",
          padding: 14,
          alignItems: "center",
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#dd0000", fontWeight: "700" }}>
          Cerrar sesion
        </Text>
      </TouchableOpacity>
    </View>
  );
}
