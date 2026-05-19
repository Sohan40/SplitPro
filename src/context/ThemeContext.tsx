import React, { createContext, useContext, useMemo } from 'react';
import { getTheme, type AppTheme } from '../components/theme';

export type ThemePreference = 'dark';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getTheme('dark'),
  isDark: true,
  preference: 'dark',
  setPreference: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useMemo(() => getTheme('dark'), []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: true,
      preference: 'dark',
      setPreference: () => {},
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
