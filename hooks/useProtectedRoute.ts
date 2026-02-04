import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";


export function useProtectedRoute(role?: string) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
    if (role && user?.role !== role) router.replace("/login");
  }, [user]);
}
