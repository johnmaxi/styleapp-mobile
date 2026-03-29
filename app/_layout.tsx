// app/_layout.tsx
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

function RedirectGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const redirecting = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    if (redirecting.current) return;

    const firstSegment = segments[0] as string;

    const isPublic =
      firstSegment === "login" ||
      firstSegment === "(auth)" ||
      firstSegment === "register";

    if (!user) {
      if (!isPublic) {
        redirecting.current = true;
        // Pequeño delay para evitar conflicto con desmontaje de componentes
        setTimeout(() => {
          try {
            router.replace("/login");
          } catch {}
          setTimeout(() => {
            redirecting.current = false;
          }, 500);
        }, 100);
      }
      return;
    }

    const isRoot = !firstSegment || firstSegment === "index";
    if (isPublic || isRoot) {
      redirecting.current = true;
      setTimeout(() => {
        try {
          if (user.role === "client") {
            router.replace("/client/home");
          } else if (
            ["barber", "estilista", "quiropodologo"].includes(user.role)
          ) {
            router.replace("/barber/home");
          } else if (user.role === "admin") {
            router.replace("/admin");
          }
        } catch {}
        setTimeout(() => {
          redirecting.current = false;
        }, 500);
      }, 100);
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
