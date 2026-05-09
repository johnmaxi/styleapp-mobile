// components/LanguageSelector.tsx
import { saveLanguage } from "@/constants/i18n";
import { useTranslation } from "react-i18next";
import { TouchableOpacity, View, Text, Modal } from "react-native";
import { useState } from "react";

type Props = {
  palette: any;
};

export default function LanguageSelector({ palette }: Props) {
  const { i18n, t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const current = i18n.language;

  const languages = [
    { code: "es", label: "🇨🇴  Español" },
    { code: "en", label: "🇺🇸  English" },
  ];

  const handleSelect = async (code: string) => {
    await saveLanguage(code);
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          flexDirection: "row", alignItems: "center", gap: 8,
          borderWidth: 1, borderColor: palette.primary,
          paddingVertical: 10, paddingHorizontal: 16,
          borderRadius: 8, backgroundColor: palette.card,
        }}
      >
        <Text style={{ fontSize: 18 }}>
          {current === "en" ? "🇺🇸" : "🇨🇴"}
        </Text>
        <Text style={{ color: palette.text, flex: 1 }}>
          {current === "en" ? "English" : "Español"}
        </Text>
        <Text style={{ color: "#555" }}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "#000000aa", justifyContent: "center", padding: 40 }}
          onPress={() => setVisible(false)}
          activeOpacity={1}
        >
          <View style={{
            backgroundColor: palette.card, borderRadius: 14,
            borderWidth: 1, borderColor: palette.primary, overflow: "hidden",
          }}>
            <Text style={{
              color: palette.primary, fontWeight: "700", fontSize: 16,
              padding: 16, borderBottomWidth: 1, borderBottomColor: "#333",
            }}>
              {t("common.language")}
            </Text>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                style={{
                  flexDirection: "row", alignItems: "center", padding: 16,
                  borderBottomWidth: lang.code === "es" ? 1 : 0,
                  borderBottomColor: "#222",
                  backgroundColor: current === lang.code ? palette.primary + "22" : "transparent",
                }}
              >
                <Text style={{ color: palette.text, fontSize: 16, flex: 1 }}>
                  {lang.label}
                </Text>
                {current === lang.code && (
                  <Text style={{ color: palette.primary, fontWeight: "700" }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
