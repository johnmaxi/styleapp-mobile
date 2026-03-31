// app/_layout.tsx
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

function RedirectGuard() {
  const { user, loading } = useAuth();
  const router             = useRouter();
  const segments           = useSegments();
  const [ready, setReady]  = useState(false);
  const isNavigating       = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (isNavigating.current) return;

    const firstSegment = segments[0] as string;

    const isPublic =
      firstSegment === "login" ||
      firstSegment === "(auth)" ||
      firstSegment === "register";

    if (!user) {
      if (!isPublic) {
        isNavigating.current = true;
        router.replace("/login");
        setTimeout(() => { isNavigating.current = false; }, 1000);
      }
      return;
    }

    // Solo redirigir desde raíz o rutas públicas — NO interferir con logout manual
    const isRoot = !firstSegment || firstSegment === "index";
    if (isRoot) {
      isNavigating.current = true;
      if (user.role === "client") {
        router.replace("/client/home");
      } else if (["barber", "estilista", "quiropodologo"].includes(user.role)) {
        router.replace("/barber/home");
      } else if (user.role === "admin") {
        router.replace("/admin");
      }
      setTimeout(() => { isNavigating.current = false; }, 1000);
    }
    // Si está en ruta pública (login) con usuario logueado → redirigir a su home
    if (isPublic && user) {
      isNavigating.current = true;
      if (user.role === "client") {
        router.replace("/client/home");
      } else if (["barber", "estilista", "quiropodologo"].includes(user.role)) {
        router.replace("/barber/home");
      } else if (user.role === "admin") {
        router.replace("/admin");
      }
      setTimeout(() => { isNavigating.current = false; }, 1000);
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
