import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../api";

type Role = "client" | "barber";
type Gender = "male" | "female";
type PaymentMethod =
  | "tarjeta_credito"
  | "tarjeta_debito"
  | "nequi"
  | "pse"
  | "efectivo";
type AccountType = "ahorros" | "corriente";

type RegisterForm = {
  username: string;
  password: string;
  firstName: string;
  secondName: string;
  lastName: string;
  secondLastName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  email: string;
  address: string;
  paymentMethod: PaymentMethod;
  accountNumberOrNequi: string;
  accountType: AccountType;
  portfolio1: string;
  portfolio2: string;
  portfolio3: string;
  idFront: string;
  idBack: string;
};

const initialForm: RegisterForm = {
  username: "",
  password: "",
  firstName: "",
  secondName: "",
  lastName: "",
  secondLastName: "",
  documentType: "CC",
  documentNumber: "",
  phone: "",
  email: "",
  address: "",
  paymentMethod: "nequi",
  accountNumberOrNequi: "",
  accountType: "ahorros",
  portfolio1: "",
  portfolio2: "",
  portfolio3: "",
  idFront: "",
  idBack: "",
};

export default function RegisterScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("client");
  const [gender, setGender] = useState<Gender>("male");
  const [form, setForm] = useState<RegisterForm>(initialForm);
  const [loading, setLoading] = useState(false);

  const accent = gender === "male" ? "#D4AF37" : "#B026FF";

  const paymentOptions = useMemo(
    () => [
      { id: "tarjeta_credito", label: "Tarjeta de crédito" },
      { id: "tarjeta_debito", label: "Tarjeta débito" },
      { id: "nequi", label: "Nequi" },
      { id: "pse", label: "PSE" },
      { id: "efectivo", label: "Efectivo" },
    ] satisfies { id: PaymentMethod; label: string }[],
    []
  );

  const handleChange = (key: keyof RegisterForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      return "Completa nombre, apellido, email y contraseña";
    }

    if (!form.address.trim()) {
      return "La dirección es obligatoria";
    }

    if (!form.accountNumberOrNequi.trim()) {
      return "Debes ingresar número de cuenta o número Nequi";
    }

    if (role === "barber") {
      const portfolio = [form.portfolio1, form.portfolio2, form.portfolio3].filter(Boolean);
      if (portfolio.length < 3) {
        return "Para barbero debes cargar mínimo 3 fotos del portafolio";
      }

      if (!form.idFront.trim() || !form.idBack.trim()) {
        return "Para barbero debes adjuntar cédula por ambos lados";
      }
    }

    return null;
  };

  const handleRegister = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Validación", error);
      return;
    }

    setLoading(true);
    try {
      const fullName = `${form.firstName} ${form.secondName} ${form.lastName} ${form.secondLastName}`
        .replace(/\s+/g, " ")
        .trim();

      const payload = {
        name: fullName,
        username: form.username,
        email: form.email,
        password: form.password,
        phone: form.phone,
        role,
        gender,
        address: form.address,
        payment_method: form.paymentMethod,
        account_number: form.accountNumberOrNequi,
        account_type: form.accountType,
        document_type: form.documentType,
        document_number: form.documentNumber,
        portfolio: role === "barber" ? [form.portfolio1, form.portfolio2, form.portfolio3] : [],
        id_front: role === "barber" ? form.idFront : null,
        id_back: role === "barber" ? form.idBack : null,
      };

      await api.post("/auth/register", payload);

      await SecureStore.setItemAsync(
        "styleapp_profile_defaults",
        JSON.stringify({
          address: form.address,
          paymentMethod: form.paymentMethod,
          accountNumberOrNequi: form.accountNumberOrNequi,
          accountType: form.accountType,
        })
      );

      Alert.alert("Registro exitoso", "Tu usuario fue creado. Ahora inicia sesión.");
      router.replace("/login");
    } catch (err: any) {
      console.log("❌ ERROR REGISTRO:", err?.response?.data || err.message);
      const statusCode = err?.response?.status;
      if (statusCode === 404) {
        Alert.alert(
          "Backend incompleto",
          "Tu backend no expone POST /auth/register. Debes implementar esa ruta para guardar usuarios en base de datos."
        );
      } else {
        Alert.alert("Error", err?.response?.data?.error || "No se pudo registrar el usuario");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Registro</Text>
      <Text style={[styles.logo, { color: accent }]}>✂️ STYLEAPP</Text>
      <Text style={styles.title}>Registro de usuario</Text>

      <SectionLabel text="Tipo de usuario" />
      <View style={styles.row}>
        <Option text="Cliente" active={role === "client"} accent={accent} onPress={() => setRole("client")} />
        <Option text="Barbero" active={role === "barber"} accent={accent} onPress={() => setRole("barber")} />
      </View>

      <SectionLabel text="Género" />
      <View style={styles.row}>
        <Option text="Masculino" active={gender === "male"} accent={accent} onPress={() => setGender("male")} />
        <Option text="Femenino" active={gender === "female"} accent={accent} onPress={() => setGender("female")} />
      </View>

      <SectionLabel text="Datos personales" />
      <Input placeholder="Usuario" value={form.username} onChange={(v) => handleChange("username", v)} />
      <Input placeholder="Contraseña" value={form.password} secure onChange={(v) => handleChange("password", v)} />
      <Input placeholder="Primer nombre *" value={form.firstName} onChange={(v) => handleChange("firstName", v)} />
      <Input placeholder="Segundo nombre" value={form.secondName} onChange={(v) => handleChange("secondName", v)} />
      <Input placeholder="Primer apellido *" value={form.lastName} onChange={(v) => handleChange("lastName", v)} />
      <Input placeholder="Segundo apellido" value={form.secondLastName} onChange={(v) => handleChange("secondLastName", v)} />
      <Input placeholder="Tipo documento (CC)" value={form.documentType} onChange={(v) => handleChange("documentType", v)} />
      <Input placeholder="Número documento" keyboard="numeric" value={form.documentNumber} onChange={(v) => handleChange("documentNumber", v.replace(/[^0-9]/g, ""))} />
      <Input placeholder="Celular" keyboard="numeric" value={form.phone} onChange={(v) => handleChange("phone", v.replace(/[^0-9]/g, ""))} />
      <Input placeholder="Email" keyboard="email-address" value={form.email} onChange={(v) => handleChange("email", v)} />

      <SectionLabel text="Dirección" />
      <Input placeholder="Dirección principal del servicio" value={form.address} onChange={(v) => handleChange("address", v)} />

      <SectionLabel text="Medio de pago" />
      <View style={styles.columnGap}>
        {paymentOptions.map((option) => (
          <Option
            key={option.id}
            text={option.label}
            active={form.paymentMethod === option.id}
            accent={accent}
            onPress={() => handleChange("paymentMethod", option.id)}
          />
        ))}
      </View>
      <Input placeholder="Número de cuenta o Nequi" value={form.accountNumberOrNequi} onChange={(v) => handleChange("accountNumberOrNequi", v)} />

      <View style={styles.row}>
        <Option text="Ahorros" active={form.accountType === "ahorros"} accent={accent} onPress={() => handleChange("accountType", "ahorros")} />
        <Option text="Corriente" active={form.accountType === "corriente"} accent={accent} onPress={() => handleChange("accountType", "corriente")} />
      </View>

      {role === "barber" && (
        <>
          <SectionLabel text="Portafolio (mínimo 3 fotos - URLs)" />
          <Input placeholder="Foto 1 (URL o ruta)" value={form.portfolio1} onChange={(v) => handleChange("portfolio1", v)} />
          <Input placeholder="Foto 2 (URL o ruta)" value={form.portfolio2} onChange={(v) => handleChange("portfolio2", v)} />
          <Input placeholder="Foto 3 (URL o ruta)" value={form.portfolio3} onChange={(v) => handleChange("portfolio3", v)} />

          <SectionLabel text="Cédula de ciudadanía" />
          <Input placeholder="Cédula frente (URL o ruta)" value={form.idFront} onChange={(v) => handleChange("idFront", v)} />
          <Input placeholder="Cédula reverso (URL o ruta)" value={form.idBack} onChange={(v) => handleChange("idBack", v)} />
        </>
      )}

      <TouchableOpacity style={[styles.button, { backgroundColor: accent, opacity: loading ? 0.7 : 1 }]} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creando..." : "Crear cuenta"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={[styles.link, { color: accent }]}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

type InputProps = {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
  keyboard?: "default" | "numeric" | "email-address";
};

function Input({ placeholder, value, onChange, secure = false, keyboard = "default" }: InputProps) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#888"
      secureTextEntry={secure}
      keyboardType={keyboard}
      style={styles.input}
      value={value}
      onChangeText={onChange}
    />
  );
}

type OptionProps = {
  text: string;
  active: boolean;
  accent: string;
  onPress: () => void;
};

function Option({ text, active, accent, onPress }: OptionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, { borderColor: accent }, active && { backgroundColor: accent }]}
    >
      <Text style={[styles.optionText, active && { color: "#000" }]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#050505",
    paddingBottom: 36,
  },
  logo: {
    fontSize: 34,
    textAlign: "center",
    marginBottom: 6,
    fontWeight: "900",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 18,
    fontWeight: "700",
  },
  label: {
    color: "#fff",
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  columnGap: {
    gap: 8,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#101010",
  },
  optionText: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#171717",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#333",
  },
  button: {
    padding: 14,
    borderRadius: 10,
    marginTop: 24,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#000",
  },
  link: {
    textAlign: "center",
    marginTop: 18,
    fontWeight: "700",
  },
});