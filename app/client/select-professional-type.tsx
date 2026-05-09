// app/client/select-professional-type.tsx
// Pantalla 1: Cliente elige tipo de profesional
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const OPTIONS = [
  {
    id: "profesional",
    label: "✂️ Barbería",
    subtitle: "Corte de cabello, barba, afeitado",
    color: "#D4AF37",
  },
  {
    id: "estilista",
    label: "💇 Estilista",
    subtitle: "Tinte, peinado, tratamientos capilares",
    color: "#E91E63",
  },
  {
    id: "quiropodologo",
    label: "🦶 Quiropodólogo",
    subtitle: "Cuidado de pies, uñas, callosidades",
    color: "#2196F3",
  },
];

export default function SelectProfessionalType() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const palette = getPalette(user?.gender);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        flexGrow: 1,
        gap: 16,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: palette.primary,
          marginBottom: 4,
        }}
      >
        ¿Qué servicio requieres?
      </Text>
      <Text style={{ color: "#888", fontSize: 14, marginBottom: 8 }}>
        Selecciona el tipo de profesional que necesitas
      </Text>

      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          onPress={() =>
            router.push({
              pathname: "/client/service-mode" as any,
              params: { proType: opt.id, proLabel: opt.label },
            })
          }
          style={{
            backgroundColor: palette.card,
            borderRadius: 16,
            padding: 20,
            borderWidth: 2,
            borderColor: opt.color,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 40 }}>{opt.label.split(" ")[0]}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: palette.text, fontWeight: "900", fontSize: 18 }}
            >
              {opt.label.split(" ").slice(1).join(" ")}
            </Text>
            <Text style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
              {opt.subtitle}
            </Text>
          </View>
          <Text style={{ color: opt.color, fontSize: 22 }}>→</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#aaa" }}>← Volver</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
