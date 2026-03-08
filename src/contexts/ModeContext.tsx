import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Mode = 'light' | 'dark';

interface ModeContextType {
  mode: Mode;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const ModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<Mode>(() => {
    return (localStorage.getItem('mrsmrb-mode') as Mode) || 'light';
  });

  const setMode = (newMode: Mode) => {
    setModeState(newMode);
    localStorage.setItem('mrsmrb-mode', newMode);
  };

  const toggleMode = () => setMode(mode === 'light' ? 'dark' : 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
    }
  }, [mode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) throw new Error('useMode must be used within ModeProvider');
  return context;
};
