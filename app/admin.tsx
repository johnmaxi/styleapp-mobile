// app/admin.tsx
import api from "@/api";
import { getPalette } from "@/utils/palette";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Linking,
  Modal, ScrollView, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";

// ── Tipos ─────────────────────────────────────────────────────────────────
type BarberCommission = {
  barber_id: number;
  barber_name?: string;
  completed_total?: number;
  commission_total?: number;
};

type Professional = {
  id:                number;
  name:              string;
  email:             string;
  role:              string;
  phone?:            string;
  document_type?:    string;
  document_number?:  string;
  id_front?:         string;
  id_back?:          string;
  diploma?:          string;
  antecedentes_doc?: string;
  profile_photo?:    string;
  created_at:        string;
  registration_status: string;
};

const ROLE_LABELS: Record<string, string> = {
  barber:        "Barbero",
  estilista:     "Estilista",
  quiropodologo: "Quiropodologo",
};

type Tab = "registros" | "comisiones";

export default function AdminScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const palette  = getPalette("male");

  const [tab,             setTab]             = useState<Tab>("registros");
  const [loading,         setLoading]         = useState(true);
  const [rows,            setRows]            = useState<BarberCommission[]>([]);
  const [professionals,   setProfessionals]   = useState<Professional[]>([]);
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [selected,        setSelected]        = useState<Professional | null>(null);
  const [rejectModal,     setRejectModal]     = useState(false);
  const [rejectReason,    setRejectReason]    = useState("");
  const [acting,          setActing]          = useState(false);
  const [imageModal,      setImageModal]      = useState<string | null>(null);

  // ── Cargar datos ──────────────────────────────────────────────────────
  const loadPending = async () => {
    try {
      const res = await api.get("/auth/pending-professionals");
      setProfessionals(res.data?.data || []);
    } catch {}
  };

  const loadCommissions = async () => {
    try {
      const res  = await api.get("/admin/commissions");
      const data: BarberCommission[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data : [];
      setRows(data);
    } catch (err: any) {
      setCommissionError(
        err?.response?.data?.error ||
        "Expone GET /admin/commissions para ver el consolidado."
      );
    }
  };

  useEffect(() => {
    Promise.all([loadPending(), loadCommissions()]).finally(() => setLoading(false));
  }, []);

  const totalCommission = useMemo(
    () => rows.reduce((sum, r) => sum + Number(r.commission_total || 0), 0),
    [rows]
  );

  // ── Aprobar ───────────────────────────────────────────────────────────
  const handleApprove = (prof: Professional) => {
    Alert.alert(
      "Aprobar registro",
      `¿Confirmas que deseas aprobar la cuenta de ${prof.name}?\n\nSe le notificará y podrá comenzar a recibir servicios.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "✅ Aprobar",
          onPress: async () => {
            setActing(true);
            try {
              await api.post(`/auth/review-professional/${prof.id}`, { action: "approve" });
              Alert.alert("✅ Aprobado", `La cuenta de ${prof.name} fue activada.`);
              setSelected(null);
              loadPending();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.error || "No se pudo aprobar");
            } finally { setActing(false); }
          },
        },
      ]
    );
  };

  // ── Rechazar ──────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) {
      Alert.alert("Error", "Debes indicar el motivo del rechazo");
      return;
    }
    setActing(true);
    try {
      await api.post(`/auth/review-professional/${selected.id}`, {
        action: "reject",
        reason: rejectReason,
      });
      Alert.alert("❌ Rechazado", `El registro de ${selected.name} fue rechazado.`);
      setRejectModal(false);
      setSelected(null);
      setRejectReason("");
      loadPending();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo rechazar");
    } finally { setActing(false); }
  };

  const openDoc = (url?: string) => {
    if (!url) { Alert.alert("Sin documento", "No se adjuntó este documento"); return; }
    // Si es base64 o URL directa, mostrar en modal de imagen
    if (url.startsWith("data:image") || url.startsWith("http")) {
      setImageModal(url);
    } else {
      Linking.openURL(url).catch(() => Alert.alert("Error", "No se pudo abrir"));
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: palette.background }}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{
      padding: 20, gap: 14,
      backgroundColor: palette.background, paddingBottom: 40,
    }}>
      <Text style={{ color: palette.text, fontSize: 24, fontWeight: "900" }}>
        Panel Administrador
      </Text>

      {/* ── TABS ── */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["registros", "comisiones"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 10,
              borderWidth: 1,
              backgroundColor: tab === t ? palette.primary : "transparent",
              borderColor:     tab === t ? palette.primary : "#555",
              alignItems: "center",
            }}
          >
            <Text style={{
              color: tab === t ? "#000" : palette.text,
              fontWeight: "700",
            }}>
              {t === "registros"
                ? `Registros pendientes${professionals.length > 0 ? ` (${professionals.length})` : ""}`
                : "Comisiones"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══════════════════════════════════════════════════════════════
          TAB 1 — REGISTROS PENDIENTES
      ══════════════════════════════════════════════════════════════ */}
      {tab === "registros" && (
        <>
          {professionals.length === 0 ? (
            <View style={{ backgroundColor: palette.card, padding: 24,
              borderRadius: 12, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 16 }}>
                ✅ No hay registros pendientes
              </Text>
            </View>
          ) : (
            professionals.map((prof) => (
              <View key={prof.id} style={{
                backgroundColor: palette.card, borderRadius: 12,
                padding: 16, borderWidth: 1, borderColor: "#D4AF37",
              }}>
                {/* Header */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  {prof.profile_photo ? (
                    <TouchableOpacity onPress={() => setImageModal(prof.profile_photo!)}>
                      <Image source={{ uri: prof.profile_photo }}
                        style={{ width: 56, height: 56, borderRadius: 28,
                          borderWidth: 2, borderColor: palette.primary }} />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 28,
                      backgroundColor: "#1a1a2e", alignItems: "center",
                      justifyContent: "center", borderWidth: 2, borderColor: palette.primary }}>
                      <Text style={{ color: palette.primary, fontSize: 22, fontWeight: "700" }}>
                        {prof.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: "700", fontSize: 16 }}>
                      {prof.name}
                    </Text>
                    <Text style={{ color: "#D4AF37", fontSize: 13 }}>
                      {ROLE_LABELS[prof.role] || prof.role}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 12 }}>{prof.email}</Text>
                  </View>
                </View>

                {/* Info */}
                <View style={{ gap: 3, marginBottom: 12 }}>
                  {prof.phone && (
                    <Text style={{ color: "#aaa", fontSize: 13 }}>📞 {prof.phone}</Text>
                  )}
                  {prof.document_type && (
                    <Text style={{ color: "#aaa", fontSize: 13 }}>
                      🪪 {prof.document_type}: {prof.document_number}
                    </Text>
                  )}
                  <Text style={{ color: "#666", fontSize: 11 }}>
                    Registrado: {new Date(prof.created_at).toLocaleDateString("es-CO", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </Text>
                </View>

                {/* Documentos */}
                <Text style={{ color: palette.primary, fontWeight: "700", marginBottom: 8 }}>
                  Documentos adjuntos:
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {[
                    { label: "📄 Cédula frente",  url: prof.id_front },
                    { label: "📄 Cédula reverso", url: prof.id_back },
                    { label: "🎓 Diploma/Cert.",  url: prof.diploma },
                    { label: "🔍 Antecedentes",   url: prof.antecedentes_doc },
                  ].map(({ label, url }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => openDoc(url)}
                      style={{
                        backgroundColor: url ? "#0d1b2e" : "#1a1a1a",
                        borderWidth: 1,
                        borderColor:     url ? palette.primary : "#444",
                        borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: url ? palette.primary : "#555", fontSize: 12 }}>
                        {label} {url ? "→ Ver" : "(vacío)"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Acciones */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleApprove(prof)}
                    disabled={acting}
                    style={{
                      flex: 1, backgroundColor: "#0A7E07",
                      padding: 12, borderRadius: 10, alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>✅ Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setSelected(prof); setRejectModal(true); }}
                    disabled={acting}
                    style={{
                      flex: 1, backgroundColor: "#2a0a0a",
                      borderWidth: 1, borderColor: "#dd0000",
                      padding: 12, borderRadius: 10, alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#dd0000", fontWeight: "900" }}>❌ Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          TAB 2 — COMISIONES
      ══════════════════════════════════════════════════════════════ */}
      {tab === "comisiones" && (
        <>
          <Text style={{ color: palette.text }}>Comisión acumulada por profesional</Text>

          {commissionError && (
            <View style={{ backgroundColor: "#1a1100", padding: 12,
              borderRadius: 8, borderWidth: 1, borderColor: "#D4AF37" }}>
              <Text style={{ color: "#D4AF37" }}>{commissionError}</Text>
            </View>
          )}

          {rows.map((row) => (
            <View key={row.barber_id} style={{
              borderWidth: 1, borderColor: "#444",
              borderRadius: 8, padding: 12,
              backgroundColor: palette.card,
            }}>
              <Text style={{ color: palette.text, fontWeight: "700" }}>
                {row.barber_name || `Profesional #${row.barber_id}`}
              </Text>
              <Text style={{ color: "#aaa" }}>
                Finalizados: {row.completed_total || 0}
              </Text>
              <Text style={{ color: palette.primary, fontWeight: "700" }}>
                Comisión: ${Number(row.commission_total || 0).toLocaleString("es-CO")}
              </Text>
            </View>
          ))}

          <View style={{
            backgroundColor: "#111", padding: 14, borderRadius: 8,
            borderWidth: 1, borderColor: palette.primary,
          }}>
            <Text style={{ color: palette.text, fontWeight: "700", fontSize: 16 }}>
              Total comisiones: ${totalCommission.toLocaleString("es-CO")} COP
            </Text>
          </View>
        </>
      )}

      {/* ── Volver ── */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ borderWidth: 1, borderColor: "#555", padding: 12,
          borderRadius: 10, alignItems: "center", marginTop: 8 }}
      >
        <Text style={{ color: "#aaa" }}>Volver</Text>
      </TouchableOpacity>

      {/* ══ Modal: Rechazar con motivo ══════════════════════════════════ */}
      <Modal visible={rejectModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#00000099" }}>
          <View style={{
            backgroundColor: "#1a1a1a", borderTopLeftRadius: 20,
            borderTopRightRadius: 20, padding: 28, gap: 16,
          }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
              Rechazar registro de {selected?.name}
            </Text>
            <Text style={{ color: "#888", fontSize: 13 }}>
              El profesional recibirá una notificación con el motivo.
            </Text>
            <Text style={{ color: "#aaa", fontSize: 12 }}>
              Ejemplos: "Documentos ilegibles", "Foto de cédula borrosa",
              "Antecedentes positivos", "Diploma no válido"
            </Text>
            <TextInput
              placeholder="Escribe el motivo del rechazo..."
              placeholderTextColor="#555"
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              style={{
                backgroundColor: "#0d0d0d", borderWidth: 1,
                borderColor: "#dd0000", borderRadius: 10,
                padding: 14, color: "#fff", fontSize: 14,
                textAlignVertical: "top", minHeight: 100,
              }}
            />
            <TouchableOpacity
              onPress={handleReject}
              disabled={acting || !rejectReason.trim()}
              style={{
                backgroundColor: acting || !rejectReason.trim() ? "#333" : "#dd0000",
                padding: 16, borderRadius: 10, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                {acting ? "Rechazando..." : "Confirmar rechazo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setRejectModal(false); setRejectReason(""); }}
              style={{ padding: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#666" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══ Modal: Ver imagen de documento ══════════════════════════════ */}
      <Modal visible={!!imageModal} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#000000ee",
            justifyContent: "center", alignItems: "center" }}
          onPress={() => setImageModal(null)}
        >
          {imageModal && (
            <Image
              source={{ uri: imageModal }}
              style={{ width: "92%", height: "75%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: "#888", marginTop: 16, fontSize: 13 }}>
            Toca para cerrar
          </Text>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}
