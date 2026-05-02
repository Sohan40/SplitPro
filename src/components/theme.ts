// SplitPro Design System
// Clean, neutral palette with green/red accents for financial indicators

export const colors = {
  // Core
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F5',

  // Brand
  primary: '#4F46E5',       // Indigo
  primaryLight: '#EEF2FF',
  primaryDark: '#3730A3',

  // Financial indicators
  owed: '#16A34A',          // Green — you are owed
  owedLight: '#DCFCE7',
  owes: '#DC2626',          // Red — you owe
  owesLight: '#FEE2E2',

  // Neutrals
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#E5E7EB',

  // Accents
  warning: '#F59E0B',
  info: '#3B82F6',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  white: '#FFFFFF',
  black: '#000000',
};

export const typography = {
  // Font family — system default (San Francisco on iOS, Roboto on Android)
  heading1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: colors.textPrimary,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  captionBold: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: colors.textTertiary,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  amountLarge: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
    color: colors.textPrimary,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
};
