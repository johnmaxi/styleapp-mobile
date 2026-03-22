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
  id:                  number;
  email:               string;
  role:                UserRole;
  gender?:             "male" | "female";
  name?:               string;
  profile_photo?:      string;
  rating?:             number;
  phone?:              string;
  address?:            string;
  city?:               string;
  neighborhood?:       string;
  registration_status?: string;
};

type LoginResult = {
  approval_message: string | null;
};

type AuthContextType = {
  user:    User | null;
  token:   string | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<LoginResult>;
  logout:  () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await SecureStore.deleteItemAsync("token");
        await SecureStore.deleteItemAsync("user");
      } catch {}
      setLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.post("/auth/login", { email, password });
    const { token: newToken, user: newUser, approval_message } = res.data;

    const cleanToken = String(newToken).replace(/\s+/g, "").trim();

    await SecureStore.setItemAsync("token", cleanToken);
    await SecureStore.setItemAsync("user", JSON.stringify(newUser));

    setToken(cleanToken);
    setUser(newUser);

    return { approval_message: approval_message || null };
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
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
