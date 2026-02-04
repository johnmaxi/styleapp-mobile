// store/authStore.ts
import * as SecureStore from "expo-secure-store";

type User = {
  id: number;
  email: string;
  role: "client" | "barber";
};

type Session = {
  token: string;
  user: User;
};

/**
 * Guarda sesión en SecureStore
 */
export async function saveSession(token: string, user: User) {
  if (!token || !user) return;

  await SecureStore.setItemAsync("token", token);
  await SecureStore.setItemAsync("user", JSON.stringify(user));
}

/**
 * Obtiene sesión desde SecureStore
 */
export async function getSession(): Promise<Session | null> {
  try {
    const token = await SecureStore.getItemAsync("token");
    const user = await SecureStore.getItemAsync("user");

    if (!token || !user) return null;

    return {
      token,
      user: JSON.parse(user),
    };
  } catch (error) {
    console.log("❌ Error leyendo sesión", error);
    return null;
  }
}

/**
 * Elimina sesión (logout)
 */
export async function clearSession() {
  await SecureStore.deleteItemAsync("token");
  await SecureStore.deleteItemAsync("user");
}