// utils/imageUtils.ts
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

// Comprime imagen al máximo para que quepa en el request
const compressToBase64 = async (uri: string): Promise<string | null> => {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }], // máximo 400px de ancho
      { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!compressed.base64) return null;
    return `data:image/jpeg;base64,${compressed.base64}`;
  } catch (err) {
    console.warn("Error comprimiendo imagen:", err);
    return null;
  }
};

export const pickImageFromGallery = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permiso requerido", "Necesitas permitir acceso a la galería");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.5,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return compressToBase64(result.assets[0].uri);
};

export const takePhotoWithCamera = async (): Promise<string | null> => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permiso requerido", "Necesitas permitir acceso a la cámara");
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.5,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  return compressToBase64(result.assets[0].uri);
};

export const showImageOptions = (onSelect: (b64: string) => void) => {
  Alert.alert("Adjuntar foto", "¿Cómo deseas agregar la foto?", [
    {
      text: "📷 Tomar foto",
      onPress: async () => {
        const b64 = await takePhotoWithCamera();
        if (b64) onSelect(b64);
      },
    },
    {
      text: "🖼️ Galería",
      onPress: async () => {
        const b64 = await pickImageFromGallery();
        if (b64) onSelect(b64);
      },
    },
    { text: "Cancelar", style: "cancel" },
  ]);
};
