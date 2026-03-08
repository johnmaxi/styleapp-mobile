// app/client/haircut-ai.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ── Tipos ──────────────────────────────────────────────────────────────────
type HaircutPick = {
  id: string;
  name: string;
  score: number;
  reason: string;
  tips: string;
};

type HaircutAnalysis = {
  face_shape: string;
  hair_type: string;
  top_picks: HaircutPick[];
  avoid: string[];
  general_advice: string;
};

// ── Colores por score ──────────────────────────────────────────────────────
const scoreColor = (score: number) => {
  if (score >= 90) return "#4caf50";
  if (score >= 75) return "#D4AF37";
  return "#888";
};

const scorLabel = (score: number) => {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Muy bueno";
  if (score >= 60) return "Bueno";
  return "Moderado";
};

// ── Emojis por forma de rostro ─────────────────────────────────────────────
const FACE_EMOJI: Record<string, string> = {
  oval: "🥚",
  redondo: "⭕",
  cuadrado: "⬜",
  rectangular: "📱",
  corazón: "💛",
  diamante: "💎",
  triangular: "🔺",
};

export default function HaircutAI() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<HaircutAnalysis | null>(null);
  const [selectedPick, setSelectedPick] = useState<number>(0);

  // ── Elegir foto de galería ────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 || null);
      const ext = asset.uri.split(".").pop()?.toLowerCase();
      setMediaType(ext === "png" ? "image/png" : "image/jpeg");
      setAnalysis(null);
    }
  };

  // ── Tomar foto con cámara ────────────────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 || null);
      setMediaType("image/jpeg");
      setAnalysis(null);
    }
  };

  // ── Analizar con IA ───────────────────────────────────────────────────────
  const analyze = async () => {
    if (!photoBase64) {
      Alert.alert("Foto requerida", "Primero selecciona o toma una foto.");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await api.post("/ai/haircut-analysis", {
        image_base64: photoBase64,
        media_type: mediaType,
      });
      if (res.data?.ok && res.data?.data) {
        setAnalysis(res.data.data);
        setSelectedPick(0);
      } else {
        Alert.alert("Error", res.data?.error || "No se pudo analizar la foto");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Error al conectar con el servicio de IA";
      Alert.alert("Error", msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAll = () => {
    setPhotoUri(null);
    setPhotoBase64(null);
    setAnalysis(null);
    setSelectedPick(0);
  };

  const currentPick = analysis?.top_picks?.[selectedPick];

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: palette.background,
        paddingBottom: 48,
      }}
    >
      {/* ── HEADER ── */}
      <View
        style={{
          padding: 20,
          paddingTop: 24,
          borderBottomWidth: 1,
          borderBottomColor: "#222",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginBottom: 12 }}
        >
          <Text style={{ color: palette.primary, fontSize: 14 }}>← Volver</Text>
        </TouchableOpacity>
        <Text
          style={{ fontSize: 24, fontWeight: "900", color: palette.primary }}
        >
          ✂️ IA para tu corte
        </Text>
        <Text style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
          Sube una foto y descubre qué cortes te favorecen según tu rostro
        </Text>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        {/* ── FOTO ── */}
        <View
          style={{
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: photoUri ? palette.primary : "#333",
            backgroundColor: "#111",
            minHeight: 280,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={{ width: "100%", height: 320 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ alignItems: "center", gap: 12, padding: 40 }}>
              <Text style={{ fontSize: 64 }}>🤳</Text>
              <Text
                style={{ color: "#555", textAlign: "center", fontSize: 14 }}
              >
                Toma o selecciona una foto{"\n"}de frente, con buena luz
              </Text>
            </View>
          )}
        </View>

        {/* ── BOTONES FOTO ── */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={takePhoto}
            disabled={analyzing}
            style={{
              flex: 1,
              backgroundColor: "#1a1a1a",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              📷 Cámara
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickFromGallery}
            disabled={analyzing}
            style={{
              flex: 1,
              backgroundColor: "#1a1a1a",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: palette.primary,
              alignItems: "center",
            }}
          >
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              🖼️ Galería
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── TIPS DE FOTO ── */}
        {!photoUri && (
          <View
            style={{
              backgroundColor: "#111",
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: "#2a2a2a",
            }}
          >
            <Text
              style={{ color: "#D4AF37", fontWeight: "700", marginBottom: 8 }}
            >
              💡 Para mejores resultados:
            </Text>
            {[
              "Foto de frente, mirando a la cámara",
              "Buena iluminación, sin sombras en el rostro",
              "Sin gafas de sol o accesorios que tapen el rostro",
              "Cabello natural, sin gorros ni sombreros",
            ].map((tip, i) => (
              <Text
                key={i}
                style={{ color: "#888", fontSize: 12, marginBottom: 4 }}
              >
                ✓ {tip}
              </Text>
            ))}
          </View>
        )}

        {/* ── BOTÓN ANALIZAR ── */}
        {photoUri && !analysis && (
          <TouchableOpacity
            onPress={analyze}
            disabled={analyzing}
            style={{
              backgroundColor: analyzing ? "#333" : palette.primary,
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            {analyzing ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <ActivityIndicator color="#fff" size="small" />
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                >
                  Analizando con IA...
                </Text>
              </View>
            ) : (
              <Text style={{ color: "#000", fontWeight: "900", fontSize: 16 }}>
                🤖 Analizar mi rostro
              </Text>
            )}
          </TouchableOpacity>
        )}

        {analyzing && (
          <View
            style={{
              backgroundColor: "#0d1a0d",
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: "#1a3a1a",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{ color: "#4caf50", fontSize: 13, textAlign: "center" }}
            >
              Claude está analizando la forma de tu rostro y tipo de cabello...
            </Text>
            <Text style={{ color: "#555", fontSize: 11, textAlign: "center" }}>
              Esto puede tomar 10-20 segundos
            </Text>
          </View>
        )}

        {/* ══════════════════════════════════════════════════
            RESULTADOS DEL ANÁLISIS
        ══════════════════════════════════════════════════ */}
        {analysis && (
          <View style={{ gap: 16 }}>
            {/* ── Datos del rostro ── */}
            <View
              style={{
                backgroundColor: "#0d1520",
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: "#1a3a5a",
              }}
            >
              <Text
                style={{
                  color: "#4a90e2",
                  fontWeight: "900",
                  fontSize: 16,
                  marginBottom: 12,
                }}
              >
                🔍 Análisis de tu rostro
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#111",
                    borderRadius: 10,
                    padding: 12,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>
                    {FACE_EMOJI[analysis.face_shape?.toLowerCase()] || "👤"}
                  </Text>
                  <Text style={{ color: "#aaa", fontSize: 11 }}>
                    Forma del rostro
                  </Text>
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    {analysis.face_shape}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "#111",
                    borderRadius: 10,
                    padding: 12,
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>💇</Text>
                  <Text style={{ color: "#aaa", fontSize: 11 }}>
                    Tipo de cabello
                  </Text>
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "700",
                      textAlign: "center",
                      fontSize: 12,
                    }}
                  >
                    {analysis.hair_type}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  color: "#ccc",
                  fontSize: 13,
                  marginTop: 12,
                  lineHeight: 20,
                }}
              >
                {analysis.general_advice}
              </Text>
            </View>

            {/* ── Top picks tabs ── */}
            <Text
              style={{
                color: palette.primary,
                fontWeight: "900",
                fontSize: 17,
              }}
            >
              ✂️ Cortes recomendados para ti
            </Text>

            {/* Selector de corte */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {analysis.top_picks.map((pick, i) => (
                  <TouchableOpacity
                    key={pick.id}
                    onPress={() => setSelectedPick(i)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor:
                        selectedPick === i ? scoreColor(pick.score) : "#333",
                      backgroundColor:
                        selectedPick === i
                          ? scoreColor(pick.score) + "22"
                          : "#1a1a1a",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          selectedPick === i ? scoreColor(pick.score) : "#888",
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      #{i + 1} {pick.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Detalle del corte seleccionado */}
            {currentPick && (
              <View
                style={{
                  backgroundColor: "#111",
                  borderRadius: 14,
                  padding: 18,
                  borderWidth: 2,
                  borderColor: scoreColor(currentPick.score) + "66",
                  gap: 12,
                }}
              >
                {/* Score */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={{
                      color: palette.text,
                      fontWeight: "900",
                      fontSize: 20,
                    }}
                  >
                    {currentPick.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: scoreColor(currentPick.score) + "22",
                      borderRadius: 20,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: scoreColor(currentPick.score),
                    }}
                  >
                    <Text
                      style={{
                        color: scoreColor(currentPick.score),
                        fontWeight: "900",
                      }}
                    >
                      {currentPick.score}% · {scorLabel(currentPick.score)}
                    </Text>
                  </View>
                </View>

                {/* Barra de score */}
                <View
                  style={{
                    height: 6,
                    backgroundColor: "#2a2a2a",
                    borderRadius: 3,
                  }}
                >
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      width: `${currentPick.score}%` as any,
                      backgroundColor: scoreColor(currentPick.score),
                    }}
                  />
                </View>

                {/* Razón */}
                <View
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderRadius: 10,
                    padding: 12,
                    borderLeftWidth: 3,
                    borderLeftColor: scoreColor(currentPick.score),
                  }}
                >
                  <Text
                    style={{
                      color: "#D4AF37",
                      fontWeight: "700",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    ¿Por qué te favorece?
                  </Text>
                  <Text style={{ color: "#ccc", fontSize: 14, lineHeight: 22 }}>
                    {currentPick.reason}
                  </Text>
                </View>

                {/* Tips */}
                <View
                  style={{
                    backgroundColor: "#0a1a0a",
                    borderRadius: 10,
                    padding: 12,
                    borderLeftWidth: 3,
                    borderLeftColor: "#4caf50",
                  }}
                >
                  <Text
                    style={{
                      color: "#4caf50",
                      fontWeight: "700",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    💡 Consejo de mantenimiento
                  </Text>
                  <Text style={{ color: "#ccc", fontSize: 14, lineHeight: 22 }}>
                    {currentPick.tips}
                  </Text>
                </View>

                {/* CTA: solicitar servicio */}
                <TouchableOpacity
                  onPress={() => router.push("/client/create-service")}
                  style={{
                    backgroundColor: palette.primary,
                    padding: 14,
                    borderRadius: 10,
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <Text
                    style={{ color: "#000", fontWeight: "900", fontSize: 15 }}
                  >
                    ✂️ Solicitar este corte ahora
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Cortes a evitar */}
            {analysis.avoid?.length > 0 && (
              <View
                style={{
                  backgroundColor: "#1a0a0a",
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#3a1a1a",
                }}
              >
                <Text
                  style={{
                    color: "#dd4444",
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  ⚠️ Cortes que no te favorecen
                </Text>
                {analysis.avoid.map((item, i) => (
                  <Text
                    key={i}
                    style={{ color: "#888", fontSize: 13, marginBottom: 4 }}
                  >
                    • {item}
                  </Text>
                ))}
              </View>
            )}

            {/* Nueva foto */}
            <TouchableOpacity
              onPress={resetAll}
              style={{
                borderWidth: 1,
                borderColor: "#444",
                padding: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#aaa" }}>🔄 Analizar otra foto</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
