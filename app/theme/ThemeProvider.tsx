import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildTheme, type AccentKey, type Mode, type ModePref, type Theme } from '@/constants/theme';

type ThemeContextValue = {
  theme: Theme;
  mode: Mode;
  modePref: ModePref;
  accent: AccentKey;
  setModePref: (m: ModePref) => void;
  setAccent: (a: AccentKey) => void;
  cycleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultMode = 'system',
  defaultAccent = 'indigo',
}: {
  children: ReactNode;
  defaultMode?: ModePref;
  defaultAccent?: AccentKey;
}) {
  const system = useColorScheme();
  const [modePref, setModePref] = useState<ModePref>(defaultMode);
  const [accent, setAccent] = useState<AccentKey>(defaultAccent);

  const mode: Mode = modePref === 'system' ? (system === 'dark' ? 'dark' : 'light') : modePref;
  const theme = useMemo(() => buildTheme(mode, accent), [mode, accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      modePref,
      accent,
      setModePref,
      setAccent,
      cycleMode: () =>
        setModePref((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system')),
    }),
    [theme, mode, modePref, accent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
