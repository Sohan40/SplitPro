import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme, type AppTheme } from '../components/theme';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: AppTheme;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const STORAGE_KEY = '@splitpro_theme_preference';

const ThemeContext = createContext<ThemeContextValue>({
  theme: getTheme('dark'),
  isDark: true,
  preference: 'system',
  setPreference: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch((e) =>
      console.warn('Failed to save theme preference:', e),
    );
  }, []);

  const resolvedMode: 'light' | 'dark' = useMemo(() => {
    if (preference === 'system') {
      return systemColorScheme === 'light' ? 'light' : 'dark';
    }
    return preference;
  }, [preference, systemColorScheme]);

  const theme = useMemo(() => getTheme(resolvedMode), [resolvedMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme.dark,
      preference,
      setPreference,
    }),
    [theme, preference, setPreference],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
