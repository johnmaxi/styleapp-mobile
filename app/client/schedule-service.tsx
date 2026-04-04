// app/client/schedule-service.tsx
// Pantalla 3: Agendar servicio con fecha y hora
import {
  ProfessionalType,
  SERVICE_CATALOG,
  formatPrice,
} from "@/constants/services";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getAvailableDates() {
  const dates = [];
  const now = new Date();
  for (let i = 0; i <= 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d);
  }
  return dates;
}

const HOURS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = [
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

export default function ScheduleService() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params = useLocalSearchParams<{ proType: string; proLabel: string }>();

  const proType = (params.proType || "profesional") as ProfessionalType;

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const services = useMemo(() => SERVICE_CATALOG[proType] || [], [proType]);
  const availDates = useMemo(() => getAvailableDates(), []);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleContinue = () => {
    if (selectedServices.length === 0) {
      Alert.alert(
        "Selecciona un servicio",
        "Elige al menos un servicio para agendar.",
      );
      return;
    }
    if (!selectedDate) {
      Alert.alert("Selecciona una fecha", "Elige el día para tu cita.");
      return;
    }
    if (!selectedHour) {
      Alert.alert("Selecciona una hora", "Elige la hora para tu cita.");
      return;
    }

    // Construir scheduled_at
    const [hh, mm] = selectedHour.split(":").map(Number);
    const scheduled = new Date(selectedDate);
    scheduled.setHours(hh, mm, 0, 0);

    // Validar mínimo 1 hora desde ahora
    const minTime = new Date();
    minTime.setHours(minTime.getHours() + 1);
    if (scheduled < minTime) {
      Alert.alert(
        "Hora no válida",
        "El servicio debe agendarse con mínimo 1 hora de anticipación. Selecciona una hora posterior.",
      );
      return;
    }

    router.push({
      pathname: "/client/create-service" as any,
      params: {
        proType: proType,
        proLabel: params.proLabel,
        mode: "scheduled",
        scheduled_at: scheduled.toISOString(),
        preset_services: selectedServices.join(","),
        notes,
      },
    });
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        backgroundColor: palette.background,
        paddingBottom: 40,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "900", color: palette.primary }}>
        📅 Agendar servicio
      </Text>
      <Text style={{ color: "#888", fontSize: 13 }}>
        {params.proLabel} · Selecciona servicios, fecha y hora
      </Text>

      {/* Servicios */}
      <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 15 }}>
        ¿Qué servicios necesitas?
      </Text>
      <View style={{ gap: 8 }}>
        {services.map((svc) => {
          const selected = selectedServices.includes(svc.id);
          return (
            <TouchableOpacity
              key={svc.id}
              onPress={() => toggleService(svc.id)}
              style={{
                backgroundColor: selected
                  ? palette.primary + "22"
                  : palette.card,
                borderRadius: 10,
                padding: 14,
                borderWidth: 1,
                borderColor: selected ? palette.primary : "#333",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: selected ? palette.primary : "#555",
                  backgroundColor: selected ? palette.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selected && (
                  <Text
                    style={{ color: "#000", fontSize: 12, fontWeight: "900" }}
                  >
                    ✓
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: "700" }}>
                  {svc.label}
                </Text>
                <Text style={{ color: "#888", fontSize: 12 }}>
                  Desde {formatPrice(svc.minPrice)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Fecha */}
      <Text
        style={{
          color: palette.primary,
          fontWeight: "700",
          fontSize: 15,
          marginTop: 8,
        }}
      >
        ¿Qué día?
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
          {availDates.map((d, i) => {
            const selected = selectedDate?.toDateString() === d.toDateString();
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedDate(d)}
                style={{
                  backgroundColor: selected ? palette.primary : palette.card,
                  borderRadius: 12,
                  padding: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: selected ? palette.primary : "#333",
                  minWidth: 64,
                }}
              >
                <Text
                  style={{ color: selected ? "#000" : "#888", fontSize: 11 }}
                >
                  {DAY_NAMES[d.getDay()]}
                </Text>
                <Text
                  style={{
                    color: selected ? "#000" : palette.text,
                    fontWeight: "900",
                    fontSize: 18,
                  }}
                >
                  {d.getDate()}
                </Text>
                <Text
                  style={{ color: selected ? "#000" : "#888", fontSize: 11 }}
                >
                  {MONTH_NAMES[d.getMonth()]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Hora */}
      <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 15 }}>
        ¿A qué hora?
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {HOURS.map((h) => {
          const sel = selectedHour === h;

          // Verificar si la hora ya pasó o está dentro de la próxima hora
          const [hh] = h.split(":").map(Number);
          const now = new Date();
          const minTime = new Date();
          minTime.setHours(now.getHours() + 1, now.getMinutes(), 0, 0);

          let isPast = false;
          if (selectedDate) {
            const candidate = new Date(selectedDate);
            candidate.setHours(hh, 0, 0, 0);
            isPast = candidate < minTime;
          }

          return (
            <TouchableOpacity
              key={h}
              onPress={() => !isPast && setSelectedHour(h)}
              disabled={isPast}
              style={{
                backgroundColor: sel
                  ? palette.primary
                  : isPast
                    ? "#1a1a1a"
                    : palette.card,
                borderRadius: 8,
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: sel
                  ? palette.primary
                  : isPast
                    ? "#2a2a2a"
                    : "#333",
                opacity: isPast ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  color: sel ? "#000" : isPast ? "#444" : palette.text,
                  fontWeight: sel ? "900" : "400",
                }}
              >
                {h}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Notas */}
      <Text style={{ color: palette.primary, fontWeight: "700", fontSize: 15 }}>
        Notas adicionales (opcional)
      </Text>
      <TextInput
        placeholder="Ej: Entrada por portería norte, piso 3..."
        placeholderTextColor="#555"
        value={notes}
        onChangeText={setNotes}
        multiline
        style={{
          backgroundColor: palette.card,
          borderRadius: 10,
          padding: 14,
          color: palette.text,
          borderWidth: 1,
          borderColor: "#333",
          minHeight: 80,
          textAlignVertical: "top",
        }}
      />

      {/* Resumen */}
      {selectedDate && selectedHour && (
        <View
          style={{
            backgroundColor: "#0d1b2e",
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: "#2196F3",
            gap: 6,
          }}
        >
          <Text style={{ color: "#2196F3", fontWeight: "900" }}>
            📅 Resumen del agendamiento
          </Text>
          <Text style={{ color: palette.text }}>
            {DAY_NAMES[selectedDate.getDay()]} {selectedDate.getDate()} de{" "}
            {MONTH_NAMES[selectedDate.getMonth()]} a las {selectedHour}
          </Text>
          {selectedServices.length > 0 && (
            <Text style={{ color: "#888", fontSize: 13 }}>
              Servicios:{" "}
              {selectedServices
                .map((id) => services.find((s) => s.id === id)?.label)
                .filter(Boolean)
                .join(", ")}
            </Text>
          )}
          <Text style={{ color: "#888", fontSize: 12 }}>
            ⏰ Recibirás recordatorio 1 hora antes
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleContinue}
        style={{
          backgroundColor: palette.primary,
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
          Continuar →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#aaa" }}>← Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
