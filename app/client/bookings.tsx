// app/client/bookings.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Booking = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  scheduled_at?: string;
  payment_method?: string;
  barber_name?: string;
  barber_phone?: string;
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#2196F3",
  open: "#D4AF37",
  accepted: "#4caf50",
  on_route: "#9C27B0",
  arrived: "#FF9800",
  completed: "#4caf50",
  cancelled: "#555",
};

// STATUS_LABEL defined inside component

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const MONTHS_SHORT = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function ClientBookings() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const palette = getPalette(user?.gender);

  const STATUS_LABEL: Record<string, string> = {
    scheduled: t("client.bookings.waitingPro"),
    open: t("client.status.searching"),
    accepted: t("client.bookings.proConfirmed"),
    on_route: t("client.status.onRoute"),
    arrived: t("client.status.arrived"),
    completed: t("client.status.completed"),
    cancelled: t("client.status.cancelled"),
  };

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/schedule/client?month=${month + 1}&year=${year}`,
      );
      setBookings(res.data.bookings || []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings]),
  );

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  // Días con citas
  const daysWithBookings = new Set(
    bookings
      .map((b) => (b.scheduled_at ? new Date(b.scheduled_at).getDate() : null))
      .filter(Boolean),
  );

  // Citas del día seleccionado
  const dayBookings = selectedDay
    ? bookings.filter((b) => {
        if (!b.scheduled_at) return false;
        return new Date(b.scheduled_at).getDate() === selectedDay;
      })
    : [];

  const handleCancel = (booking: Booking) => {
    const isAccepted = ["accepted", "on_route", "arrived"].includes(
      booking.status || "",
    );
    const penalty = isAccepted ? Math.round((booking.price || 0) * 0.15) : 0;

    Alert.alert(
      "Cancelar servicio",
      isAccepted
        ? `El profesional ya aceptó tu solicitud. Se aplicará una penalización de $${penalty.toLocaleString("es-CO")} (15%).\n\n¿Confirmas la cancelación?`
        : "El servicio aún no tiene profesional asignado. Se cancelará sin penalización.\n\n¿Confirmas?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setCancelling(booking.id);
            try {
              await api.post(`/payments/cancel-service/${booking.id}`);
              Alert.alert(
                "Cancelado",
                isAccepted
                  ? `Servicio cancelado. Se descontaron $${penalty.toLocaleString("es-CO")} de penalización.`
                  : "Servicio cancelado sin penalización.",
              );
              loadBookings();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.response?.data?.error || "No se pudo cancelar",
              );
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const calendarDays: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null as null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: palette.background,
        padding: 20,
        paddingBottom: 40,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "900", color: palette.primary }}>
        📅 Mis Citas
      </Text>

      {/* ── NAVEGACIÓN MES ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={prevMonth}
          style={{
            backgroundColor: palette.card,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#333",
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>← Ant</Text>
        </TouchableOpacity>
        <Text style={{ color: palette.text, fontWeight: "900", fontSize: 16 }}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={{
            backgroundColor: palette.card,
            padding: 10,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#333",
          }}
        >
          <Text style={{ color: palette.text, fontWeight: "700" }}>Sig →</Text>
        </TouchableOpacity>
      </View>

      {/* ── CABECERA DÍAS ── */}
      <View style={{ flexDirection: "row" }}>
        {DAYS_SHORT.map((d) => (
          <View
            key={d}
            style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
          >
            <Text style={{ color: "#555", fontSize: 11, fontWeight: "700" }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* ── CALENDARIO ── */}
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarDays.map((day, idx) => {
            if (!day)
              return <View key={`empty-${idx}`} style={{ width: "14.28%" }} />;

            const isToday =
              day === now.getDate() &&
              month === now.getMonth() &&
              year === now.getFullYear();
            const isSelected = day === selectedDay;
            const hasCita = daysWithBookings.has(day);
            const dayBks = bookings.filter(
              (b) =>
                b.scheduled_at && new Date(b.scheduled_at).getDate() === day,
            );
            const hasActive = dayBks.some((b) =>
              ["scheduled", "open", "accepted", "on_route", "arrived"].includes(
                b.status || "",
              ),
            );
            const hasCompleted = dayBks.some((b) => b.status === "completed");

            return (
              <TouchableOpacity
                key={day}
                onPress={() => setSelectedDay(isSelected ? null : day)}
                style={{
                  width: "14.28%",
                  aspectRatio: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: isSelected
                    ? palette.primary
                    : isToday
                      ? palette.card
                      : "transparent",
                  borderWidth: isToday ? 1 : 0,
                  borderColor: palette.primary + "88",
                }}
              >
                <Text
                  style={{
                    color: isSelected
                      ? "#000"
                      : isToday
                        ? palette.primary
                        : palette.text,
                    fontWeight: isToday || isSelected ? "900" : "400",
                    fontSize: 14,
                  }}
                >
                  {day}
                </Text>
                {/* Indicadores */}
                {hasCita && (
                  <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                    {hasActive && (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isSelected ? "#000" : "#2196F3",
                        }}
                      />
                    )}
                    {hasCompleted && (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: isSelected ? "#000" : "#4caf50",
                        }}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── LEYENDA ── */}
      <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#2196F3",
            }}
          />
          <Text style={{ color: "#666", fontSize: 11 }}>Pendiente/activa</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#4caf50",
            }}
          />
          <Text style={{ color: "#666", fontSize: 11 }}>Completada</Text>
        </View>
      </View>

      {/* ── CITAS DEL DÍA ── */}
      {selectedDay && (
        <View style={{ gap: 10 }}>
          <Text
            style={{ color: palette.primary, fontWeight: "700", fontSize: 16 }}
          >
            {selectedDay} de {MONTHS[month]}
          </Text>

          {dayBookings.length === 0 && (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 16,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#555" }}>Sin citas este día</Text>
            </View>
          )}

          {dayBookings.map((booking) => {
            const color = STATUS_COLOR[booking.status || "scheduled"] || "#888";
            const isCancellable = ["scheduled", "open", "accepted"].includes(
              booking.status || "",
            );
            const isActive = ["accepted", "on_route", "arrived"].includes(
              booking.status || "",
            );
            const time = booking.scheduled_at
              ? new Date(booking.scheduled_at).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <View
                key={booking.id}
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 2,
                  borderColor: color,
                  gap: 8,
                }}
              >
                {/* Header */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: "#2196F322",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: "#2196F3",
                    }}
                  >
                    <Text
                      style={{
                        color: "#2196F3",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      📅 PROGRAMADO
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: color + "22",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
                      {STATUS_LABEL[booking.status || "scheduled"]}
                    </Text>
                  </View>
                </View>

                <Text style={{ color, fontWeight: "900", fontSize: 18 }}>
                  🕐 {time}
                </Text>
                <Text
                  style={{
                    color: palette.text,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {booking.service_type || "Servicio"}
                </Text>
                <Text style={{ color: "#aaa", fontSize: 13 }}>
                  📍 {booking.address || "Sin dirección"}
                </Text>
                {booking.barber_name && (
                  <Text style={{ color: "#aaa", fontSize: 13 }}>
                    ✂️ {booking.barber_name}
                  </Text>
                )}
                <Text
                  style={{
                    color: palette.primary,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  ${Number(booking.price || 0).toLocaleString("es-CO")} COP
                </Text>

                {/* Ir al servicio si está activo */}
                {isActive && (
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/client/status",
                        params: { id: String(booking.id) },
                      })
                    }
                    style={{
                      backgroundColor: color,
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      Ver servicio en curso →
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Cancelar */}
                {isCancellable && (
                  <TouchableOpacity
                    onPress={() => handleCancel(booking)}
                    disabled={cancelling === booking.id}
                    style={{
                      borderWidth: 1,
                      borderColor: "#dd0000",
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#dd0000", fontSize: 13 }}>
                      {cancelling === booking.id
                        ? t("client.bookings.cancelling")
                        : t("client.bookings.cancel")}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── RESUMEN SI NO HAY DÍA SELECCIONADO ── */}
      {!selectedDay && !loading && (
        <View style={{ gap: 8 }}>
          {bookings.filter((b) =>
            ["scheduled", "open", "accepted", "on_route", "arrived"].includes(
              b.status || "",
            ),
          ).length > 0 ? (
            <View
              style={{
                backgroundColor: "#0d1b2e",
                borderRadius: 10,
                padding: 14,
                borderWidth: 1,
                borderColor: "#2196F3",
              }}
            >
              <Text
                style={{ color: "#2196F3", fontWeight: "700", marginBottom: 8 }}
              >
                📅 Citas este mes
              </Text>
              {bookings
                .filter((b) =>
                  [
                    "scheduled",
                    "open",
                    "accepted",
                    "on_route",
                    "arrived",
                  ].includes(b.status || ""),
                )
                .slice(0, 3)
                .map((b) => (
                  <View
                    key={b.id}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: "#1a2a3a",
                      paddingBottom: 6,
                      marginBottom: 6,
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 13 }}>
                      {b.scheduled_at
                        ? new Date(b.scheduled_at).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}{" "}
                      — {b.service_type}
                    </Text>
                  </View>
                ))}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 20,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#555", textAlign: "center" }}>
                Sin citas programadas este mes
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push("/client/select-professional-type" as any)
                }
                style={{
                  marginTop: 12,
                  backgroundColor: palette.primary,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "700" }}>
                  Agendar cita
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.replace("/client/home")}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>← Volver al inicio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
