import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  formatCurrencyAmount,
  getCurrencySymbol,
  isCurrencyCode,
  type CurrencyCode,
  type CurrencyOption,
  type FormatAmountOptions,
} from '../utils/currency';

interface CurrencyContextValue {
  currency: CurrencyCode;
  currencySymbol: string;
  options: CurrencyOption[];
  setCurrency: (currency: CurrencyCode) => void;
  formatAmount: (amount: number, options?: FormatAmountOptions) => string;
}

const STORAGE_KEY = '@splitpro_currency_preference';
export type { CurrencyCode };

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  currencySymbol: getCurrencySymbol(DEFAULT_CURRENCY),
  options: CURRENCY_OPTIONS,
  setCurrency: () => {},
  formatAmount: amount => formatCurrencyAmount(amount),
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (isCurrencyCode(stored)) {
          setCurrencyState(stored);
        }
      } catch (error) {
        console.warn('Failed to load currency preference:', error);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const setCurrency = useCallback((nextCurrency: CurrencyCode) => {
    setCurrencyState(nextCurrency);
    AsyncStorage.setItem(STORAGE_KEY, nextCurrency).catch(error =>
      console.warn('Failed to save currency preference:', error),
    );
  }, []);

  const formatAmount = useCallback(
    (amount: number, options?: FormatAmountOptions) => (
      formatCurrencyAmount(amount, options?.currency || currency, options)
    ),
    [currency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      currencySymbol: getCurrencySymbol(currency),
      options: CURRENCY_OPTIONS,
      setCurrency,
      formatAmount,
    }),
    [currency, formatAmount, setCurrency],
  );

  if (!loaded) return null;

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
};
