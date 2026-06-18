// app/recharge.tsx
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../api";

const AMOUNTS = [10000, 20000, 50000, 100000, 200000];
const NEQUI_INFO = {
  numero: "3042415204",
  titular: "John Arenas",
  redes: "Nequi · Bancolombia · Daviplata · Llaves",
};

const MAX_B64 = 800 * 1024;

async function pickReceiptImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Permiso requerido",
      "Activa el acceso a la galería en Configuración",
    );
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.5,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const b64 = result.assets[0].base64!;
  if (b64.length > MAX_B64) {
    Alert.alert("Imagen muy grande", "Máximo 600KB. Reduce la resolución.");
    return null;
  }
  return `data:image/jpeg;base64,${b64}`;
}

async function takeReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso requerido", "Activa la cámara en Configuración");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.5,
    base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const b64 = result.assets[0].base64!;
  if (b64.length > MAX_B64) {
    Alert.alert("Imagen muy grande", "Máximo 600KB.");
    return null;
  }
  return `data:image/jpeg;base64,${b64}`;
}

export default function RechargeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const palette = getPalette(user?.gender);

  const [amount, setAmount] = useState("");
  const [customAmount, setCustomAmount] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"info" | "upload">("info");

  const selectedAmount = Number(amount.replace(/\D/g, ""));

  const handlePickReceipt = () => {
    Alert.alert(
      "Adjuntar comprobante",
      "¿Cómo quieres agregar el comprobante?",
      [
        {
          text: "📷 Tomar foto",
          onPress: async () => {
            const img = await takeReceiptPhoto();
            if (img) setReceipt(img);
          },
        },
        {
          text: "🖼️ Desde galería",
          onPress: async () => {
            const img = await pickReceiptImage();
            if (img) setReceipt(img);
          },
        },
        { text: "Cancelar", style: "cancel" },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!selectedAmount || selectedAmount < 5000) {
      Alert.alert("Monto inválido", "El monto mínimo de recarga es $5.000 COP");
      return;
    }
    if (!receipt) {
      Alert.alert(
        "Comprobante requerido",
        "Debes adjuntar el comprobante de pago",
      );
      return;
    }
    setLoading(true);
    try {
      await api.post("/payments/recharge-request", {
        amount: selectedAmount,
        receipt: receipt,
        notes: notes.trim() || null,
      });
      Alert.alert(
        "✅ Solicitud enviada",
        `Tu solicitud de recarga por $${selectedAmount.toLocaleString("es-CO")} COP fue enviada.\n\nEl administrador aprobará tu saldo en las próximas horas.`,
        [{ text: "Entendido", onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.error || "No se pudo enviar la solicitud",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        backgroundColor: palette.background,
        gap: 16,
        paddingBottom: 40,
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
        💰 Recargar saldo
      </Text>
      <Text style={{ color: "#888", fontSize: 13, lineHeight: 20 }}>
        Recarga tu saldo para poder recibir servicios. La comisión del 15% se
        descuenta automáticamente al finalizar cada servicio.
      </Text>

      {/* ── PASO 1: INFO DE PAGO ── */}
      <View
        style={{
          backgroundColor: "#0d1520",
          borderRadius: 14,
          padding: 18,
          borderWidth: 2,
          borderColor: palette.primary,
          gap: 10,
        }}
      >
        <Text
          style={{ color: palette.primary, fontWeight: "900", fontSize: 16 }}
        >
          📱 Datos para transferencia
        </Text>
        <View style={{ gap: 6 }}>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: "#888", fontSize: 13 }}>Número:</Text>
            <Text
              style={{
                color: palette.text,
                fontWeight: "900",
                fontSize: 18,
                letterSpacing: 2,
              }}
            >
              {NEQUI_INFO.numero}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: "#888", fontSize: 13 }}>Titular:</Text>
            <Text style={{ color: palette.text, fontWeight: "700" }}>
              {NEQUI_INFO.titular}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            <Text style={{ color: "#888", fontSize: 13 }}>Redes:</Text>
            <Text style={{ color: "#4caf50", fontWeight: "700", fontSize: 13 }}>
              {NEQUI_INFO.redes}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: "#162030",
            borderRadius: 8,
            padding: 10,
            marginTop: 4,
          }}
        >
          <Text
            style={{
              color: "#D4AF37",
              fontSize: 12,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            ⚠️ Realiza la transferencia primero, luego adjunta el comprobante
            aquí para que el administrador apruebe tu recarga.
          </Text>
        </View>
      </View>

      {/* ── SELECCIONAR MONTO ── */}
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        1. Selecciona el monto a recargar
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {AMOUNTS.map((amt) => (
          <TouchableOpacity
            key={amt}
            onPress={() => {
              setAmount(String(amt));
              setCustomAmount(false);
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: selectedAmount === amt ? palette.primary : "#333",
              backgroundColor:
                selectedAmount === amt ? palette.primary + "22" : "#141414",
            }}
          >
            <Text
              style={{
                color: selectedAmount === amt ? palette.primary : "#888",
                fontWeight: "700",
              }}
            >
              ${amt.toLocaleString("es-CO")}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => {
            setCustomAmount(true);
            setAmount("");
          }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: customAmount ? palette.primary : "#333",
            backgroundColor: customAmount ? palette.primary + "22" : "#141414",
          }}
        >
          <Text
            style={{
              color: customAmount ? palette.primary : "#888",
              fontWeight: "700",
            }}
          >
            Otro valor
          </Text>
        </TouchableOpacity>
      </View>

      {customAmount && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: palette.primary,
            borderRadius: 8,
            paddingHorizontal: 12,
          }}
        >
          <Text
            style={{
              color: palette.primary,
              fontWeight: "700",
              fontSize: 16,
              marginRight: 4,
            }}
          >
            $
          </Text>
          <TextInput
            placeholder="Ingresa el monto"
            placeholderTextColor="#555"
            keyboardType="numeric"
            value={amount ? Number(amount).toLocaleString("es-CO") : ""}
            onChangeText={(txt) => setAmount(txt.replace(/\D/g, ""))}
            style={{ flex: 1, paddingVertical: 12, color: palette.text }}
          />
          <Text style={{ color: "#888", fontSize: 11 }}>COP</Text>
        </View>
      )}

      {selectedAmount > 0 && (
        <View
          style={{
            backgroundColor: "#0a2a0a",
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: "#4caf50",
          }}
        >
          <Text
            style={{ color: "#4caf50", fontWeight: "700", textAlign: "center" }}
          >
            Transferir exactamente: ${selectedAmount.toLocaleString("es-CO")}{" "}
            COP
          </Text>
          <Text
            style={{
              color: "#888",
              fontSize: 11,
              textAlign: "center",
              marginTop: 4,
            }}
          >
            al número {NEQUI_INFO.numero} — {NEQUI_INFO.titular}
          </Text>
        </View>
      )}

      {/* ── COMPROBANTE ── */}
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        2. Adjunta el comprobante de pago
      </Text>

      {receipt ? (
        <View style={{ gap: 8 }}>
          <Image
            source={{ uri: receipt }}
            style={{
              width: "100%",
              height: 200,
              borderRadius: 12,
              resizeMode: "cover",
            }}
          />
          <TouchableOpacity
            onPress={handlePickReceipt}
            style={{
              borderWidth: 1,
              borderColor: "#555",
              padding: 10,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#aaa", fontSize: 13 }}>
              🔄 Cambiar comprobante
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handlePickReceipt}
          style={{
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: palette.primary + "66",
            borderRadius: 12,
            padding: 32,
            alignItems: "center",
            backgroundColor: "#0d1520",
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 40 }}>📎</Text>
          <Text
            style={{ color: palette.primary, fontWeight: "700", fontSize: 15 }}
          >
            Adjuntar comprobante
          </Text>
          <Text style={{ color: "#555", fontSize: 12, textAlign: "center" }}>
            Foto o captura de pantalla del comprobante de transferencia
          </Text>
        </TouchableOpacity>
      )}

      {/* ── NOTAS OPCIONALES ── */}
      <Text style={{ color: palette.primary, fontWeight: "700" }}>
        3. Referencia o notas (opcional)
      </Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Ej: Transferencia Nequi 10am..."
        placeholderTextColor="#555"
        multiline
        numberOfLines={2}
        style={{
          backgroundColor: "#141414",
          borderWidth: 1,
          borderColor: palette.primary + "44",
          borderRadius: 8,
          padding: 12,
          color: palette.text,
        }}
      />

      {/* ── ENVIAR ── */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={loading || !selectedAmount || !receipt}
        style={{
          backgroundColor:
            !selectedAmount || !receipt ? "#222" : palette.primary,
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text
          style={{
            color: !selectedAmount || !receipt ? "#555" : "#000",
            fontWeight: "900",
            fontSize: 16,
          }}
        >
          {loading ? "Enviando..." : "Enviar solicitud de recarga"}
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
        <Text style={{ color: "#aaa" }}>Cancelar</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
