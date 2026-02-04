import { createContext, useContext, useState } from "react";

const themes = {
  male: {
    background: "#000",
    primary: "#D4AF37",
    text: "#FFF",
  },
  female: {
    background: "#000",
    primary: "#c4268f",
    text: "#FFF",
  },
};

const ThemeContext = createContext<any>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(themes.male);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);