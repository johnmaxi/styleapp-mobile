// services/api.js
import axios from "axios";
import * as SecureStore from "expo-secure-store";


const api = axios.create({
  baseURL: "http://129.168.1.7:3000/api"
});

api.interceptors.request.use(async (config) => {
  const storedToken = await SecureStore.getItemAsync("token");
  const token = storedToken?.trim()
  console.log("🪪 TOKEN ENVIADO:", token);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log("📤 HEADERS:", config.headers);

  return config;
});

export default api;
