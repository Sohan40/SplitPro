// SplitPro Design System — Obsidian Dark Theme
// Adapted from the Premium Glassy UI Redesign (Stitch project 16273210988204002203)

export const colors = {
  // Core backgrounds (darkest → lightest layering)
  background: '#09090b',         // Page background
  surface: '#0c0c0f',            // Base surface
  surfaceContainer: '#121215',   // Card / container background
  surfaceContainerHigh: '#18181b', // Elevated card
  surfaceContainerHighest: '#1e1e22', // Highest elevation
  surfaceAlt: '#0f0f12',         // Low-elevation surface

  // Brand — Violet / Purple
  primary: '#a78bfa',            // Primary accent (violet)
  primaryDark: '#7c3aed',        // Primary container / press state
  primaryLight: 'rgba(167,139,250,0.15)', // Tinted background

  // Financial indicators
  owed: '#34d399',               // Emerald — you are owed
  owedLight: 'rgba(52,211,153,0.15)',
  owes: '#ef4444',               // Red — you owe
  owesLight: 'rgba(239,68,68,0.15)',

  // Text
  textPrimary: '#fafafa',        // on-surface
  textSecondary: '#a1a1aa',      // on-surface-variant
  textTertiary: '#71717a',       // secondary

  // Borders
  border: '#27272a',             // outline-variant
  borderStrong: '#52525b',       // outline

  // Misc
  divider: '#27272a',
  warning: '#f59e0b',
  info: '#3b82f6',
  overlay: 'rgba(0, 0, 0, 0.7)',
  white: '#fafafa',
  black: '#09090b',
};

export const typography = {
  heading1: {
    fontSize: 30,
    fontWeight: '800' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.textPrimary,
  },
  heading2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  heading3: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  bodyBold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  captionBold: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  small: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '800' as const,
    lineHeight: 44,
    letterSpacing: -1,
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
};
