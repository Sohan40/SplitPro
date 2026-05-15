export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

export type CurrencyOption = {
  code: CurrencyCode;
  label: string;
  symbol: string;
};

export type FormatAmountOptions = {
  absolute?: boolean;
  currency?: CurrencyCode;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'INR';

export function isCurrencyCode(value: string | null): value is CurrencyCode {
  return CURRENCY_OPTIONS.some(option => option.code === value);
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  return CURRENCY_OPTIONS.find(option => option.code === currency)?.symbol || currency;
}

export function formatCurrencyAmount(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  options: FormatAmountOptions = {},
): string {
  const targetCurrency = options.currency || currency;
  const symbol = getCurrencySymbol(targetCurrency);
  const displayAmount = options.absolute ? Math.abs(amount) : amount;
  const sign = displayAmount < 0 ? '-' : '';

  return `${sign}${symbol}${Math.abs(displayAmount).toFixed(2)}`;
}
