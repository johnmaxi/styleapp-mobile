// store/authStore.ts
import * as SecureStore from "expo-secure-store";

export type UserRole = "client" | "barber" | "estilista" | "quiropodologo" | "admin";

type User = {
  id: number;
  email: string;
  role: UserRole;
  name?: string;
  gender?: string;
};

type Session = {
  token: string;
  user: User;
};

export async function saveSession(token: string, user: User) {
  if (!token || !user) return;
  await SecureStore.setItemAsync("token", token);
  await SecureStore.setItemAsync("user", JSON.stringify(user));
}

export async function getSession(): Promise<Session | null> {
  try {
    const token = await SecureStore.getItemAsync("token");
    const user = await SecureStore.getItemAsync("user");
    if (!token || !user) return null;
    return { token, user: JSON.parse(user) };
  } catch {
    return null;
  }
}

export async function clearSession() {
  await SecureStore.deleteItemAsync("token");
  await SecureStore.deleteItemAsync("user");
}
