// app/client/home.tsx
import api from "@/api";
import { STORE_ENABLED } from "@/constants/featureFlags";
import { useAuth } from "@/context/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type ActiveRequest = {
  id: number;
  service_type?: string;
  status?: string;
};

export default function ClientHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);

  const [activeRequest, setActiveRequest] = useState<ActiveRequest | null>(
    null,
  );
  const [checking, setChecking] = useState(true);

  const displayName = user?.name?.split(" ")[0] || t("register.client");

  usePushNotifications(user?.id, user?.role);

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

  const handleLogout = () => {
    Alert.alert(t("profile.logout"), t("common.confirm") + "?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.yes"),
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {}
          router.replace("/login");
        },
      },
    ]);
  };

  const STATUS_LABEL: Record<string, string> = {
    open: t("client.status.searching"),
    accepted: t("client.status.accepted"),
    on_route: t("client.status.onRoute"),
    arrived: t("client.status.arrived"),
    expired: t("client.status.cancelled"),
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

  const isExpired = activeRequest?.status === "expired";

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
        {t("client.home.title")}, {displayName}
      </Text>

      {/* Banner servicio activo */}
      {activeRequest && !isExpired && (
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
            {t("client.home.activeService")}
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
            {t("client.home.goToService")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Banner servicio expirado */}
      {isExpired && (
        <TouchableOpacity
          onPress={goToStatus}
          style={{
            backgroundColor: "#1a0d00",
            padding: 14,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: "#FF6B35",
            marginBottom: 4,
          }}
        >
          <Text style={{ color: "#FF6B35", fontWeight: "900", fontSize: 15 }}>
            ⏰ {t("client.status.cancelled")}
          </Text>
          <Text style={{ color: "#aaa", marginTop: 4, fontSize: 13 }}>
            {activeRequest?.service_type}
          </Text>
          <Text
            style={{
              color: "#FF6B35",
              marginTop: 6,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            {t("client.home.goToService")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Solicitar / continuar */}
      <TouchableOpacity
        onPress={() => {
          if (activeRequest) goToStatus();
          else router.push("/client/select-professional-type" as any);
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
          {activeRequest && !isExpired
            ? t("client.status.accepted")
            : isExpired
              ? "🔄 " + t("client.home.requestService")
              : "✂️ " + t("client.home.requestService")}
        </Text>
      </TouchableOpacity>

      {activeRequest && !isExpired && (
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
            {t("client.status.title")}
          </Text>
        </TouchableOpacity>
      )}

      {/* IA cortes */}
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
            IA: {t("client.selectType.title")}
          </Text>
          <Text style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
            {t("client.createService.addressPlaceholder")}
          </Text>
        </View>
        <Text style={{ color: "#4a90e2", fontSize: 18 }}>→</Text>
      </TouchableOpacity>

      {/* Mis citas */}
      <TouchableOpacity
        onPress={() => router.push("/client/bookings" as any)}
        style={{
          backgroundColor: "#0d1b2e",
          padding: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#2196F3",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#2196F3", fontWeight: "700" }}>
          📅 {t("client.home.myBookings")}
        </Text>
      </TouchableOpacity>

      {/* Tienda — deshabilitada para el MVP, reactivar en constants/featureFlags.ts */}
      {STORE_ENABLED && (
        <TouchableOpacity
          onPress={() => router.push("/store" as any)}
          style={{
            backgroundColor: "#1a0d2e",
            padding: 16,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#9C27B0",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#9C27B0", fontWeight: "700" }}>
            🛍️ Tienda de productos
          </Text>
        </TouchableOpacity>
      )}

      {/* Mi perfil */}
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
          {t("profile.title")}
        </Text>
      </TouchableOpacity>

      {/* Cerrar sesión */}
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
          {t("profile.logout")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
