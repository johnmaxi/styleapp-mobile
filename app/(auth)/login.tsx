import { Link } from "expo-router";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={styles.container}>

      {/* LOGO */}
      <Image
        source={require("../../assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Iniciar sesión</Text>

      <TextInput
        placeholder="Correo"
        placeholderTextColor="#666"
        style={styles.input}
      />

      <TextInput
        placeholder="Contraseña"
        placeholderTextColor="#666"
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.button}>
        <Text style={styles.buttonText}>Ingresar</Text>
      </TouchableOpacity>

      {/* 👇👇👇 AQUÍ ESTÁ LO QUE NO SE VEÍA */}
      <View style={styles.linksContainer}>
        <Link href="/(auth)/register">
          <Text style={styles.link}>REGISTRARSE</Text>
        </Link>

        <Link href="/(auth)/forgot-password">
          <Text style={styles.link}>RECUPERAR CONTRASEÑA</Text>
        </Link>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    justifyContent: "center",
  },
  logo: {
    width: 140,
    height: 140,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#000",
  },
  input: {
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 6,
    padding: 12,
    marginBottom: 15,
    color: "#000",
  },
  button: {
    backgroundColor: "#000",
    padding: 15,
    borderRadius: 6,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  linksContainer: {
    marginTop: 25,
    alignItems: "center",
  },
  link: {
    color: "red",          // 🔴 visible sí o sí
    fontSize: 16,
    marginTop: 10,
    fontWeight: "bold",
  },
});