export const getPalette = (gender?: string) => {
  if (gender === "female") {
    return {
      background: "#2c0b3f",
      card: "#000000",
      primary: "#7b2cbf",
      text: "#ffffff",
      accent: "#d4af37",
    };
  }

  return {
    background: "#000000",
    card: "#111111",
    primary: "#d4af37",
    text: "#ffffff",
    accent: "#d4af37",
  };
};