// app/_layout.tsx
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

function RedirectGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Esperar un tick para que el layout esté montado
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;

    const firstSegment = segments[0] as string;

    // Rutas públicas — no redirigir
    const isPublic =
      firstSegment === "login" ||
      firstSegment === "(auth)" ||
      firstSegment === "register";

    if (!user) {
      if (!isPublic) {
        router.replace("/login");
      }
      return;
    }

    // Usuario logueado en ruta pública o raíz → redirigir a su home
    const isRoot = !firstSegment || firstSegment === "index";
    if (isPublic || isRoot) {
      if (user.role === "client") {
        router.replace("/client/home");
      } else if (["barber", "estilista", "quiropodologo"].includes(user.role)) {
        router.replace("/barber/home");
      } else if (user.role === "admin") {
        router.replace("/admin");
      }
    }
  }, [user, loading, ready, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RedirectGuard />
    </AuthProvider>
  );
}
