// app/barber/schedule.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";

type ScheduledService = {
  id: number;
  service_type?: string;
  address?: string;
  price?: number;
  status?: string;
  scheduled_at?: string;
  payment_method?: string;
  client_name?: string;
  client_phone?: string;
};

type CompletedService = {
  id: number;
  service_type?: string;
  price?: number;
  status?: string;
  completed_at?: string;
  client_name?: string;
};

const STATUS_COLOR: Record<string, string> = {
  open: "#D4AF37",
  accepted: "#2196F3",
  on_route: "#9C27B0",
  arrived: "#FF9800",
  completed: "#4caf50",
  cancelled: "#555",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Publicado",
  accepted: "Confirmado",
  on_route: "En camino",
  arrived: "En lugar",
  completed: "Completado",
  cancelled: "Cancelado",
};

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
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
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am - 8pm

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // lunes
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

export default function BarberSchedule() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduled, setScheduled] = useState<ScheduledService[]>([]);
  const [completed, setCompleted] = useState<CompletedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const today = new Date();

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const from = weekDates[0].toISOString();
      const lastDay = new Date(weekDates[6]);
      lastDay.setHours(23, 59, 59, 999);
      const to = lastDay.toISOString();
      const res = await api.get(`/schedule/professional?from=${from}&to=${to}`);
      setScheduled(res.data.scheduled || []);
      setCompleted(res.data.completed || []);
    } catch {
      setScheduled([]);
      setCompleted([]);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useFocusEffect(
    useCallback(() => {
      loadSchedule();
    }, [loadSchedule]),
  );

  // Servicios para un día específico
  const getServicesForDay = (date: Date) => {
    const dateStr = date.toDateString();
    return scheduled.filter((s) => {
      if (!s.scheduled_at) return false;
      return new Date(s.scheduled_at).toDateString() === dateStr;
    });
  };

  const getCompletedForDay = (date: Date) => {
    const dateStr = date.toDateString();
    return completed.filter((s) => {
      if (!s.completed_at) return false;
      return new Date(s.completed_at).toDateString() === dateStr;
    });
  };

  const hasServices = (date: Date) => {
    return (
      getServicesForDay(date).length > 0 || getCompletedForDay(date).length > 0
    );
  };

  const selectedServices = selectedDay ? getServicesForDay(selectedDay) : [];
  const selectedCompleted = selectedDay ? getCompletedForDay(selectedDay) : [];

  const goToService = (svc: ScheduledService) => {
    if (
      svc.status === "accepted" ||
      svc.status === "on_route" ||
      svc.status === "arrived"
    ) {
      router.push({
        pathname: "/barber/active",
        params: {
          id: String(svc.id),
          service_type: svc.service_type || "",
          address: svc.address || "",
          price: String(svc.price || 0),
          status: svc.status,
        },
      });
    }
  };

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
        📅 Mi Agenda
      </Text>

      {/* ── NAVEGACIÓN SEMANA ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w - 1)}
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

        <Text style={{ color: palette.text, fontWeight: "700", fontSize: 14 }}>
          {weekDates[0].getDate()} {MONTHS[weekDates[0].getMonth()]} —{" "}
          {weekDates[6].getDate()} {MONTHS[weekDates[6].getMonth()]}
        </Text>

        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w + 1)}
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

      {/* ── CALENDARIO SEMANAL ── */}
      <View style={{ flexDirection: "row", gap: 4 }}>
        {weekDates.map((date, i) => {
          const isToday = date.toDateString() === today.toDateString();
          const isSelected =
            selectedDay?.toDateString() === date.toDateString();
          const hasSvc = hasServices(date);
          const dayServices = getServicesForDay(date);
          const hasActive = dayServices.some((s) =>
            ["accepted", "on_route", "arrived"].includes(s.status || ""),
          );

          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDay(isSelected ? null : date)}
              style={{
                flex: 1,
                alignItems: "center",
                padding: 8,
                borderRadius: 10,
                backgroundColor: isSelected
                  ? palette.primary
                  : isToday
                    ? palette.card
                    : "transparent",
                borderWidth: 1,
                borderColor: isSelected
                  ? palette.primary
                  : isToday
                    ? palette.primary + "88"
                    : "#333",
              }}
            >
              <Text
                style={{
                  color: isSelected ? "#000" : "#888",
                  fontSize: 10,
                  marginBottom: 2,
                }}
              >
                {DAYS[i]}
              </Text>
              <Text
                style={{
                  color: isSelected ? "#000" : palette.text,
                  fontWeight: "900",
                  fontSize: 16,
                }}
              >
                {date.getDate()}
              </Text>
              {/* Indicadores */}
              <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
                {hasSvc && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: hasActive ? "#2196F3" : "#4caf50",
                    }}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && (
        <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
      )}

      {/* ── SERVICIOS DEL DÍA SELECCIONADO ── */}
      {selectedDay && !loading && (
        <View style={{ gap: 10 }}>
          <Text
            style={{ color: palette.primary, fontWeight: "700", fontSize: 16 }}
          >
            {DAYS[selectedDay.getDay() === 0 ? 6 : selectedDay.getDay() - 1]}{" "}
            {selectedDay.getDate()} de {MONTHS[selectedDay.getMonth()]}
          </Text>

          {selectedServices.length === 0 && selectedCompleted.length === 0 && (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 16,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#555" }}>Sin servicios este día</Text>
            </View>
          )}

          {/* Servicios programados del día */}
          {selectedServices.map((svc) => {
            const color = STATUS_COLOR[svc.status || "open"] || "#888";
            const isActive = ["accepted", "on_route", "arrived"].includes(
              svc.status || "",
            );
            const time = svc.scheduled_at
              ? new Date(svc.scheduled_at).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <TouchableOpacity
                key={svc.id}
                onPress={() => (isActive ? goToService(svc) : null)}
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 2,
                  borderColor: color,
                  gap: 6,
                }}
              >
                {/* Badge programado */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
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
                      {STATUS_LABEL[svc.status || "open"]}
                    </Text>
                  </View>
                </View>

                <Text style={{ color, fontWeight: "900", fontSize: 16 }}>
                  🕐 {time}
                </Text>
                <Text style={{ color: palette.text, fontWeight: "700" }}>
                  {svc.service_type || "Servicio"}
                </Text>
                <Text style={{ color: "#aaa", fontSize: 13 }}>
                  📍 {svc.address || "Sin dirección"}
                </Text>
                {svc.client_name && (
                  <Text style={{ color: "#aaa", fontSize: 13 }}>
                    👤 {svc.client_name}
                  </Text>
                )}
                <Text style={{ color: palette.primary, fontWeight: "700" }}>
                  ${Number(svc.price || 0).toLocaleString("es-CO")} COP
                </Text>

                {isActive && (
                  <View
                    style={{
                      backgroundColor: color,
                      padding: 8,
                      borderRadius: 8,
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      Ir al servicio →
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Servicios completados del día (trazabilidad) */}
          {selectedCompleted.length > 0 && (
            <>
              <Text style={{ color: "#555", fontSize: 12, marginTop: 8 }}>
                HISTORIAL DEL DÍA
              </Text>
              {selectedCompleted.map((svc) => (
                <View
                  key={svc.id}
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderRadius: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#333",
                    gap: 4,
                    opacity: 0.7,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: "#4caf50",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      ✅ COMPLETADO
                    </Text>
                    <Text style={{ color: "#555", fontSize: 11 }}>
                      {svc.completed_at
                        ? new Date(svc.completed_at).toLocaleTimeString(
                            "es-CO",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : ""}
                    </Text>
                  </View>
                  <Text style={{ color: "#888" }}>
                    {svc.service_type || "Servicio"}
                  </Text>
                  {svc.client_name && (
                    <Text style={{ color: "#666", fontSize: 12 }}>
                      👤 {svc.client_name}
                    </Text>
                  )}
                  <Text style={{ color: "#4caf50", fontSize: 13 }}>
                    ${Number(svc.price || 0).toLocaleString("es-CO")} COP
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* ── RESUMEN SEMANA (cuando no hay día seleccionado) ── */}
      {!selectedDay && !loading && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: "#555", fontSize: 12 }}>
            Toca un día para ver los servicios
          </Text>
          {scheduled.length > 0 && (
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
                📅 Esta semana — {scheduled.length} servicio
                {scheduled.length !== 1 ? "s" : ""} programado
                {scheduled.length !== 1 ? "s" : ""}
              </Text>
              {scheduled.slice(0, 3).map((svc) => (
                <View
                  key={svc.id}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#1a2a3a",
                    paddingBottom: 6,
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: palette.text, fontSize: 13 }}>
                    {svc.scheduled_at
                      ? new Date(svc.scheduled_at).toLocaleDateString("es-CO", {
                          weekday: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}{" "}
                    — {svc.service_type}
                  </Text>
                </View>
              ))}
              {scheduled.length > 3 && (
                <Text style={{ color: "#555", fontSize: 12 }}>
                  +{scheduled.length - 3} más...
                </Text>
              )}
            </View>
          )}
          {scheduled.length === 0 && (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 20,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#555", textAlign: "center" }}>
                Sin servicios programados esta semana
              </Text>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        onPress={() => router.replace("/barber/home")}
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
