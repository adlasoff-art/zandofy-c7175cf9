import { createContext, useContext, useState, type ReactNode } from "react";

interface SupportDrawerContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SupportDrawerContext = createContext<SupportDrawerContextType>({
  open: false,
  setOpen: () => {},
});

export const useSupportDrawer = () => useContext(SupportDrawerContext);

export function SupportDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SupportDrawerContext.Provider value={{ open, setOpen }}>
      {children}
    </SupportDrawerContext.Provider>
  );
}
