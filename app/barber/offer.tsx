import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import api from "../../api";

export default function Offer() {
  const { id } = useLocalSearchParams();
  const [price, setPrice] = useState("");

  return (
    <View style={{ padding: 20 }}>
      <Text>Contraoferta</Text>

      <TextInput
        keyboardType="numeric"
        value={price}
        onChangeText={setPrice}
        style={{ borderWidth: 1, padding: 10 }}
      />

      <TouchableOpacity
        onPress={() => api.post(`/services/${id}/counter-offer`, { price })}
        style={{ backgroundColor: "black", padding: 15 }}
      >
        <Text style={{ color: "white" }}>Enviar oferta</Text>
      </TouchableOpacity>
    </View>
  );
}