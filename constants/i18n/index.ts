// constants/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import es from "./es";
import en from "./en";

const LANGUAGE_KEY = "styleapp_language";

const resources = {
  es: { translation: es },
  en: { translation: en },
};

// Detectar idioma guardado o usar el del dispositivo
const getStoredLanguage = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) return stored;
    const deviceLang = Localization.getLocales()[0]?.languageCode || "es";
    return deviceLang.startsWith("en") ? "en" : "es";
  } catch {
    return "es";
  }
};

export const saveLanguage = async (lang: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    await i18n.changeLanguage(lang);
  } catch {}
};

export const initI18n = async (): Promise<void> => {
  const lang = await getStoredLanguage();
  await i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: lang,
      fallbackLng: "es",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v3",
    });
};

export default i18n;
