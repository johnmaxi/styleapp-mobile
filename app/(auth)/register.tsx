// app/(auth)/register.tsx
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import {
  Alert, Image, Modal, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import api from "../../api";

type Role          = "client" | "barber" | "estilista" | "quiropodologo";
type Gender        = "male" | "female";
type PaymentMethod = "nequi" | "pse" | "efectivo";

const ROLE_OPTIONS: { id: Role; label: string; subtitle: string }[] = [
  { id: "client",        label: "Cliente",       subtitle: "Voy a solicitar servicios" },
  { id: "barber",        label: "Barbero",        subtitle: "Ofrecere mis servicios como Barbero(a)" },
  { id: "estilista",     label: "Estilista",      subtitle: "Ofrecere mis servicios como Estilista" },
  { id: "quiropodologo", label: "Quiropodologo",  subtitle: "Ofrecere mis servicios como Quiropodologo(a)" },
];

const DOCUMENT_TYPES = ["Cedula de ciudadania", "Pasaporte", "Cedula Extranjeria"];
const CITIES = ["Medellin", "Bogota", "Cali", "Barranquilla", "Bucaramanga", "Pereira", "Manizales"];
const NEIGHBORHOODS: Record<string, string[]> = {
  "Medellin":     ["Belen las Violetas", "Belen los Alpes", "Rosales", "Laureles", "Poblado", "Envigado", "Itagui", "Sabaneta"],
  "Bogota":       ["Chapinero", "Usaquen", "Suba", "Kennedy", "Bosa", "Fontibon", "Engativa"],
  "Cali":         ["El Penon", "San Fernando", "Granada", "Ciudad Jardin", "El Ingenio"],
  "Barranquilla": ["El Prado", "Alto Prado", "Riomar", "Boston", "Buenavista"],
  "Bucaramanga":  ["Cabecera", "Garcia Rovira", "Provenza", "Terrazas"],
  "Pereira":      ["Centro", "Cuba", "Belmonte", "Pinares", "Alamos"],
  "Manizales":    ["Cable", "Chipre", "Palermo", "Aranjuez"],
};

const isProfessional = (role: Role) => role !== "client";

const MAX_IMAGE_B64 = 800 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

async function pickImage(label: string, onDone: (b64: string) => void) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permiso requerido", "Activa el acceso a la galeria en Configuracion");
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true, aspect: [1, 1], quality: 0.35, base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return;
  const b64 = result.assets[0].base64!;
  if (b64.length > MAX_IMAGE_B64) {
    Alert.alert("Imagen muy grande", `Tamano: ~${Math.round(b64.length * 0.75 / 1024)}KB. Maximo: 600KB`);
    return;
  }
  onDone(`data:image/jpeg;base64,${b64}`);
}

async function pickImageOrCamera(label: string, onDone: (b64: string) => void) {
  Alert.alert(label, "Selecciona la fuente", [
    {
      text: "Camara",
      onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permiso requerido", "Activa la camara"); return; }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true, aspect: [1, 1], quality: 0.35, base64: true,
        });
        if (result.canceled || !result.assets?.[0]?.base64) return;
        const b64 = result.assets[0].base64!;
        if (b64.length > MAX_IMAGE_B64) {
          Alert.alert("Imagen muy grande", `~${Math.round(b64.length * 0.75 / 1024)}KB. Max: 600KB`);
          return;
        }
        onDone(`data:image/jpeg;base64,${b64}`);
      },
    },
    { text: "Galeria",  onPress: () => pickImage(label, onDone) },
    { text: "Cancelar", style: "cancel" },
  ]);
}

async function pickDocument(onDone: (b64: string, name: string) => void) {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_DOC_BYTES) {
      Alert.alert("Archivo muy grande", `~${Math.round(asset.size / 1024 / 1024 * 10) / 10}MB. Max: 5MB`);
      return;
    }
    const response = await fetch(asset.uri);
    const blob     = await response.blob();
    const reader   = new FileReader();
    reader.onload  = () => { onDone(reader.result as string, asset.name); };
    reader.readAsDataURL(blob);
  } catch {
    Alert.alert("Error", "No se pudo adjuntar el archivo");
  }
}

