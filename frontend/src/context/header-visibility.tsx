import { createContext, useContext, useState, ReactNode } from "react";

interface HeaderVisibilityContextType {
  hideHeader: boolean;
  toggleHeader: () => void;
  setHideHeader: (hide: boolean) => void;
}

const HeaderVisibilityContext = createContext<HeaderVisibilityContextType | undefined>(undefined);

export function HeaderVisibilityProvider({ children }: { children: ReactNode }) {
  const [hideHeader, setHideHeader] = useState(true); // AI Search 페이지는 기본 숨김

  const toggleHeader = () => {
    setHideHeader((prev) => !prev);
  };

  return (
    <HeaderVisibilityContext.Provider value={{ hideHeader, toggleHeader, setHideHeader }}>
      {children}
    </HeaderVisibilityContext.Provider>
  );
}

export function useHeaderVisibility() {
  const context = useContext(HeaderVisibilityContext);
  if (!context) {
    throw new Error("useHeaderVisibility must be used within HeaderVisibilityProvider");
  }
  return context;
}
