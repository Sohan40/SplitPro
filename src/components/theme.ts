// SplitPro Design System — Dark Theme
// Dark: Obsidian
// Adapted from the Premium Glassy UI Redesign

// ─── Color Palettes ────────────────────────────────────────

export const darkColors = {
  // Core backgrounds (darkest → lightest layering)
  background: '#09090b',
  surface: '#0c0c0f',
  surfaceContainer: '#121215',
  surfaceContainerHigh: '#18181b',
  surfaceContainerHighest: '#1e1e22',
  surfaceAlt: '#0f0f12',

  // Brand — Violet / Purple
  primary: '#a78bfa',
  primaryDark: '#7c3aed',
  primaryLight: 'rgba(167,139,250,0.15)',

  // Financial indicators
  owed: '#34d399',
  owedLight: 'rgba(52,211,153,0.15)',
  owes: '#ef4444',
  owesLight: 'rgba(239,68,68,0.15)',

  // Text
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',

  // Borders
  border: '#27272a',
  borderLight: 'rgba(167,139,250,0.12)',
  borderStrong: '#52525b',

  // Misc
  divider: '#27272a',
  warning: '#f59e0b',
  info: '#3b82f6',
  overlay: 'rgba(0, 0, 0, 0.7)',
  white: '#fafafa',
  black: '#09090b',

  // Glass effect
  glassBackground: 'rgba(24,24,27,0.55)',
  glassDiagonal: 'rgba(30,28,40,0.65)',
  glassHighlight: 0.06,
  glassBorderTop: 'rgba(255,255,255,0.08)',
};

export type ThemeColors = typeof darkColors;

// ─── Typography (theme-aware factory) ──────────────────────

export function createTypography(c: ThemeColors) {
  return {
    heading1: {
      fontSize: 30,
      fontWeight: '800' as const,
      lineHeight: 36,
      letterSpacing: -0.5,
      color: c.textPrimary,
    },
    heading2: {
      fontSize: 22,
      fontWeight: '700' as const,
      lineHeight: 28,
      letterSpacing: -0.3,
      color: c.textPrimary,
    },
    heading3: {
      fontSize: 17,
      fontWeight: '600' as const,
      lineHeight: 24,
      color: c.textPrimary,
    },
    body: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 22,
      color: c.textPrimary,
    },
    bodyBold: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 22,
      color: c.textPrimary,
    },
    caption: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
      color: c.textSecondary,
    },
    captionBold: {
      fontSize: 13,
      fontWeight: '600' as const,
      lineHeight: 18,
      color: c.textSecondary,
    },
    small: {
      fontSize: 11,
      fontWeight: '400' as const,
      lineHeight: 14,
      color: c.textTertiary,
    },
    label: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      color: c.textSecondary,
    },
    amount: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 26,
      color: c.textPrimary,
    },
    amountLarge: {
      fontSize: 36,
      fontWeight: '800' as const,
      lineHeight: 44,
      letterSpacing: -1,
      color: c.textPrimary,
    },
  };
}

export type ThemeTypography = ReturnType<typeof createTypography>;

// ─── Static tokens (spacing, borderRadius, shadows — theme-independent) ──

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
    shadowColor: '#000',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
};

// ─── Full Theme Object ─────────────────────────────────────

export interface AppTheme {
  dark: boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

export function getTheme(_mode: 'dark' = 'dark'): AppTheme {
  const c = darkColors;
  return {
    dark: true,
    colors: c,
    typography: createTypography(c),
    spacing,
    borderRadius,
    shadows,
  };
}

// ─── Backward-compatible static exports (dark theme defaults) ──
// These will be removed once all files are migrated to useTheme()
export const colors = darkColors;
export const typography = createTypography(darkColors);
