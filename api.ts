// api.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const api = axios.create({
  baseURL: "https://styleapp-backend-production.up.railway.app/api",
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const url = String(config.url ?? "");
  const isAuth = url.includes("/auth/login") || url.includes("/auth/register");
  if (isAuth) return config;

  try {
    const raw = await SecureStore.getItemAsync("token");
    if (raw) {
      const clean = raw.replace(/\s+/g, "").trim();
      config.headers.Authorization = `Bearer ${clean}`;
    }
  } catch (e) {
    console.warn("No se pudo leer el token:", e);
  }

  return config;
});

// Interceptor de respuesta: si 401, limpiar sesión
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await SecureStore.deleteItemAsync("token").catch(() => {});
      await SecureStore.deleteItemAsync("user").catch(() => {});
    }
    return Promise.reject(error);
  }
);

export default api;
