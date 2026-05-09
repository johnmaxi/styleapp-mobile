// app/barber/home.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { getPalette } from "@/utils/palette";
import { playSound } from "@/utils/sounds";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MyBid = {
  id: number;
  service_request_id: number;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  service_type?: string;
  address?: string;
};

type ActiveService = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  payment_method?: string;
  client_id?: number;
};

export default function BarberHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const palette = getPalette(user?.gender);

  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [activeService, setActiveService] = useState<ActiveService | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);

  const prevOpenCountRef = useRef<number>(-1);
  const prevBidsCountRef = useRef<number>(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayName =
    user?.name?.split(" ")[0] || t("register.professional") || "Profesional";

  const ROLE_LABELS: Record<string, string> = {
    barber: t("client.selectType.barber"),
    estilista: t("client.selectType.stylist"),
    quiropodologo: t("client.selectType.podologist"),
  };
  const roleLabel = ROLE_LABELS[user?.role || ""] || "Profesional";

  usePushNotifications(user?.id, user?.role);

  const loadData = useCallback(async () => {
    try {
      try {
        const statusRes = await api.get("/service-requests/active-status");
        setIsActive(statusRes.data?.is_active ?? true);
      } catch {}

      try {
        const assignedRes = await api.get("/service-requests/assigned/me");
        const assigned: ActiveService[] = Array.isArray(assignedRes.data)
          ? assignedRes.data
          : Array.isArray(assignedRes.data?.data)
            ? assignedRes.data.data
            : [];
        const active = assigned.find(
          (s) =>
            s.status === "accepted" ||
            s.status === "on_route" ||
            s.status === "arrived",
        );
        setActiveService(active || null);
      } catch {}

      try {
        const bidsRes = await api.get("/bids/my-bids");
        const bids: MyBid[] = Array.isArray(bidsRes.data)
          ? bidsRes.data
          : Array.isArray(bidsRes.data?.data)
            ? bidsRes.data.data
            : [];
        const pending = bids.filter((b) => b.status === "pending");
        setMyBids(pending);
        if (
          prevBidsCountRef.current > 0 &&
          pending.length < prevBidsCountRef.current
        ) {
          playSound("service_accepted");
        }
        prevBidsCountRef.current = pending.length;
      } catch {}

      try {
        const openRes = await api.get("/service-requests/open");
        const open = Array.isArray(openRes.data)
          ? openRes.data
          : openRes.data?.data || [];
        if (
          prevOpenCountRef.current >= 0 &&
          open.length > prevOpenCountRef.current
        ) {
          playSound("new_request");
        }
        prevOpenCountRef.current = open.length;
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      timerRef.current = setInterval(loadData, 8000);
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [loadData]),
  );

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const res = await api.patch("/service-requests/toggle-active");
      const newActive = res.data?.is_active ?? !isActive;
      setIsActive(newActive);
      Alert.alert(
        newActive
          ? t("professional.home.active")
          : t("professional.home.inactive"),
        newActive
          ? t("professional.home.receiving")
          : t("professional.home.notReceiving"),
      );
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err?.response?.data?.error || t("common.retry"),
      );
    } finally {
      setTogglingActive(false);
    }
  };

  const goToActiveService = () => {
    if (!activeService) return;
    router.push({
      pathname: "/barber/active",
      params: {
        id: String(activeService.id),
        service_type: activeService.service_type || "",
        address: activeService.address || "",
        price: String(activeService.price || 0),
        status: activeService.status || "accepted",
      },
    });
  };

  const handleLogout = () => {
    Alert.alert(t("profile.logout"), t("common.confirm") + "?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.yes"),
        style: "destructive",
        onPress: async () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          try {
            await logout();
          } catch {}
          router.replace("/login");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        paddingBottom: 40,
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "900", color: palette.primary }}>
        Style
      </Text>
      <Text style={{ fontSize: 20, color: palette.text, marginBottom: 2 }}>
        {t("professional.home.title")}, {displayName}
      </Text>
      <Text style={{ color: "#888", marginBottom: 4 }}>{roleLabel}</Text>

      {/* Toggle activo */}
      <View
        style={{
          backgroundColor: isActive ? "#0a2a0a" : "#1a1a1a",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: isActive ? "#4caf50" : "#555",
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isActive ? "#4caf50" : "#555",
              }}
            />
            <Text
              style={{
                color: isActive ? "#4caf50" : "#888",
                fontWeight: "900",
                fontSize: 16,
              }}
            >
              {isActive
                ? t("professional.home.active")
                : t("professional.home.inactive")}
            </Text>
          </View>
          <Text style={{ color: "#888", fontSize: 12 }}>
            {isActive
              ? t("professional.home.receiving")
              : t("professional.home.notReceiving")}
          </Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={handleToggleActive}
          disabled={togglingActive}
          trackColor={{ false: "#333", true: "#1a4d1a" }}
          thumbColor={isActive ? "#4caf50" : "#666"}
          ios_backgroundColor="#333"
        />
      </View>

      {/* Servicio activo */}
      {activeService && (
        <TouchableOpacity
          onPress={goToActiveService}
          style={{
            backgroundColor: "#0a1a2a",
            padding: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor:
              activeService.status === "on_route"
                ? "#2196F3"
                : activeService.status === "arrived"
                  ? "#9C27B0"
                  : "#0A7E07",
          }}
        >
          <Text
            style={{
              color:
                activeService.status === "on_route"
                  ? "#2196F3"
                  : activeService.status === "arrived"
                    ? "#9C27B0"
                    : "#4caf50",
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            {activeService.status === "on_route"
              ? "🚗 " + t("professional.active.onRoute")
              : activeService.status === "arrived"
                ? "📍 " + t("professional.active.arrived")
                : "✅ " + t("professional.home.activeService")}
          </Text>
          <Text style={{ color: "#ccc", marginTop: 4 }}>
            {activeService.service_type || t("professional.active.service")} — #
            {activeService.id}
          </Text>
          {activeService.address && (
            <Text style={{ color: "#aaa", marginTop: 2, fontSize: 12 }}>
              {activeService.address}
            </Text>
          )}
          {activeService.price != null && (
            <Text style={{ color: "#4caf50", marginTop: 4, fontWeight: "700" }}>
              ${Number(activeService.price).toLocaleString("es-CO")} COP
            </Text>
          )}
          <Text
            style={{
              color: "#4a90e2",
              marginTop: 8,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {t("professional.home.goToService")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Ofertas pendientes */}
      {myBids.length > 0 && (
        <View
          style={{
            backgroundColor: "#1a1a0a",
            padding: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.primary,
          }}
        >
          <Text
            style={{
              color: palette.primary,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            {t("professional.jobs.pending")} ({myBids.length})
          </Text>
          {myBids.map((bid) => (
            <View
              key={bid.id}
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#333",
                paddingBottom: 6,
                marginBottom: 6,
              }}
            >
              <Text style={{ color: "#ccc" }}>
                {bid.service_type || t("professional.active.service")} — $
                {bid.amount.toLocaleString("es-CO")} COP
              </Text>
              <Text style={{ color: "#888", fontSize: 11 }}>
                {t("professional.jobs.waiting")}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!activeService && myBids.length === 0 && (
        <View
          style={{
            backgroundColor: palette.card,
            padding: 16,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#888", textAlign: "center" }}>
            {isActive
              ? t("professional.jobs.noJobs")
              : t("professional.home.notReceiving")}
          </Text>
        </View>
      )}

      {isActive && (
        <TouchableOpacity
          onPress={() => router.push("/barber/jobs")}
          style={{
            backgroundColor: palette.card,
            padding: 16,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: palette.primary,
            alignItems: "center",
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>
            {t("professional.jobs.title")}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.push("/barber/schedule" as any)}
        style={{
          backgroundColor: "#0d1b2e",
          padding: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#2196F3",
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <Text style={{ color: "#2196F3", fontWeight: "700" }}>
          📅 {t("professional.home.mySchedule")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/barber/history")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.primary,
          alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          {t("professional.home.myHistory")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/profile")}
        style={{
          backgroundColor: palette.card,
          padding: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: palette.primary,
          alignItems: "center",
        }}
      >
        <Text style={{ color: palette.text, fontWeight: "700" }}>
          {t("profile.title")}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          borderWidth: 1,
          borderColor: "#dd0000",
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#dd0000", fontWeight: "700" }}>
          {t("profile.logout")}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
