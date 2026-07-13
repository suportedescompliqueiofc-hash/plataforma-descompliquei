import { createContext, useContext, useState, type ReactNode } from "react";

interface AppChromeContextValue {
  chromeHidden: boolean;
  setChromeHidden: (hidden: boolean) => void;
}

// Permite que uma página descendente (ex: Notas em modo tela cheia) peça pro
// AppLayout esconder a sidebar/topbar da plataforma — não só o próprio
// conteúdo interno da página.
const AppChromeContext = createContext<AppChromeContextValue>({
  chromeHidden: false,
  setChromeHidden: () => {},
});

export function AppChromeProvider({ children }: { children: ReactNode }) {
  const [chromeHidden, setChromeHidden] = useState(false);
  return (
    <AppChromeContext.Provider value={{ chromeHidden, setChromeHidden }}>
      {children}
    </AppChromeContext.Provider>
  );
}

export function useAppChrome() {
  return useContext(AppChromeContext);
}