function DocAttachment({
  label, uri, fileName, onPickImage, onPickDoc, accent, hint,
}: {
  label: string; uri: string | null; fileName?: string;
  onPickImage: () => void; onPickDoc: () => void;
  accent: string; hint?: string;
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: accent, fontWeight: "700", fontSize: 13, marginBottom: 4 }}>{label}</Text>
      {hint && <Text style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>{hint}</Text>}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={onPickImage}
          style={{ flex: 1, borderWidth: 1, borderColor: accent, borderStyle: "dashed",
            borderRadius: 8, padding: 12, alignItems: "center" }}
        >
          {uri && !uri.startsWith("data:application") ? (
            <Image source={{ uri }} style={{ width: "100%", height: 70, borderRadius: 6 }} resizeMode="cover" />
          ) : (
            <>
              <Text style={{ color: "#888", fontSize: 20 }}>📷</Text>
              <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>Foto</Text>
              <Text style={{ color: "#666", fontSize: 10 }}>JPG/PNG max 600KB</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPickDoc}
          style={{ flex: 1, borderWidth: 1, borderColor: accent, borderStyle: "dashed",
            borderRadius: 8, padding: 12, alignItems: "center", justifyContent: "center" }}
        >
          {uri?.startsWith("data:application") || fileName?.endsWith(".pdf") ? (
            <>
              <Text style={{ color: "#4caf50", fontSize: 20 }}>📄</Text>
              <Text style={{ color: "#4caf50", fontSize: 11, marginTop: 2, textAlign: "center" }} numberOfLines={2}>
                {fileName || "PDF adjunto"}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: "#888", fontSize: 20 }}>📄</Text>
              <Text style={{ color: "#888", fontSize: 11, marginTop: 2 }}>PDF</Text>
              <Text style={{ color: "#666", fontSize: 10 }}>max 5MB</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      {uri && (
        <Text style={{ color: "#4caf50", fontSize: 11, marginTop: 4 }}>
          ✓ Archivo adjunto correctamente
        </Text>
      )}
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const [role,          setRole]          = useState<Role>("client");
  const [gender,        setGender]        = useState<Gender>("male");
  const [loading,       setLoading]       = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [firstName,       setFirstName]       = useState("");
  const [secondName,      setSecondName]      = useState("");
  const [lastName,        setLastName]        = useState("");
  const [secondLastName,  setSecondLastName]  = useState("");
  const [docType,         setDocType]         = useState("Cedula de ciudadania");
  const [docNumber,       setDocNumber]       = useState("");
  const [phone,           setPhone]           = useState("");
  const [email,           setEmail]           = useState("");
  const [username,        setUsername]        = useState("");
  const [password,        setPassword]        = useState("");
  const [address,         setAddress]         = useState("");
  const [city,            setCity]            = useState("Medellin");
  const [neighborhood,    setNeighborhood]    = useState("");
  const [paymentMethod,   setPaymentMethod]   = useState<PaymentMethod>("nequi");
  const [accountNumber,   setAccountNumber]   = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);

  // Fotos y documentos
  const [profilePhoto,  setProfilePhoto]  = useState<string | null>(null);
  const [portfolio,     setPortfolio]     = useState<(string | null)[]>([null, null, null]);
  const [idFront,       setIdFront]       = useState<string | null>(null);
  const [idFrontName,   setIdFrontName]   = useState("");
  const [idBack,        setIdBack]        = useState<string | null>(null);
  const [idBackName,    setIdBackName]    = useState("");
  const [diploma,       setDiploma]       = useState<string | null>(null);
  const [diplomaName,   setDiplomaName]   = useState("");

  // ── CAMBIO 1: Estados para antecedentes ──────────────────────────────
  const [antecedentesDoc,       setAntecedentesDoc]       = useState<string | null>(null);
  const [antecedentesName,      setAntecedentesName]      = useState("");
  const [autorizaAntecedentes,  setAutorizaAntecedentes]  = useState(false);

  // Dropdowns
  const [showDocType,       setShowDocType]       = useState(false);
  const [showCity,          setShowCity]          = useState(false);
  const [showNeighborhood,  setShowNeighborhood]  = useState(false);
  const [showPayment,       setShowPayment]        = useState(false);

  const accent     = gender === "male" ? "#D4AF37" : "#FF69B4";
  const onlyLetters = (v: string) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");

  const updatePortfolio = (index: number, value: string) => {
    setPortfolio((prev) => { const c = [...prev]; c[index] = value; return c; });
  };

  const getLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa la ubicacion en Configuracion del dispositivo");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (rev[0]) {
        const street  = rev[0].street || "";
        const num     = rev[0].streetNumber || "";
        const resolved = `${street} ${num}`.trim();
        if (resolved) setAddress(resolved);
        if (rev[0].city && !city) setCity(rev[0].city.split(",")[0]);
        if (rev[0].district && !neighborhood) setNeighborhood(rev[0].district);
        Alert.alert("Ubicacion detectada", resolved || "Direccion actualizada");
      }
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicacion");
    } finally {
      setGettingLocation(false);
    }
  };

  // ── CAMBIO 2: Validación con autorización de antecedentes ────────────
  const validate = (): string | null => {
    if (!firstName.trim())   return "El primer nombre es obligatorio";
    if (!lastName.trim())    return "El primer apellido es obligatorio";
    if (!email.trim())       return "El email es obligatorio";
    if (!password.trim())    return "La contrasena es obligatoria";
    if (password.length < 6) return "La contrasena debe tener al menos 6 caracteres";
    if (!docNumber.trim())   return "El numero de documento es obligatorio";
    if (!phone.trim())       return "El celular es obligatorio";
    if (!address.trim())     return "La direccion es obligatoria";
    if (!city)               return "Selecciona una ciudad";
    if (!neighborhood)       return "Selecciona un barrio";
    if (!profilePhoto)       return "La foto de perfil es obligatoria";
    if (!acceptedTerms)      return "Debes aceptar los terminos y condiciones";
    if (isProfessional(role)) {
      if (portfolio.filter(Boolean).length < 3) return "Debes cargar 3 fotos del portafolio";
      if (!idFront)              return "Adjunta la cedula por el frente (foto o PDF)";
      if (!idBack)               return "Adjunta la cedula por el reverso (foto o PDF)";
      if (!autorizaAntecedentes) return "Debes autorizar la consulta de antecedentes policiales";
      if (role === "quiropodologo" && !diploma) return "El diploma es obligatorio para Quiropodologo";
    }
    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) { Alert.alert("Campos incompletos", error); return; }
    setLoading(true);
    try {
      const fullName = `${firstName} ${secondName} ${lastName} ${secondLastName}`.replace(/\s+/g, " ").trim();
      const payload: Record<string, any> = {
        name: fullName, username, email, password, phone, role, gender,
        address: `${address}, ${neighborhood}, ${city}`,
        city, neighborhood,
        payment_method: paymentMethod,
        account_number: accountNumber,
        document_type:  docType,
        document_number: docNumber,
        profile_photo:  profilePhoto,
        portfolio: isProfessional(role) ? portfolio.filter(Boolean) : [],
      };

      if (isProfessional(role)) {
        payload.id_front         = idFront;
        payload.id_back          = idBack;
        payload.diploma          = diploma || null;
        // ── CAMBIO 3: Incluir antecedentes en el payload ──────────────
        payload.antecedentes_doc = antecedentesDoc || null;
      }

      await api.post("/auth/register", payload);
      await SecureStore.setItemAsync("styleapp_profile_defaults", JSON.stringify({
        address, city, neighborhood, paymentMethod, accountNumber,
      }));

      if (isProfessional(role)) {
        Alert.alert(
          "Registro exitoso ✅",
          "Tu registro y documentos están en revisión.\n\nEl administrador validará tu identidad, antecedentes y diplomas en las próximas 24 horas.\n\nRecibirás una notificación con el resultado.",
          [{ text: "Entendido", onPress: () => router.replace("/login") }]
        );
      } else {
        Alert.alert("Bienvenido a Style!", "Tu cuenta fue creada exitosamente.", [
          { text: "Iniciar sesion", onPress: () => router.replace("/login") },
        ]);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error || err?.message;
      if (status === 413) {
        Alert.alert("Archivos muy pesados", "Las imagenes son demasiado grandes. Reduce la resolucion e intenta de nuevo.");
      } else {
        Alert.alert("Error", msg || "No se pudo registrar el usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  const neighborhoods = NEIGHBORHOODS[city] || [];

  const PhotoBox = ({ uri, label, onPress }: { uri: string | null; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.photoBox, { borderColor: accent }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoImg} />
      ) : (
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "#888", textAlign: "center", fontSize: 12 }}>📷 {label}</Text>
          <Text style={{ color: "#666", fontSize: 10, marginTop: 4 }}>JPG/PNG • max 600KB</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const DropdownField = ({ show, items, label, onToggle, onSelect }: {
    show: boolean; items: string[]; label: string;
    onToggle: () => void; onSelect: (v: string) => void;
  }) => (
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
      <Text style={[styles.logo, { color: accent }]}>Style</Text>
      <Text style={styles.title}>Registro de usuario</Text>

      {/* GENERO */}
      <Label text="Genero" accent={accent} />
      <View style={styles.row}>
        <Chip text="Masculino" active={gender === "male"}   accent={accent} onPress={() => setGender("male")} />
        <Chip text="Femenino"  active={gender === "female"} accent={accent} onPress={() => setGender("female")} />
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
            <Text style={[styles.roleSub,   role === opt.id && { color: "#222" }]}>{opt.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FOTO DE PERFIL */}
      <Label text="Foto de perfil *" accent={accent} />
      <PhotoBox
        uri={profilePhoto} label="Tomar o adjuntar foto de perfil"
        onPress={() => pickImageOrCamera("Foto de perfil", setProfilePhoto)}
      />

      {/* DATOS PERSONALES */}
      <Label text="Datos personales" accent={accent} />
      <Field label="Primer nombre *"    value={firstName}      onChange={(v) => setFirstName(onlyLetters(v))}      accent={accent} />
      <Field label="Segundo nombre"     value={secondName}     onChange={(v) => setSecondName(onlyLetters(v))}     accent={accent} />
      <Field label="Primer apellido *"  value={lastName}       onChange={(v) => setLastName(onlyLetters(v))}       accent={accent} />
      <Field label="Segundo apellido"   value={secondLastName} onChange={(v) => setSecondLastName(onlyLetters(v))} accent={accent} />

      <Label text="Tipo de documento *" accent={accent} />
      <DropdownField
        show={showDocType} items={DOCUMENT_TYPES} label={docType}
        onToggle={() => setShowDocType(!showDocType)}
        onSelect={(v) => { setDocType(v); setShowDocType(false); }}
      />
      <Field label="Numero de documento *" value={docNumber}     onChange={(v) => setDocNumber(v.replace(/\D/g, ""))}     keyboard="numeric" accent={accent} />
      <Field label="Celular *"             value={phone}         onChange={(v) => setPhone(v.replace(/\D/g, ""))}         keyboard="numeric" accent={accent} />

      {/* ACCESO */}
      <Label text="Acceso a la cuenta" accent={accent} />
      <Field label="Email *"           value={email}    onChange={setEmail}    keyboard="email-address" accent={accent} />
      <Field label="Nombre de usuario" value={username} onChange={setUsername}                          accent={accent} />
      <Field label="Contrasena *"      value={password} onChange={setPassword} secure                   accent={accent} />

      {/* DIRECCION */}
      <Label text="Direccion *" accent={accent} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
        <TextInput
          placeholder="Calle, numero y detalles" placeholderTextColor="#555"
          value={address} onChangeText={setAddress}
          style={[styles.input, { borderColor: accent + "55", flex: 1, marginBottom: 0 }]}
        />
        <TouchableOpacity
          onPress={getLocation} disabled={gettingLocation}
          style={{
            borderWidth: 1, borderColor: accent, borderRadius: 8,
            paddingHorizontal: 12, justifyContent: "center", alignItems: "center",
            backgroundColor: "#141414", opacity: gettingLocation ? 0.6 : 1,
          }}
        >
          <Text style={{ fontSize: 20 }}>📍</Text>
          <Text style={{ color: accent, fontSize: 9 }}>{gettingLocation ? "..." : "GPS"}</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ color: "#666", fontSize: 11, marginBottom: 8 }}>
        Toca el icono 📍 para autocompletar con tu ubicacion actual
      </Text>

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
      <Field label="Numero de cuenta / Nequi" value={accountNumber}
        onChange={(v) => setAccountNumber(v.replace(/\D/g, ""))} keyboard="numeric" accent={accent} />

      {/* ── SECCIÓN PROFESIONALES ── */}
      {isProfessional(role) && (
        <>
          {/* Aviso validación */}
          <View style={{
            backgroundColor: "#1a1a00", borderWidth: 1, borderColor: accent,
            borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 8,
          }}>
            <Text style={{ color: accent, fontWeight: "900", fontSize: 14, marginBottom: 4 }}>
              Validacion de cuenta profesional
            </Text>
            <Text style={{ color: "#ccc", fontSize: 13, lineHeight: 20 }}>
              Al registrarte, tu perfil y documentos seran revisados por nuestro equipo.{"\n"}
              Recibiras una respuesta en las proximas{" "}
              <Text style={{ color: accent, fontWeight: "700" }}>24 horas</Text>.{"\n"}
              Podras iniciar sesion inmediatamente para explorar la app.
            </Text>
          </View>

          {/* Portafolio */}
          <Label text={`Portafolio (${portfolio.filter(Boolean).length}/3 fotos) *`} accent={accent} />
          <Text style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>
            3 fotos de tus trabajos • JPG/PNG • max 600KB cada una
          </Text>
          <View style={styles.row}>
            {[0, 1, 2].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => pickImageOrCamera("Foto de portafolio", (b64) => updatePortfolio(i, b64))}
                style={[styles.portfolioBox, { borderColor: accent }]}
              >
                {portfolio[i]
                  ? <Image source={{ uri: portfolio[i]! }} style={styles.portfolioImg} />
                  : <Text style={{ color: accent, fontSize: 28, textAlign: "center" }}>+</Text>
                }
              </TouchableOpacity>
            ))}
          </View>

          {/* Cédula frente */}
          <DocAttachment
            label="Cedula - Frente *" uri={idFront} fileName={idFrontName}
            onPickImage={() => pickImageOrCamera("Cedula frente", (b64) => { setIdFront(b64); setIdFrontName(""); })}
            onPickDoc={() => pickDocument((b64, name) => { setIdFront(b64); setIdFrontName(name); })}
            accent={accent} hint="Foto: JPG/PNG max 600KB  |  PDF max 5MB"
          />

          {/* Cédula reverso */}
          <DocAttachment
            label="Cedula - Reverso *" uri={idBack} fileName={idBackName}
            onPickImage={() => pickImageOrCamera("Cedula reverso", (b64) => { setIdBack(b64); setIdBackName(""); })}
            onPickDoc={() => pickDocument((b64, name) => { setIdBack(b64); setIdBackName(name); })}
            accent={accent} hint="Foto: JPG/PNG max 600KB  |  PDF max 5MB"
          />

          {/* Diploma */}
          <DocAttachment
            label={`Diploma o Certificado ${role === "quiropodologo" ? "* (obligatorio)" : "(opcional)"}`}
            uri={diploma} fileName={diplomaName}
            onPickImage={() => pickImageOrCamera("Diploma", (b64) => { setDiploma(b64); setDiplomaName(""); })}
            onPickDoc={() => pickDocument((b64, name) => { setDiploma(b64); setDiplomaName(name); })}
            accent={accent} hint="Foto: JPG/PNG max 600KB  |  PDF max 5MB"
          />

          {/* ── CAMBIO 4: Autorización de antecedentes ─────────────────── */}
          <View style={{
            backgroundColor: "#0d1b0d", borderWidth: 1,
            borderColor: "#4caf50", borderRadius: 12,
            padding: 16, marginTop: 8,
          }}>
            <Text style={{ color: "#4caf50", fontWeight: "900", fontSize: 14, marginBottom: 8 }}>
              🔍 Autorización consulta de antecedentes *
            </Text>
            <Text style={{ color: "#ccc", fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
              El administrador de StyleApp verificará tus antecedentes penales y de policía
              directamente con las entidades competentes. Para ello necesitamos tu autorización expresa.
            </Text>

            {/* Checkbox autorización */}
            <TouchableOpacity
              onPress={() => setAutorizaAntecedentes(!autorizaAntecedentes)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 }}
            >
              <View style={{
                width: 24, height: 24, borderWidth: 2, borderRadius: 4,
                borderColor: "#4caf50", marginTop: 1,
                backgroundColor: autorizaAntecedentes ? "#4caf50" : "transparent",
                alignItems: "center", justifyContent: "center",
              }}>
                {autorizaAntecedentes && (
                  <Text style={{ color: "#000", fontWeight: "900", fontSize: 14 }}>✓</Text>
                )}
              </View>
              <Text style={{ color: "#ccc", flex: 1, lineHeight: 20, fontSize: 13 }}>
                Autorizo a StyleApp a consultar mis antecedentes penales y de policía
                ante las entidades competentes como parte del proceso de validación
                de mi cuenta profesional.
              </Text>
            </TouchableOpacity>

            {/* Adjuntar certificado de antecedentes (opcional) */}
            <Text style={{ color: "#4caf50", fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
              Certificado de antecedentes (opcional — puedes adjuntarlo si lo tienes)
            </Text>
            <DocAttachment
              label="Certificado antecedentes policiales"
              uri={antecedentesDoc}
              fileName={antecedentesName}
              onPickImage={() => pickImageOrCamera("Antecedentes", (b64) => { setAntecedentesDoc(b64); setAntecedentesName(""); })}
              onPickDoc={() => pickDocument((b64, name) => { setAntecedentesDoc(b64); setAntecedentesName(name); })}
              accent="#4caf50"
              hint="Si ya tienes el certificado puedes adjuntarlo. Si no, el admin lo verificará."
            />
          </View>
        </>
      )}

      {/* TÉRMINOS Y CONDICIONES */}
      <View style={{ marginTop: 16 }}>
        <TouchableOpacity
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
        >
          <View style={{
            width: 24, height: 24, borderWidth: 2, borderRadius: 4,
            borderColor: accent, marginTop: 1,
            backgroundColor: acceptedTerms ? accent : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {acceptedTerms && <Text style={{ color: "#000", fontWeight: "900", fontSize: 14 }}>✓</Text>}
          </View>
          <Text style={{ color: "#ccc", flex: 1, lineHeight: 20 }}>
            Acepto los{" "}
            <Text
              style={{ color: accent, textDecorationLine: "underline", fontWeight: "700" }}
              onPress={() => setShowTermsModal(true)}
            >
              Terminos y Condiciones
            </Text>
            {" "}de uso de Style *
          </Text>
        </TouchableOpacity>
        {!acceptedTerms && (
          <Text style={{ color: "#888", fontSize: 11, marginTop: 4, marginLeft: 34 }}>
            Debes aceptar los terminos para continuar
          </Text>
        )}
      </View>

      {/* BOTÓN CREAR CUENTA */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]}
        onPress={handleRegister} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? "Creando cuenta..." : "Crear cuenta"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={[styles.link, { color: accent }]}>Ya tienes cuenta? Inicia sesion</Text>
      </TouchableOpacity>

      {/* MODAL TÉRMINOS */}
      <Modal visible={showTermsModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#000000cc", justifyContent: "flex-end" }}>
          <View style={{
            backgroundColor: "#111", borderTopLeftRadius: 20,
            borderTopRightRadius: 20, padding: 24, maxHeight: "85%",
          }}>
            <Text style={{ color: accent, fontWeight: "900", fontSize: 20, marginBottom: 16 }}>
              Terminos y Condiciones
            </Text>
            <ScrollView style={{ marginBottom: 16 }}>
              <Text style={{ color: "#ccc", lineHeight: 22 }}>{`1. ACEPTACION
Al registrarte en Style aceptas estos terminos de uso.

2. USO DE LA APLICACION
Style es una plataforma que conecta clientes con profesionales de belleza y cuidado personal.

3. REGISTRO
Debes proporcionar informacion veridica y actualizada. Los profesionales deben adjuntar documentos validos para su validacion.

4. VALIDACION DE PROFESIONALES
Los perfiles de profesionales seran revisados en un plazo de 24 horas. Durante ese tiempo podras explorar la app pero no recibiras servicios hasta ser aprobado.

5. RESPONSABILIDAD
Style actua como intermediario. La calidad del servicio es responsabilidad del profesional.

6. PAGOS
Los pagos se realizan entre cliente y profesional segun el medio acordado.

7. CANCELACIONES
Las cancelaciones de servicios activos generan un cargo del 15% del valor del servicio.

8. CALIFICACIONES
Ambas partes pueden calificarse mutuamente al finalizar un servicio.

9. PRIVACIDAD
Tus datos son tratados conforme a la Ley 1581 de 2012 de proteccion de datos de Colombia.

10. DOCUMENTOS
Los documentos adjuntos son usados unicamente para validar identidad y formacion. No seran compartidos con terceros.

11. ANTECEDENTES
Para profesionales, autorizas la consulta de antecedentes penales y de policia como parte del proceso de validacion.

12. CONTACTO
Soporte: soporte@styleapp.co`}
              </Text>
            </ScrollView>
            <TouchableOpacity
              onPress={() => { setAcceptedTerms(true); setShowTermsModal(false); }}
              style={{ backgroundColor: accent, padding: 14, borderRadius: 10, alignItems: "center", marginBottom: 8 }}
            >
              <Text style={{ color: "#000", fontWeight: "900" }}>Aceptar terminos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTermsModal(false)}
              style={{ padding: 12, alignItems: "center" }}
            >
              <Text style={{ color: "#888" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Label({ text, accent }: { text: string; accent: string }) {
  return <Text style={[styles.label, { color: accent }]}>{text}</Text>;
}
function Chip({ text, active, accent, onPress }: {
  text: string; active: boolean; accent: string; onPress: () => void;
}) {
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
  secure?: boolean; keyboard?: any; accent: string;
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
  container:    { padding: 20, paddingBottom: 48 },
  logo:         { fontSize: 36, textAlign: "center", fontWeight: "900", marginBottom: 4 },
  title:        { color: "#fff", fontSize: 20, textAlign: "center", marginBottom: 16, fontWeight: "700" },
  label:        { marginTop: 14, marginBottom: 6, fontWeight: "700", fontSize: 13 },
  row:          { flexDirection: "row", gap: 8 },
  col:          { gap: 8 },
  chip:         { flex: 1, borderWidth: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#1a1a1a" },
  roleCard:     { borderWidth: 1, padding: 12, borderRadius: 10, backgroundColor: "#1a1a1a" },
  roleLabel:    { color: "#fff", fontWeight: "700", fontSize: 15 },
  roleSub:      { color: "#888", fontSize: 11, marginTop: 2 },
  input:        { backgroundColor: "#141414", borderRadius: 8, padding: 13, marginBottom: 8, color: "#fff", borderWidth: 1 },
  btn:          { padding: 15, borderRadius: 10, marginTop: 24, marginBottom: 8 },
  btnText:      { textAlign: "center", fontWeight: "900", color: "#000", fontSize: 16 },
  link:         { textAlign: "center", marginTop: 12, fontWeight: "700" },
  photoBox:     { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 14,
                  alignItems: "center", justifyContent: "center", marginBottom: 8, minHeight: 90 },
  photoImg:     { width: "100%", height: 130, borderRadius: 8 },
  portfolioBox: { flex: 1, borderWidth: 1, borderStyle: "dashed", borderRadius: 8,
                  aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  portfolioImg: { width: "100%", height: "100%", borderRadius: 8 },
  dropBtn:      { borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: "row",
                  alignItems: "center", marginBottom: 4, backgroundColor: "#141414" },
  dropList:     { borderWidth: 1, borderRadius: 8, backgroundColor: "#1a1a1a", marginBottom: 8 },
  dropItem:     { padding: 13, borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
});
