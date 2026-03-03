// app/rating.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RatingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);
  const params = useLocalSearchParams<{
    service_request_id?: string;
    rated_id?: string;
    rated_name?: string;
    redirect?: string;
  }>();

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const scoreLabels: Record<number, string> = {
    1: "Muy malo",
    2: "Malo",
    3: "Regular",
    4: "Bueno",
    5: "Excelente",
  };

  const getRedirect = () => {
    if (params.redirect) return params.redirect;
    return user?.role === "client" ? "/client/home" : "/barber/home";
  };

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert("Calificacion requerida", "Selecciona de 1 a 5 estrellas");
      return;
    }
    const serviceRequestId = Number(params.service_request_id);
    const ratedId = Number(params.rated_id);

    if (!serviceRequestId || serviceRequestId <= 0) {
      Alert.alert("Error", "ID de solicitud invalido.");
      return;
    }
    if (!ratedId || ratedId <= 0) {
      Alert.alert("Error", "No se identifico al usuario. La calificacion se omitira.", [
        { text: "OK", onPress: () => router.replace(getRedirect() as any) },
      ]);
      return;
    }

    setLoading(true);
    try {
      await api.post("/ratings", {
        service_request_id: serviceRequestId,
        rated_id: ratedId,
        score,
        comment: comment.trim() || null,
      });
      Alert.alert("Gracias", "Tu calificacion fue enviada correctamente.", [
        { text: "OK", onPress: () => router.replace(getRedirect() as any) },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo enviar la calificacion");
    } finally {
      setLoading(false);
    }
  };

  const ratedName = params.rated_name || "el usuario";
  const isClient = user?.role === "client";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
        padding: 28,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "900",
          color: palette.text,
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Calificar servicio
      </Text>

      <Text
        style={{
          color: "#aaa",
          textAlign: "center",
          marginBottom: 32,
          fontSize: 15,
        }}
      >
        {isClient
          ? `Como fue el servicio de ${ratedName}?`
          : `Como fue tu experiencia con ${ratedName}?`}
      </Text>

      {/* ESTRELLAS - usando caracteres simples para evitar problemas de encoding */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setScore(star)}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: star <= score ? palette.primary : "#222",
                borderWidth: 2,
                borderColor: star <= score ? palette.primary : "#444",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "900",
                  color: star <= score ? "#000" : "#666",
                }}
              >
                {star}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {score > 0 && (
        <Text
          style={{
            color: palette.primary,
            textAlign: "center",
            fontWeight: "700",
            marginBottom: 20,
            fontSize: 18,
          }}
        >
          {scoreLabels[score]} ({score}/5)
        </Text>
      )}

      <TextInput
        placeholder="Comentario opcional..."
        placeholderTextColor="#555"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={3}
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 10,
          padding: 14,
          color: "#fff",
          borderWidth: 1,
          borderColor: palette.primary + "55",
          marginBottom: 20,
          textAlignVertical: "top",
          minHeight: 80,
        }}
      />

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || score === 0}
        style={{
          backgroundColor: palette.primary,
          padding: 16,
          borderRadius: 10,
          opacity: loading || score === 0 ? 0.5 : 1,
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
          {loading ? "Enviando..." : "Enviar calificacion"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace(getRedirect() as any)}
        style={{ alignItems: "center", padding: 12 }}
      >
        <Text style={{ color: "#666" }}>Omitir calificacion</Text>
      </TouchableOpacity>
    </View>
  );
}