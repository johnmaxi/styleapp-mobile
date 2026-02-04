import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Role = "client" | "barber";
type Gender = "male" | "female";

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] = useState<Role>("client");
  const [gender, setGender] = useState<Gender>("male");

  const [form, setForm] = useState({
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
  });

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
  };

const handleRegister = () => {
  console.log("REGISTRO:", { role, gender, ...form });
  router.replace("/login");
};


  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>✂️💈 StyleApp</Text>
      <Text style={styles.title}>Registro</Text>

      <Text style={styles.label}>Tipo de usuario</Text>
      <View style={styles.row}>
        <Option text="Cliente" active={role === "client"} onPress={() => setRole("client")} />
        <Option text="Barbero" active={role === "barber"} onPress={() => setRole("barber")} />
      </View>

      <Text style={styles.label}>Género</Text>
      <View style={styles.row}>
        <Option text="Masculino" active={gender === "male"} onPress={() => setGender("male")} />
        <Option text="Femenino" active={gender === "female"} onPress={() => setGender("female")} />
      </View>

      <Input placeholder="Usuario" onChange={(v: string) => handleChange("username", v)} />
      <Input placeholder="Contraseña" secure onChange={(v: string) => handleChange("password", v)} />

      <Input placeholder="Primer nombre *" onChange={(v: string) => handleChange("firstName", v)} />
      <Input placeholder="Segundo nombre" onChange={(v: string) => handleChange("secondName", v)} />
      <Input placeholder="Primer apellido *" onChange={(v: string) => handleChange("lastName", v)} />
      <Input placeholder="Segundo apellido" onChange={(v: string) => handleChange("secondLastName", v)} />

      <Input
        placeholder="Número documento"
        keyboard="numeric"
        onChange={(v: string) =>
          handleChange("documentNumber", v.replace(/[^0-9]/g, ""))
        }
      />

      <Input
        placeholder="Celular"
        keyboard="numeric"
        onChange={(v: string) => handleChange("phone", v.replace(/[^0-9]/g, ""))}
      />

      <Input
        placeholder="Email"
        keyboard="email-address"
        onChange={(v: string) => handleChange("email", v)}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Crear cuenta</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* COMPONENTES */

type InputProps = {
  placeholder: string;
  onChange: (value: string) => void;
  secure?: boolean;
  keyboard?: "default" | "numeric" | "email-address";
};

function Input({
  placeholder,
  onChange,
  secure = false,
  keyboard = "default",
}: InputProps) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#aaa"
      secureTextEntry={secure}
      keyboardType={keyboard}
      style={styles.input}
      onChangeText={onChange}
    />
  );
}

type OptionProps = {
  text: string;
  active: boolean;
  onPress: () => void;
};

function Option({ text, active, onPress }: OptionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.option, active && styles.optionActive]}
    >
      <Text style={styles.optionText}>{text}</Text>
    </TouchableOpacity>
  );
}

/* ESTILOS */

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#000",
  },
  logo: {
    fontSize: 40,
    color: "#D4AF37",
    textAlign: "center",
    marginBottom: 10,
    fontWeight: "bold",
  },
  title: {
    color: "#fff",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  label: {
    color: "#fff",
    marginTop: 16,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D4AF37",
    padding: 10,
    borderRadius: 6,
  },
  optionActive: {
    backgroundColor: "#D4AF37",
  },
  optionText: {
    textAlign: "center",
    color: "#000",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#D4AF37",
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  buttonText: {
    textAlign: "center",
    fontWeight: "bold",
  },
  link: {
    color: "#D4AF37",
    textAlign: "center",
    marginTop: 20,
  },
});