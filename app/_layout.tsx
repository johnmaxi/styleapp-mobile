// app/_layout.tsx
import i18n, { initI18n } from "@/constants/i18n";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";

function RedirectGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || loading) return;
    const firstSegment = segments[0] as string;
    const isPublic =
      firstSegment === "login" ||
      firstSegment === "(auth)" ||
      firstSegment === "register";
    if (!user) {
      if (!isPublic) router.replace("/login");
      return;
    }
    const isRoot = !firstSegment || firstSegment === "index";
    if (isPublic || isRoot) {
      if (user.role === "client") router.replace("/client/home");
      else if (["barber", "estilista", "quiropodologo"].includes(user.role))
        router.replace("/barber/home");
      else if (user.role === "admin") router.replace("/admin");
    }
  }, [user, loading, ready, segments]);

  return <Slot />;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <RedirectGuard />
      </AuthProvider>
    </I18nextProvider>
  );
}
