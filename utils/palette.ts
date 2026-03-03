// utils/palette.ts
export const getPalette = (gender?: string) => {
  if (gender === "female") {
    return {
      background: "#0d0d0d",
      card: "#1a1a1a",
      primary: "#FF69B4",
      text: "#ffffff",
      accent: "#FF69B4",
      danger: "#dd0000",
    };
  }

  // Masculino: dorado con negro
  return {
    background: "#000000",
    card: "#111111",
    primary: "#D4AF37",
    text: "#ffffff",
    accent: "#D4AF37",
    danger: "#dd0000",
  };
};
