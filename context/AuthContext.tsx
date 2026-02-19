import { setToken as setMemoryToken } from "@/services/tokenManager";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

type User = {
  id: number;
  email: string;
  role: "client" | "barber";
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const normalizeToken = (value: unknown) => {
  if (!value) return "";
  return String(value).replace(/\s+/g, "").trim();
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 🔄 LOAD SESSION
  useEffect(() => {
    async function loadSession() {
      try {
        const storedToken = await SecureStore.getItemAsync("token");
        const storedUser = await SecureStore.getItemAsync("user");

        const cleanToken = normalizeToken(storedToken);

        if (cleanToken && storedUser) {
          setToken(cleanToken);
          setMemoryToken(cleanToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.log("❌ Error cargando sesión", err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, []);

  // 🔐 LOGIN
  const login = async (email: string, password: string) => {
    console.log("📨 LOGIN →", email);
    const res = await api.post("/auth/login", { email, password });

    console.log("🧪 RESPUESTA LOGIN:", res.data);

    const token = normalizeToken(res.data.token);
    const user = res.data.user;

    if (!token || !user) {
      throw new Error("Respuesta inválida del servidor");
    }

    await SecureStore.setItemAsync("token", token);
    await SecureStore.setItemAsync("user", JSON.stringify(user));

    setToken(token);
    setMemoryToken(token); // 🔥 CLAVE
    setUser(user);
  };

  // 🚪 LOGOUT
  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");

    setToken(null);
    setMemoryToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);