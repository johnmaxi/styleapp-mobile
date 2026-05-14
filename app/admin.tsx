// app/admin.tsx
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { getPalette } from "@/utils/palette";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Commission = {
  id: number;
  service_id: number;
  total_service: number;
  commission_amt: number;
  professional_amt: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
  created_at: string;
  professional_name?: string;
  professional_role?: string;
};

type ByProfRow = {
  barber_id: number;
  barber_name?: string;
  completed_total?: number;
  commission_total?: number;
  revenue_total?: number;
};

type Totals = {
  total_transacciones: number;
  total_servicios: number;
  saldo_app: number;
  total_profesionales: number;
};

type Professional = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  document_type?: string;
  document_number?: string;
  id_front?: string;
  id_back?: string;
  diploma?: string;
  antecedentes_doc?: string;
  profile_photo?: string;
  created_at: string;
  registration_status: string;
};

type Tab = "registros" | "comisiones";

const ROLE_LABELS: Record<string, string> = {
  barber: "Barbero",
  estilista: "Estilista",
  quiropodologo: "Quiropodólogo",
};

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "💵 Efectivo",
  nequi: "📱 Nequi",
  pse: "🏦 PSE",
  tarjeta: "💳 Tarjeta",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function AdminScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const palette = getPalette("male");

  const [tab, setTab] = useState<Tab>("registros");
  const [loading, setLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [byProf, setByProf] = useState<ByProfRow[]>([]);
  const [history, setHistory] = useState<Commission[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [filteredTotals, setFilteredTotals] = useState<Totals | null>(null);
  const [commError, setCommError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStartStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [selected, setSelected] = useState<Professional | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const [imageModal, setImageModal] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadPending = async () => {
    try {
      const res = await api.get("/admin/pending-professionals");
      setProfessionals(res.data?.data || []);
    } catch {}
  };

  const loadCommissions = async () => {
    try {
      const res = await api.get(
        `/admin/commissions?from=${dateFrom}&to=${dateTo}`,
      );
      setByProf(res.data?.data || []);
      setHistory(res.data?.history || []);
      setTotals(res.data?.totals || null);
      setFilteredTotals(res.data?.filtered_totals || null);
      setCommError(null);
    } catch (err: any) {
      setCommError(err?.response?.data?.error || "Error cargando comisiones");
    }
  };

  useEffect(() => {
    Promise.all([loadPending(), loadCommissions()]).finally(() =>
      setLoading(false),
    );
  }, []);

  useEffect(() => {
    loadCommissions();
  }, [dateFrom, dateTo]);

  const handleApprove = (prof: Professional) => {
    Alert.alert(
      "Aprobar registro",
      `¿Confirmas aprobar la cuenta de ${prof.name}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "✅ Aprobar",
          onPress: async () => {
            setActing(true);
            try {
              await api.post(`/admin/review-professional/${prof.id}`, {
                action: "approve",
              });
              Alert.alert(
                "✅ Aprobado",
                `${prof.name} ya puede recibir servicios.`,
              );
              setSelected(null);
              loadPending();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.response?.data?.error || "No se pudo aprobar",
              );
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) {
      Alert.alert("Error", "Debes indicar el motivo del rechazo");
      return;
    }
    setActing(true);
    try {
      await api.post(`/admin/review-professional/${selected.id}`, {
        action: "reject",
        reason: rejectReason,
      });
      Alert.alert("❌ Rechazado", `Registro de ${selected.name} rechazado.`);
      setRejectModal(false);
      setSelected(null);
      setRejectReason("");
      loadPending();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo rechazar");
    } finally {
      setActing(false);
    }
  };

  const openDoc = (url?: string) => {
    if (!url) {
      Alert.alert("Sin documento", "No se adjuntó este documento");
      return;
    }
    if (url.includes(".pdf") || url.startsWith("data:application/pdf")) {
      Alert.alert(
        "Documento PDF",
        "El documento PDF fue adjuntado correctamente al registro.\n\nPara visualizarlo descárgalo desde el enlace adjunto.",
        [{ text: "OK" }],
      );
      return;
    }
    setImageModal(url);
  };

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Confirmas que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
          } catch {}
          setTimeout(() => router.replace("/login"), 100);
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
        padding: 20,
        gap: 14,
        backgroundColor: palette.background,
        paddingBottom: 40,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: "900" }}>
          Panel Administrador
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            borderWidth: 1,
            borderColor: "#dd0000",
            paddingVertical: 7,
            paddingHorizontal: 14,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#dd0000", fontWeight: "700", fontSize: 13 }}>
            Salir
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["registros", "comisiones"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              backgroundColor: tab === t ? palette.primary : "transparent",
              borderColor: tab === t ? palette.primary : "#555",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tab === t ? "#000" : palette.text,
                fontWeight: "700",
              }}
            >
              {t === "registros"
                ? `Registros${professionals.length > 0 ? ` (${professionals.length})` : ""}`
                : "Comisiones"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══ TAB REGISTROS ══════════════════════════════════════════════ */}
      {tab === "registros" && (
        <>
          {professionals.length === 0 ? (
            <View
              style={{
                backgroundColor: palette.card,
                padding: 24,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#888", fontSize: 16 }}>
                ✅ No hay registros pendientes
              </Text>
            </View>
          ) : (
            professionals.map((prof) => (
              <View
                key={prof.id}
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#D4AF37",
                }}
              >
                {/* Foto y datos */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {prof.profile_photo ? (
                    <TouchableOpacity
                      onPress={() => setImageModal(prof.profile_photo!)}
                    >
                      <Image
                        source={{ uri: prof.profile_photo }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: palette.primary,
                        }}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: "#1a1a2e",
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 2,
                        borderColor: palette.primary,
                      }}
                    >
                      <Text
                        style={{
                          color: palette.primary,
                          fontSize: 22,
                          fontWeight: "700",
                        }}
                      >
                        {prof.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: palette.text,
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {prof.name}
                    </Text>
                    <Text style={{ color: "#D4AF37", fontSize: 13 }}>
                      {ROLE_LABELS[prof.role] || prof.role}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 12 }}>
                      {prof.email}
                    </Text>
                  </View>
                </View>

                {/* Info */}
                <View style={{ gap: 3, marginBottom: 12 }}>
                  {prof.phone && (
                    <Text style={{ color: "#aaa", fontSize: 13 }}>
                      📞 {prof.phone}
                    </Text>
                  )}
                  {prof.document_type && (
                    <Text style={{ color: "#aaa", fontSize: 13 }}>
                      🪪 {prof.document_type}: {prof.document_number}
                    </Text>
                  )}
                  <Text style={{ color: "#666", fontSize: 11 }}>
                    Registrado: {fmtDate(prof.created_at)}
                  </Text>
                </View>

                {/* Documentos */}
                <Text
                  style={{
                    color: palette.primary,
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  Documentos adjuntos:
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {[
                    { label: "📄 Cédula frente", url: prof.id_front },
                    { label: "📄 Cédula reverso", url: prof.id_back },
                    { label: "🎓 Diploma", url: prof.diploma },
                    { label: "🔍 Antecedentes", url: prof.antecedentes_doc },
                  ].map(({ label, url }) => (
                    <TouchableOpacity
                      key={label}
                      onPress={() => openDoc(url)}
                      style={{
                        backgroundColor: url ? "#0d1b2e" : "#1a1a1a",
                        borderWidth: 1,
                        borderColor: url ? palette.primary : "#444",
                        borderRadius: 8,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text
                        style={{
                          color: url ? palette.primary : "#555",
                          fontSize: 12,
                        }}
                      >
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
                      flex: 1,
                      backgroundColor: "#0A7E07",
                      padding: 12,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "900" }}>
                      ✅ Aprobar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelected(prof);
                      setRejectModal(true);
                    }}
                    disabled={acting}
                    style={{
                      flex: 1,
                      backgroundColor: "#2a0a0a",
                      borderWidth: 1,
                      borderColor: "#dd0000",
                      padding: 12,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#dd0000", fontWeight: "900" }}>
                      ❌ Rechazar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </>
      )}

      {/* ══ TAB COMISIONES ════════════════════════════════════════════ */}
      {tab === "comisiones" && (
        <>
          {/* Saldo total */}
          {totals && (
            <View
              style={{
                backgroundColor: "#0a2a0a",
                borderWidth: 2,
                borderColor: "#4caf50",
                borderRadius: 14,
                padding: 16,
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: "#4caf50",
                  fontWeight: "900",
                  fontSize: 13,
                  letterSpacing: 1,
                }}
              >
                💰 SALDO TOTAL DE LA APP
              </Text>
              <Text
                style={{ color: "#22C55E", fontWeight: "900", fontSize: 32 }}
              >
                ${Number(totals.saldo_app).toLocaleString("es-CO")}
                <Text style={{ fontSize: 14, fontWeight: "400" }}> COP</Text>
              </Text>
              <Text style={{ color: "#888", fontSize: 12 }}>
                {totals.total_transacciones} transacciones • Total servicios: $
                {Number(totals.total_servicios).toLocaleString("es-CO")} COP
              </Text>
            </View>
          )}

          {/* Filtro fechas */}
          <View
            style={{
              backgroundColor: palette.card,
              borderRadius: 12,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              🗓 Filtrar por fechas
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>
                  Desde
                </Text>
                <TextInput
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#555"
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: palette.primary + "55",
                    borderRadius: 8,
                    padding: 10,
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>
                  Hasta
                </Text>
                <TextInput
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#555"
                  style={{
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: palette.primary + "55",
                    borderRadius: 8,
                    padding: 10,
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { label: "Hoy", from: todayStr(), to: todayStr() },
                { label: "Este mes", from: monthStartStr(), to: todayStr() },
                { label: "Todo", from: "2024-01-01", to: todayStr() },
              ].map(({ label, from, to }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    setDateFrom(from);
                    setDateTo(to);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: "#1a1a1a",
                    borderWidth: 1,
                    borderColor: "#555",
                    borderRadius: 8,
                    padding: 8,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#aaa", fontSize: 12 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Totales período */}
          {filteredTotals && (
            <View
              style={{
                backgroundColor: palette.card,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: palette.primary + "55",
              }}
            >
              <Text
                style={{
                  color: palette.primary,
                  fontWeight: "700",
                  marginBottom: 8,
                }}
              >
                Período: {dateFrom} → {dateTo}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  {
                    label: "Transacciones",
                    value: String(filteredTotals.total_transacciones),
                  },
                  {
                    label: "Total servicios",
                    value: `$${Number(filteredTotals.total_servicios).toLocaleString("es-CO")}`,
                  },
                  {
                    label: "Comisiones (app)",
                    value: `$${Number(filteredTotals.saldo_app).toLocaleString("es-CO")}`,
                  },
                  {
                    label: "Pagado profesionales",
                    value: `$${Number(filteredTotals.total_profesionales).toLocaleString("es-CO")}`,
                  },
                ].map(({ label, value }) => (
                  <View
                    key={label}
                    style={{
                      backgroundColor: "#1a1a1a",
                      borderRadius: 10,
                      padding: 12,
                      minWidth: "45%",
                      flex: 1,
                    }}
                  >
                    <Text style={{ color: "#888", fontSize: 11 }}>{label}</Text>
                    <Text
                      style={{
                        color: palette.primary,
                        fontWeight: "700",
                        fontSize: 16,
                      }}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Por profesional */}
          {commError && (
            <View
              style={{
                backgroundColor: "#1a1100",
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#D4AF37",
              }}
            >
              <Text style={{ color: "#D4AF37" }}>{commError}</Text>
            </View>
          )}

          {byProf.length > 0 && (
            <>
              <Text style={{ color: palette.text, fontWeight: "700" }}>
                Por profesional
              </Text>
              {byProf.map((row) => (
                <View
                  key={row.barber_id}
                  style={{
                    borderWidth: 1,
                    borderColor: "#333",
                    borderRadius: 10,
                    padding: 12,
                    backgroundColor: palette.card,
                  }}
                >
                  <Text style={{ color: palette.text, fontWeight: "700" }}>
                    {row.barber_name || `#${row.barber_id}`}
                  </Text>
                  <Text style={{ color: "#aaa", fontSize: 12 }}>
                    Servicios: {row.completed_total || 0}
                  </Text>
                  <Text style={{ color: palette.primary, fontWeight: "700" }}>
                    Comisión app: $
                    {Number(row.commission_total || 0).toLocaleString("es-CO")}
                  </Text>
                  <Text style={{ color: "#888", fontSize: 12 }}>
                    Pagado al profesional: $
                    {Number(row.revenue_total || 0).toLocaleString("es-CO")}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* Histórico detallado */}
          <TouchableOpacity
            onPress={() => setShowHistory(!showHistory)}
            style={{
              backgroundColor: "#0d1b2e",
              borderWidth: 1,
              borderColor: palette.primary,
              borderRadius: 10,
              padding: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: palette.primary, fontWeight: "700" }}>
              {showHistory
                ? "▲ Ocultar histórico"
                : `▼ Ver histórico detallado (${history.length})`}
            </Text>
          </TouchableOpacity>

          {showHistory &&
            history.map((c) => (
              <View
                key={c.id}
                style={{
                  backgroundColor: palette.card,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#333",
                  gap: 3,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#aaa", fontSize: 11 }}>
                    Servicio #{c.service_id}
                  </Text>
                  <Text style={{ color: "#666", fontSize: 11 }}>
                    {fmtDate(c.created_at)}
                  </Text>
                </View>
                <Text style={{ color: palette.text, fontWeight: "700" }}>
                  {c.professional_name || "—"}
                  <Text
                    style={{ color: "#888", fontWeight: "400", fontSize: 12 }}
                  >
                    {" "}
                    (
                    {ROLE_LABELS[c.professional_role || ""] ||
                      c.professional_role}
                    )
                  </Text>
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: "#aaa", fontSize: 12 }}>
                    {PAYMENT_LABELS[c.payment_method] || c.payment_method}
                  </Text>
                  <Text style={{ color: palette.primary, fontWeight: "700" }}>
                    Total: ${Number(c.total_service).toLocaleString("es-CO")}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#4caf50", fontSize: 12 }}>
                    Comisión: $
                    {Number(c.commission_amt).toLocaleString("es-CO")}
                  </Text>
                  <Text style={{ color: "#888", fontSize: 12 }}>
                    Profesional: $
                    {Number(c.professional_amt).toLocaleString("es-CO")}
                  </Text>
                </View>
              </View>
            ))}
        </>
      )}

      {/* Gestionar Tienda */}
      <TouchableOpacity
        onPress={() => router.push("/admin-store" as any)}
        style={{
          backgroundColor: "#1a0d2e",
          padding: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#9C27B0",
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <Text style={{ color: "#9C27B0", fontWeight: "700" }}>
          🛍️ Gestionar Tienda
        </Text>
      </TouchableOpacity>

      {/* Volver */}
      <TouchableOpacity
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/profile");
        }}
        style={{
          borderWidth: 1,
          borderColor: "#555",
          padding: 12,
          borderRadius: 10,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Text style={{ color: "#aaa" }}>← Volver al perfil</Text>
      </TouchableOpacity>

      {/* Modal rechazar */}
      <Modal visible={rejectModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "#00000099",
          }}
        >
          <View
            style={{
              backgroundColor: "#1a1a1a",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 28,
              gap: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
              Rechazar: {selected?.name}
            </Text>
            <Text style={{ color: "#888", fontSize: 12 }}>
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
                backgroundColor: "#0d0d0d",
                borderWidth: 1,
                borderColor: "#dd0000",
                borderRadius: 10,
                padding: 14,
                color: "#fff",
                fontSize: 14,
                textAlignVertical: "top",
                minHeight: 100,
              }}
            />
            <TouchableOpacity
              onPress={handleReject}
              disabled={acting || !rejectReason.trim()}
              style={{
                backgroundColor:
                  acting || !rejectReason.trim() ? "#333" : "#dd0000",
                padding: 16,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>
                {acting ? "Rechazando..." : "Confirmar rechazo"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRejectModal(false);
                setRejectReason("");
              }}
              style={{ padding: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#666" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal imagen documento */}
      <Modal visible={!!imageModal} transparent animationType="fade">
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#000000ee",
            justifyContent: "center",
            alignItems: "center",
          }}
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
