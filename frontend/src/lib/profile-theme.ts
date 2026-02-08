export type ProfileTheme = {
  id: string;
  name: string;
  colors: Record<string, string>;
};

export const PROFILE_THEMES: ProfileTheme[] = [
  {
    id: "real",
    name: "Real",
    colors: {
      "--bg-page": "#ffffff",
      "--bg-surface": "#f8f8f8",
      "--bg-contrast": "#000000",
      "--text-main": "#000000",
      "--text-contrast": "#ffffff",
      "--border-main": "#000000"
    }
  },
  {
    id: "barca-hk",
    name: "Barca H/K",
    colors: {
      "--bg-page": "#ffffff",
      "--bg-surface": "#ffeef3",
      "--bg-contrast": "#F5A9C5",
      "--text-main": "#3b0a1a",
      "--text-contrast": "#ffffff",
      "--border-main": "#F5A9C5"
    }
  },
  {
    id: "arsenal",
    name: "Arsenal",
    colors: {
      "--bg-page": "#ffffff",
      "--bg-surface": "#fff1f2",
      "--bg-contrast": "#dc2626",
      "--text-main": "#450a0a",
      "--text-contrast": "#ffffff",
      "--border-main": "#dc2626"
    }
  },
  {
    id: "city",
    name: "City",
    colors: {
      "--bg-page": "#ffffff",
      "--bg-surface": "#eef6fb",
      "--bg-contrast": "#0ea5e9",
      "--text-main": "#020617",
      "--text-contrast": "#ffffff",
      "--border-main": "#0ea5e9"
    }
  },
  {
    id: "celtic",
    name: "Celtic",
    colors: {
      "--bg-page": "#ffffff",
      "--bg-surface": "#f7fee7",
      "--bg-contrast": "#65a30d",
      "--text-main": "#1a2e05",
      "--text-contrast": "#ffffff",
      "--border-main": "#65a30d"
    }
  },
  {
    id: "juve",
    name: "Juve",
    colors: {
      "--bg-page": "#000000",
      "--bg-surface": "#121212",
      "--bg-contrast": "#ffffff",
      "--text-main": "#ffffff",
      "--text-contrast": "#000000",
      "--border-main": "#ffffff"
    }
  },
  {
    id: "shinnik",
    name: "Shinnik",
    colors: {
      "--bg-page": "#000000",
      "--bg-surface": "#050a14",
      "--bg-contrast": "#0B2C6B",
      "--text-main": "#ffffff",
      "--text-contrast": "#ffffff",
      "--border-main": "#0B2C6B"
    }
  },
  {
    id: "bvb",
    name: "BVB",
    colors: {
      "--bg-page": "#000000",
      "--bg-surface": "#18181b",
      "--bg-contrast": "#FDE100",
      "--text-main": "#FDE100",
      "--text-contrast": "#000000",
      "--border-main": "#FDE100"
    }
  },
  {
    id: "miami",
    name: "Miami",
    colors: {
      "--bg-page": "#050505",
      "--bg-surface": "#12090d",
      "--bg-contrast": "#F5A9C5",
      "--text-main": "#fce7ef",
      "--text-contrast": "#050505",
      "--border-main": "#F5A9C5"
    }
  },
  {
    id: "legion",
    name: "Legion",
    colors: {
      "--bg-page": "#050505",
      "--bg-surface": "#111111",
      "--bg-contrast": "#C1121F",
      "--text-main": "#ffffff",
      "--text-contrast": "#ffffff",
      "--border-main": "#C1121F"
    }
  }
];

export function applyProfileTheme(themeId: string | null | undefined) {
  const fallback = PROFILE_THEMES[0];
  const theme = PROFILE_THEMES.find((item) => item.id === themeId) || fallback;
  Object.entries(theme.colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  localStorage.setItem("profile_theme", theme.id);
  return theme;
}

