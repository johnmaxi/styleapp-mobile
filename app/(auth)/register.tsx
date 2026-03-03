// app/(auth)/register.tsx
import { showImageOptions } from "@/utils/imageUtils";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";

type Role = "client" | "barber" | "estilista" | "quiropodologo";
type Gender = "male" | "female";
type PaymentMethod = "nequi" | "pse" | "efectivo";

const ROLE_OPTIONS: { id: Role; label: string; subtitle: string }[] = [
  { id: "client", label: "Cliente", subtitle: "Voy a solicitar servicios" },
  { id: "barber", label: "Barbero", subtitle: "Ofreceré mis servicios como Barbero(a)" },
  { id: "estilista", label: "Estilista", subtitle: "Ofreceré mis servicios como Estilista" },
  { id: "quiropodologo", label: "Quiropodólogo", subtitle: "Ofreceré mis servicios como Quiropodologo(a)" },
];

const DOCUMENT_TYPES = ["Cédula de ciudadanía", "Pasaporte", "Cédula Extranjería"];
const CITIES = ["Medellín", "Bogotá", "Cali"];
const NEIGHBORHOODS: Record<string, string[]> = {
  "Medellín": ["Belén las Violetas", "Belén los Alpes", "Belén Rincón", "Rosales", "Laureles", "Poblado"],
  "Bogotá": ["Chapinero", "Usaquén", "Suba", "Kennedy", "Bosa"],
  "Cali": ["El Peñon", "San Fernando", "Granada", "Ciudad Jardín", "El Ingenio"],
};

const isProfessional = (role: Role) => role !== "client";

