import api from "@/services/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function CreateService() {
  const router = useRouter();

  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);

      await api.post("/jobs", {
        description,
        price: Number(price),
      });

      router.replace("/client/status");
    } catch (err) {
      Alert.alert("Error", "No se pudo crear el servicio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 30 }}>
      <Text style={{ fontSize: 22, marginBottom: 20 }}>
        Crear servicio
      </Text>

      <TextInput
        placeholder="¿Qué servicio necesitas?"
        value={description}
        onChangeText={setDescription}
        style={{ borderWidth: 1, marginBottom: 10, padding: 10 }}
      />

      <TextInput
        placeholder="Precio ofrecido"
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
        style={{ borderWidth: 1, marginBottom: 20, padding: 10 }}
      />

      <TouchableOpacity
        onPress={handleCreate}
        disabled={loading}
        style={{
          backgroundColor: "#000",
          padding: 15,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff" }}>
          {loading ? "Enviando..." : "Publicar servicio"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}