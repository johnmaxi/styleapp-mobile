import axios from "axios";
import * as SecureStore from "expo-secure-store";


const api = axios.create({
  baseURL: "http://192.168.20.72:3000/api"
});

const normalizeToken = (value: string | null) => {
  if (!value) return "";
  return value.replace(/\s+/g, "").trim();
};

api.interceptors.request.use(async (config) => {

  const requestUrl = String(config.url ?? "");
  const isAuthRequest =
    requestUrl.includes("/auth/login") || requestUrl.includes("/auth/register");

  if (isAuthRequest) {
    return config;
  }


  const storedToken = await SecureStore.getItemAsync("token");
  const token = normalizeToken(storedToken);

  if (token) {
    console.log("🪪 TOKEN ENVIADO:", token);
    config.headers.Authorization = `Bearer ${token}`;
  }

  console.log("📤 HEADERS:", config.headers);

  return config;
});

export default api;