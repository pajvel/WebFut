import { createContext, useContext } from "react";
import type { Me, Settings } from "./types";

type AppContextValue = {
  me: Me | null;
  settings: Settings | null;
  setTheme: (theme: "light" | "dark") => void;
  refreshMe: () => void;
};

export const AppContext = createContext<AppContextValue>({
  me: null,
  settings: null,
  setTheme: () => undefined,
  refreshMe: () => undefined
});

export function useAppContext() {
  return useContext(AppContext);
}



