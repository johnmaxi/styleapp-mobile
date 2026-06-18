// app/profile.tsx
import LanguageSelector from "@/components/LanguageSelector";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<Request[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const palette = getPalette(user?.gender);

  useEffect(() => {
    (async () => {
      try {
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
              if (data.balance !== undefined && data.balance !== null) {
                setBalance(Number(data.balance));
              }
              break;
            }
          } catch {}
        }

        try {
          const balRes = await api.get("/payments/balance");
          if (balRes?.data?.balance !== undefined) {
            setBalance(Number(balRes.data.balance));
          }
        } catch {}

        const PROFESSIONAL_ROLES = ["barber", "estilista", "quiropodologo"];
        if (PROFESSIONAL_ROLES.includes(user?.role || "")) {
          try {
            const res = await api.get("/service-requests/my-history");
            setRequests(
              Array.isArray(res.data) ? res.data : res.data?.data || [],
            );
          } catch {}
        } else {
          try {
            const res = await api.get("/service-requests/mine");
            setRequests(
              Array.isArray(res.data) ? res.data : res.data?.data || [],
            );
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
    const accepted = requests.filter(
      (r) => r.status === "accepted" || r.status === "on_route",
    ).length;
    const spent = requests
      .filter((r) => r.status === "completed")
      .reduce((s, r) => s + Number(r.price || 0), 0);
    return { total: requests.length, completed, open, accepted, spent };
  }, [requests]);

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
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  const rating = profileData?.rating ?? 0;
  const profilePhoto =
    profileData?.profile_photo || (user as any)?.profile_photo || null;
  const displayName =
    profileData?.name || user?.name || user?.email || "Usuario";

  const balanceColor = balance >= 0 ? "#22C55E" : "#EF4444";
  const balanceBg = balance >= 0 ? "#14532D" : "#450A0A";
  const balanceBorder = balance >= 0 ? "#16A34A" : "#B91C1C";
  const balanceIcon = balance >= 0 ? "💰" : "⚠️";
  const balanceLabel =
    balance >= 0 ? t("payments.available") : t("payments.balance");

  const ROLE_LABELS: Record<string, string> = {
    client: t("register.client"),
    barber: t("professional.home.title"),
    estilista: t("client.selectType.stylist"),
    quiropodologo: t("client.selectType.podologist"),
    admin: "Admin",
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        gap: 12,
        paddingBottom: 40,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "700",
          color: palette.text,
          marginBottom: 4,
        }}
      >
        {t("profile.title")}
      </Text>

      {/* FOTO + NOMBRE */}
      <View style={{ alignItems: "center", marginBottom: 8 }}>
        {profilePhoto ? (
          <Image
            source={{ uri: profilePhoto }}
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              borderWidth: 3,
              borderColor: palette.primary,
            }}
          />
        ) : (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: palette.card,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: palette.primary,
            }}
          >
            <Text style={{ fontSize: 44, color: palette.primary }}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text
          style={{
            color: palette.text,
            fontWeight: "700",
            fontSize: 20,
            marginTop: 10,
          }}
        >
          {displayName}
        </Text>
        <Text style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
          {ROLE_LABELS[user?.role || ""] || user?.role}
        </Text>
        {profileData?.phone && (
          <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
            {profileData.phone}
          </Text>
        )}
      </View>

      {/* ── SELECTOR DE IDIOMA ── */}
      <View>
        <Text style={{ color: "#888", fontSize: 12, marginBottom: 6 }}>
          {t("common.language")}
        </Text>
        <LanguageSelector palette={palette} />
      </View>

      {/* ── SALDO ── */}
      <View
        style={{
          backgroundColor: balanceBg,
          borderWidth: 2,
          borderColor: balanceBorder,
          borderRadius: 14,
          padding: 18,
          alignItems: "center",
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 26 }}>{balanceIcon}</Text>
        <Text
          style={{
            color: balanceColor,
            fontWeight: "700",
            fontSize: 13,
            letterSpacing: 0.5,
          }}
        >
          {balanceLabel.toUpperCase()}
        </Text>
        <Text style={{ color: balanceColor, fontWeight: "900", fontSize: 34 }}>
          ${balance.toLocaleString("es-CO")}
          <Text style={{ fontSize: 16, fontWeight: "400" }}> COP</Text>
        </Text>
        {balance < 0 && (
          <Text
            style={{
              color: "#F87171",
              fontSize: 12,
              textAlign: "center",
              marginTop: 2,
            }}
          >
            {t("client.createService.price")}
          </Text>
        )}
      </View>

      {/* RECARGAR SALDO */}
      <TouchableOpacity
        style={{
          backgroundColor: palette.primary,
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
        }}
        onPress={() => router.push("/recharge" as any)}
      >
        <Text style={{ color: "#000", fontWeight: "900", fontSize: 15 }}>
          + {t("payments.recharge")}
        </Text>
      </TouchableOpacity>

      {/* CALIFICACION */}
      <View
        style={{
          backgroundColor: palette.card,
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: palette.text, fontWeight: "700", marginBottom: 8 }}
        >
          {t("rating.title")}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <View
              key={star}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor:
                  star <= Math.round(rating) ? palette.primary : "#222",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor:
                  star <= Math.round(rating) ? palette.primary : "#444",
              }}
            >
              <Text
                style={{
                  color: star <= Math.round(rating) ? "#000" : "#555",
                  fontWeight: "900",
                }}
              >
                {star}
              </Text>
            </View>
          ))}
        </View>
        <Text style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>
          {rating > 0
            ? `${Number(rating).toFixed(1)} / 5`
            : t("rating.howWasService")}
        </Text>
      </View>

      {/* RESUMEN */}
      <Text style={{ color: palette.text, fontWeight: "700", marginTop: 4 }}>
        {t("profile.history")}
      </Text>
      <View
        style={{
          backgroundColor: palette.card,
          padding: 14,
          borderRadius: 10,
          gap: 6,
        }}
      >
        <Text style={{ color: palette.text }}>Total: {summary.total}</Text>
        {user?.role === "client" && (
          <Text style={{ color: palette.text }}>
            {t("client.status.searching")}: {summary.open}
          </Text>
        )}
        {user?.role === "client" && (
          <Text style={{ color: palette.text }}>
            {t("client.status.accepted")}: {summary.accepted}
          </Text>
        )}
        <Text style={{ color: palette.text }}>
          {t("client.status.completed")}: {summary.completed}
        </Text>
        <Text style={{ color: palette.primary, fontWeight: "700" }}>
          {user?.role === "client" ? "Total gastado" : "Total ganado"}: $
          {summary.spent.toLocaleString("es-CO")}
        </Text>
      </View>

      {user?.role === "client" && (
        <TouchableOpacity
          onPress={() => router.push("/client/select-professional-type" as any)}
          style={{
            borderWidth: 1,
            borderColor: palette.primary,
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: palette.text }}>
            {t("client.home.requestService")}
          </Text>
        </TouchableOpacity>
      )}

      {user?.role === "admin" && (
        <TouchableOpacity
          onPress={() => router.push("/admin" as any)}
          style={{
            borderWidth: 1,
            borderColor: palette.primary,
            padding: 12,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text style={{ color: palette.text }}>Panel de administración</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          marginTop: 4,
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>{t("common.back")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