export default function RegisterScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("client");
  const [gender, setGender] = useState<Gender>("male");
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [secondName, setSecondName] = useState("");
  const [lastName, setLastName] = useState("");
  const [secondLastName, setSecondLastName] = useState("");
  const [docType, setDocType] = useState("Cédula de ciudadanía");
  const [docNumber, setDocNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Medellín");
  const [neighborhood, setNeighborhood] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nequi");
  const [accountNumber, setAccountNumber] = useState("");

  // Fotos — guardadas como base64 comprimido
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [portfolio, setPortfolio] = useState<(string | null)[]>([null, null, null]);
  const [idFront, setIdFront] = useState<string | null>(null);
  const [idBack, setIdBack] = useState<string | null>(null);
  const [diploma, setDiploma] = useState<string | null>(null);

  // Dropdowns
  const [showDocType, setShowDocType] = useState(false);
  const [showCity, setShowCity] = useState(false);
  const [showNeighborhood, setShowNeighborhood] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const accent = gender === "male" ? "#D4AF37" : "#FF69B4";
  const onlyLetters = (v: string) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");

  const updatePortfolio = (index: number, value: string) => {
    setPortfolio((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const validate = (): string | null => {
    if (!firstName.trim()) return "El primer nombre es obligatorio";
    if (!lastName.trim()) return "El primer apellido es obligatorio";
    if (!email.trim()) return "El email es obligatorio";
    if (!password.trim()) return "La contraseña es obligatoria";
    if (!docNumber.trim()) return "El número de documento es obligatorio";
    if (!phone.trim()) return "El celular es obligatorio";
    if (!address.trim()) return "La dirección es obligatoria";
    if (!city) return "Selecciona una ciudad";
    if (!neighborhood) return "Selecciona un barrio";
    if (!accountNumber.trim()) return "Ingresa número de cuenta o Nequi";
    if (!profilePhoto) return "La foto de perfil es obligatoria";
    if (isProfessional(role)) {
      if (portfolio.filter(Boolean).length < 3) return "Debes cargar 3 fotos del portafolio";
      if (!idFront) return "Adjunta la cédula por el frente";
      if (!idBack) return "Adjunta la cédula por el reverso";
      if (role === "quiropodologo" && !diploma) return "El diploma es obligatorio para Quiropodólogo";
    }
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) { Alert.alert("Campos incompletos", error); return; }

    setLoading(true);
    try {
      const fullName = `${firstName} ${secondName} ${lastName} ${secondLastName}`
        .replace(/\s+/g, " ").trim();

      const payload: Record<string, any> = {
        name: fullName,
        username,
        email,
        password,
        phone,
        role,
        gender,
        address: `${address}, ${neighborhood}, ${city}`,
        city,
        neighborhood,
        payment_method: paymentMethod,
        account_number: accountNumber,
        document_type: docType,
        document_number: docNumber,
        profile_photo: profilePhoto,
      };

      // Solo enviar fotos de profesionales si aplica
      if (isProfessional(role)) {
        payload.portfolio = portfolio.filter(Boolean);
        payload.id_front = idFront;
        payload.id_back = idBack;
        payload.diploma = diploma || null;
      } else {
        payload.portfolio = [];
      }

      await api.post("/auth/register", payload);

      await SecureStore.setItemAsync("styleapp_profile_defaults", JSON.stringify({
        address, city, neighborhood, paymentMethod, accountNumber,
      }));

      Alert.alert("¡Registro exitoso!", "Tu cuenta fue creada. Ahora inicia sesión.");
      router.replace("/login");
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message;
      if (status === 413) {
        Alert.alert("Fotos muy pesadas", "Las imágenes son demasiado grandes. Intenta con fotos de menor resolución.");
      } else {
        Alert.alert("Error", msg || "No se pudo registrar el usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  const neighborhoods = NEIGHBORHOODS[city] || [];

  const PhotoBox = ({
    uri, label, onPress,
  }: { uri: string | null; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.photoBox, { borderColor: accent }]}>
      {uri
        ? <Image source={{ uri }} style={styles.photoImg} />
        : <Text style={{ color: "#888", textAlign: "center", fontSize: 12 }}>📷 {label}</Text>
      }
    </TouchableOpacity>
  );

  const DropdownField = ({
    show, items, label, onToggle, onSelect,
  }: { show: boolean; items: string[]; label: string; onToggle: () => void; onSelect: (v: string) => void }) => (
    <>
      <TouchableOpacity onPress={onToggle} style={[styles.dropBtn, { borderColor: accent }]}>
        <Text style={{ color: "#fff", flex: 1 }}>{label}</Text>
        <Text style={{ color: accent }}>▼</Text>
      </TouchableOpacity>
      {show && (
        <View style={[styles.dropList, { borderColor: accent }]}>
          {items.map((item) => (
            <TouchableOpacity key={item} onPress={() => onSelect(item)} style={styles.dropItem}>
              <Text style={{ color: "#fff" }}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: "#0d0d0d" }]}>
      <Text style={[styles.logo, { color: accent }]}>✂️ STYLEAPP</Text>
      <Text style={styles.title}>Registro de usuario</Text>

      {/* GÉNERO */}
      <Label text="Género" accent={accent} />
      <View style={styles.row}>
        <Chip text="Masculino" active={gender === "male"} accent={accent} onPress={() => setGender("male")} />
        <Chip text="Femenino" active={gender === "female"} accent={accent} onPress={() => setGender("female")} />
      </View>

      {/* CIUDAD Y BARRIO */}
      <Label text="Ciudad *" accent={accent} />
      <DropdownField
        show={showCity} items={CITIES} label={city}
        onToggle={() => setShowCity(!showCity)}
        onSelect={(v) => { setCity(v); setNeighborhood(""); setShowCity(false); }}
      />

      <Label text="Barrio *" accent={accent} />
      <DropdownField
        show={showNeighborhood} items={neighborhoods}
        label={neighborhood || "Selecciona barrio"}
        onToggle={() => setShowNeighborhood(!showNeighborhood)}
        onSelect={(v) => { setNeighborhood(v); setShowNeighborhood(false); }}
      />

      {/* TIPO DE USUARIO */}
      <Label text="Tipo de usuario" accent={accent} />
      <View style={styles.col}>
        {ROLE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id} onPress={() => setRole(opt.id)}
            style={[styles.roleCard, { borderColor: accent }, role === opt.id && { backgroundColor: accent }]}
          >
            <Text style={[styles.roleLabel, role === opt.id && { color: "#000" }]}>{opt.label}</Text>
            <Text style={[styles.roleSub, role === opt.id && { color: "#222" }]}>{opt.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FOTO DE PERFIL */}
      <Label text="Foto de perfil *" accent={accent} />
      <PhotoBox
        uri={profilePhoto} label="Tomar o adjuntar foto de perfil"
        onPress={() => showImageOptions(setProfilePhoto)}
      />

      {/* DATOS PERSONALES */}
      <Label text="Datos personales" accent={accent} />
      <Field label="Primer nombre *" value={firstName} onChange={(v) => setFirstName(onlyLetters(v))} accent={accent} />
      <Field label="Segundo nombre" value={secondName} onChange={(v) => setSecondName(onlyLetters(v))} accent={accent} />
      <Field label="Primer apellido *" value={lastName} onChange={(v) => setLastName(onlyLetters(v))} accent={accent} />
      <Field label="Segundo apellido" value={secondLastName} onChange={(v) => setSecondLastName(onlyLetters(v))} accent={accent} />

      <Label text="Tipo de documento *" accent={accent} />
      <DropdownField
        show={showDocType} items={DOCUMENT_TYPES} label={docType}
        onToggle={() => setShowDocType(!showDocType)}
        onSelect={(v) => { setDocType(v); setShowDocType(false); }}
      />

      <Field label="Número de documento *" value={docNumber} onChange={(v) => setDocNumber(v.replace(/\D/g, ""))} keyboard="numeric" accent={accent} />
      <Field label="Celular *" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, ""))} keyboard="numeric" accent={accent} />

      {/* ACCESO */}
      <Label text="Acceso a la cuenta" accent={accent} />
      <Field label="Email *" value={email} onChange={setEmail} keyboard="email-address" accent={accent} />
      <Field label="Nombre de usuario" value={username} onChange={setUsername} accent={accent} />
      <Field label="Contraseña *" value={password} onChange={setPassword} secure accent={accent} />

      {/* DIRECCIÓN */}
      <Label text="Dirección *" accent={accent} />
      <Field label="Calle, número y detalles" value={address} onChange={setAddress} accent={accent} />

      {/* MEDIO DE PAGO */}
      <Label text="Medio de pago" accent={accent} />
      <DropdownField
        show={showPayment}
        items={["Nequi", "PSE", "Efectivo"]}
        label={paymentMethod === "nequi" ? "Nequi" : paymentMethod === "pse" ? "PSE" : "Efectivo"}
        onToggle={() => setShowPayment(!showPayment)}
        onSelect={(v) => {
          setPaymentMethod(v === "Nequi" ? "nequi" : v === "PSE" ? "pse" : "efectivo");
          setShowPayment(false);
        }}
      />
      <Field label="Número de cuenta / Nequi *" value={accountNumber} onChange={(v) => setAccountNumber(v.replace(/\D/g, ""))} keyboard="numeric" accent={accent} />

      {/* PROFESIONALES */}
      {isProfessional(role) && (
        <>
          <Label text={`Portafolio (${portfolio.filter(Boolean).length}/3 fotos) *`} accent={accent} />
          <View style={styles.row}>
            {[0, 1, 2].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => showImageOptions((b64) => updatePortfolio(i, b64))}
                style={[styles.portfolioBox, { borderColor: accent }]}
              >
                {portfolio[i]
                  ? <Image source={{ uri: portfolio[i]! }} style={styles.portfolioImg} />
                  : <Text style={{ color: accent, fontSize: 28, textAlign: "center" }}>+</Text>
                }
              </TouchableOpacity>
            ))}
          </View>

          <Label text="Cédula - Frente *" accent={accent} />
          <PhotoBox uri={idFront} label="Adjuntar frente de la cédula" onPress={() => showImageOptions(setIdFront)} />

          <Label text="Cédula - Reverso *" accent={accent} />
          <PhotoBox uri={idBack} label="Adjuntar reverso de la cédula" onPress={() => showImageOptions(setIdBack)} />

          <Label
            text={`Diploma o Certificado ${role === "quiropodologo" ? "* (obligatorio)" : "(opcional)"}`}
            accent={accent}
          />
          <PhotoBox uri={diploma} label="Adjuntar diploma o certificado" onPress={() => showImageOptions(setDiploma)} />
        </>
      )}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]}
        onPress={handleRegister} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? "Creando cuenta..." : "Crear cuenta"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={[styles.link, { color: accent }]}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Label({ text, accent }: { text: string; accent: string }) {
  return <Text style={[styles.label, { color: accent }]}>{text}</Text>;
}

function Chip({ text, active, accent, onPress }: { text: string; active: boolean; accent: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { borderColor: accent }, active && { backgroundColor: accent }]}
    >
      <Text style={[{ color: "#fff", textAlign: "center", fontWeight: "700" }, active && { color: "#000" }]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChange, secure = false, keyboard = "default", accent }: {
  label: string; value: string; onChange: (v: string) => void;
  secure?: boolean; keyboard?: "default" | "numeric" | "email-address"; accent: string;
}) {
  return (
    <TextInput
      placeholder={label} placeholderTextColor="#555"
      secureTextEntry={secure} keyboardType={keyboard}
      style={[styles.input, { borderColor: accent + "55" }]}
      value={value} onChangeText={onChange}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  logo: { fontSize: 32, textAlign: "center", fontWeight: "900", marginBottom: 4 },
  title: { color: "#fff", fontSize: 20, textAlign: "center", marginBottom: 16, fontWeight: "700" },
  label: { marginTop: 14, marginBottom: 6, fontWeight: "700", fontSize: 13 },
  row: { flexDirection: "row", gap: 8 },
  col: { gap: 8 },
  chip: { flex: 1, borderWidth: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#1a1a1a" },
  roleCard: { borderWidth: 1, padding: 12, borderRadius: 10, backgroundColor: "#1a1a1a" },
  roleLabel: { color: "#fff", fontWeight: "700", fontSize: 15 },
  roleSub: { color: "#888", fontSize: 11, marginTop: 2 },
  input: { backgroundColor: "#141414", borderRadius: 8, padding: 13, marginBottom: 8, color: "#fff", borderWidth: 1 },
  btn: { padding: 15, borderRadius: 10, marginTop: 24, marginBottom: 8 },
  btnText: { textAlign: "center", fontWeight: "900", color: "#000", fontSize: 16 },
  link: { textAlign: "center", marginTop: 12, fontWeight: "700" },
  photoBox: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 14, alignItems: "center", justifyContent: "center", marginBottom: 8, minHeight: 90 },
  photoImg: { width: "100%", height: 130, borderRadius: 8 },
  portfolioBox: { flex: 1, borderWidth: 1, borderStyle: "dashed", borderRadius: 8, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  portfolioImg: { width: "100%", height: "100%", borderRadius: 8 },
  dropBtn: { borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: "row", alignItems: "center", marginBottom: 4, backgroundColor: "#141414" },
  dropList: { borderWidth: 1, borderRadius: 8, backgroundColor: "#1a1a1a", marginBottom: 8 },
  dropItem: { padding: 13, borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
});