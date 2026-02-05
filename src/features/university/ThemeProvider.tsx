'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { University } from '@/types/database';

interface ThemeContextType {
  university: University | null;
  setUniversity: (university: University | null) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  university: null,
  setUniversity: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({
  children,
  initialUniversity,
}: {
  children: ReactNode;
  initialUniversity?: University | null;
}) {
  const [university, setUniversity] = useState<University | null>(
    initialUniversity ?? null
  );

  useEffect(() => {
    if (university) {
      document.documentElement.style.setProperty(
        '--color-primary',
        university.primary_color
      );
      document.documentElement.style.setProperty(
        '--color-secondary',
        university.secondary_color
      );
    } else {
      document.documentElement.style.removeProperty('--color-primary');
      document.documentElement.style.removeProperty('--color-secondary');
    }
  }, [university]);

  return (
    <ThemeContext.Provider value={{ university, setUniversity }}>
      {children}
    </ThemeContext.Provider>
  );
}
