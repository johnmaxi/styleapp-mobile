// context/AuthContext.tsx
import api from "@/api";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";

export type UserRole =
  | "client"
  | "barber"
  | "estilista"
  | "quiropodologo"
  | "admin";

export type User = {
  id: number;
  email: string;
  role: UserRole;
  gender?: "male" | "female";
  name?: string;
  profile_photo?: string;
  rating?: number;
  phone?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  registration_status?: string;
};

type LoginResult = {
  approval_message: string | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restaurar sesión al iniciar la app ───────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync("token");
        const savedUser = await SecureStore.getItemAsync("user");

        if (savedToken && savedUser) {
          // Parsear usuario guardado
          let parsedUser = null;
          try {
            parsedUser = JSON.parse(savedUser);
          } catch {}

          // Validar que tiene datos mínimos requeridos
          const isValid =
            parsedUser &&
            parsedUser.id &&
            parsedUser.email &&
            parsedUser.role &&
            [
              "client",
              "barber",
              "estilista",
              "quiropodologo",
              "admin",
            ].includes(parsedUser.role);

          if (!isValid) {
            // Datos corruptos — limpiar todo
            await SecureStore.deleteItemAsync("token").catch(() => {});
            await SecureStore.deleteItemAsync("user").catch(() => {});
            setLoading(false);
            return;
          }

          // Validar token con el servidor
          try {
            const cleanToken = savedToken.replace(/\s+/g, "").trim();
            const res = await api.get("/auth/me", {
              headers: { Authorization: `Bearer ${cleanToken}` },
            });
            const freshUser = res.data?.user || res.data;
            if (freshUser?.id && freshUser?.role) {
              await SecureStore.setItemAsync("user", JSON.stringify(freshUser));
              setToken(cleanToken);
              setUser(freshUser);
            } else {
              throw new Error("invalid");
            }
          } catch {
            // Token expirado o inválido — limpiar
            await SecureStore.deleteItemAsync("token").catch(() => {});
            await SecureStore.deleteItemAsync("user").catch(() => {});
          }
        }
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  const login = async (
    email: string,
    password: string,
  ): Promise<LoginResult> => {
    const res = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser, approval_message } = res.data;

    const cleanToken = String(newToken).replace(/\s+/g, "").trim();

    // ── FIX: guardar AMBOS token y user en SecureStore ────────────────
    await SecureStore.setItemAsync("token", cleanToken);
    await SecureStore.setItemAsync("user", JSON.stringify(newUser));

    setToken(cleanToken);
    setUser(newUser);

    return { approval_message: approval_message || null };
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync("token");
    } catch {}
    try {
      await SecureStore.deleteItemAsync("user");
    } catch {}
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
