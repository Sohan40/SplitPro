import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ThemeColors } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';

export const authFallbackColors = {
  background: '#09090b',
  surface: '#121215',
  input: '#18181b',
  inputText: '#fafafa',
  placeholder: '#71717a',
  primary: '#a78bfa',
  primaryDark: '#7c3aed',
  primaryText: '#09090b',
  muted: '#a1a1aa',
  mutedDim: '#71717a',
  border: 'rgba(167,139,250,0.12)',
  white: '#fafafa',
  accentSoft: 'rgba(167,139,250,0.15)',
  routeSoft: 'rgba(255,255,255,0.08)',
};

export type AuthPalette = typeof authFallbackColors;

export function createAuthPalette(colors: ThemeColors): AuthPalette {
  return {
    background: colors.background,
    surface: colors.surfaceContainer,
    input: colors.surfaceContainerHigh,
    inputText: colors.textPrimary,
    placeholder: colors.textTertiary,
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    primaryText: colors.black,
    muted: colors.textSecondary,
    mutedDim: colors.textTertiary,
    border: colors.borderLight,
    white: colors.white,
    accentSoft: colors.primaryLight,
    routeSoft: colors.glassBorderTop,
  };
}

export function useAuthPalette() {
  const { theme } = useTheme();
  const palette = React.useMemo(() => createAuthPalette(theme.colors), [theme.colors]);

  return React.useMemo(() => ({ palette, isDark: true }), [palette]);
}

type AuthBackgroundProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AuthBackground({ children, style }: AuthBackgroundProps) {
  const { palette } = useAuthPalette();

  return (
    <View style={[styles.background, { backgroundColor: palette.background }, style]}>
      <View pointerEvents="none" style={styles.mapOverlay}>
        <View style={[styles.routeLine, styles.routeLineOne, { backgroundColor: palette.accentSoft }]} />
        <View style={[styles.routeLine, styles.routeLineTwo, { backgroundColor: palette.border }]} />
        <View style={[styles.routeLine, styles.routeLineThree, { backgroundColor: palette.routeSoft }]} />
        <View style={[styles.mapDot, styles.mapDotOne, { borderColor: palette.border }]} />
        <View style={[styles.mapDot, styles.mapDotTwo, { borderColor: palette.routeSoft }]} />
        <View style={[styles.mapDot, styles.mapDotThree, { borderColor: palette.routeSoft }]} />
        <View style={[styles.mapPin, styles.mapPinOne, { backgroundColor: palette.primary }]} />
        <View style={[styles.mapPin, styles.mapPinTwo, { backgroundColor: palette.mutedDim }]} />
      </View>
      {children}
    </View>
  );
}

type AuthHeaderProps = {
  title: string;
  accent: string;
  compact?: boolean;
};

export function AuthHeader({ title, accent, compact = false }: AuthHeaderProps) {
  const { palette } = useAuthPalette();

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      <View
        style={[
          styles.logoMark,
          { backgroundColor: palette.accentSoft, borderColor: palette.border },
        ]}>
        <Image
          source={require('../../../assets/images/logo.png')}
          resizeMode="contain"
          style={styles.logoImage}
        />
      </View>
      <Text style={[styles.heroTitle, { color: palette.inputText }, compact && styles.heroTitleCompact]}>
        {title}
        {'\n'}
        <Text style={{ color: palette.primary }}>{accent}</Text>
      </Text>
    </View>
  );
}

type AuthInputProps = TextInputProps & {
  iconName: string;
  rightIconName?: string;
  onRightPress?: () => void;
  wrapperStyle?: StyleProp<ViewStyle>;
};

export function AuthInput({
  iconName,
  rightIconName,
  onRightPress,
  wrapperStyle,
  style,
  ...inputProps
}: AuthInputProps) {
  const { palette } = useAuthPalette();

  return (
    <View style={[styles.inputWrapper, { backgroundColor: palette.input }, wrapperStyle]}>
      <View style={styles.inputIcon}>
        <Icon name={iconName} size={19} color={palette.mutedDim} />
      </View>
      <TextInput
        {...inputProps}
        style={[styles.input, { color: palette.inputText }, style]}
        placeholderTextColor={palette.placeholder}
        selectionColor={palette.primary}
      />
      {rightIconName ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.75}
          onPress={onRightPress}
          style={styles.inputAction}>
          <Icon name={rightIconName} size={20} color={palette.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

type AuthPrimaryButtonProps = {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AuthPrimaryButton({
  title,
  loading,
  disabled,
  onPress,
  style,
}: AuthPrimaryButtonProps) {
  const { palette } = useAuthPalette();
  const isDisabled = Boolean(disabled || loading);

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.primaryButton,
        { backgroundColor: palette.primary, shadowColor: palette.primary },
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.primaryText} />
      ) : (
        <Text style={[styles.primaryButtonText, { color: palette.primaryText }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

type AuthGoogleButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  title?: string;
};

export function AuthGoogleButton({
  loading,
  disabled,
  onPress,
  title = 'Continue with Google',
}: AuthGoogleButtonProps) {
  const { palette } = useAuthPalette();
  const isDisabled = Boolean(disabled || loading);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.googleButton,
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
        },
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.inputText} size="small" />
      ) : (
        <>
          <Icon name="logo-google" size={20} color="#ea4335" style={styles.googleIcon} />
          <Text style={[styles.googleButtonText, { color: palette.inputText }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

type AuthFooterLinkProps = {
  text: string;
  linkText: string;
  onPress: () => void;
};

export function AuthFooterLink({ text, linkText, onPress }: AuthFooterLinkProps) {
  const { palette } = useAuthPalette();

  return (
    <View style={styles.footerLinkRow}>
      <Text style={[styles.footerText, { color: palette.muted }]}>{text} </Text>
      <Text onPress={onPress} style={[styles.footerLink, { color: palette.primary }]}>
        {linkText}
      </Text>
    </View>
  );
}

type AuthCheckboxProps = {
  checked: boolean;
  label: string;
  onPress: () => void;
};

export function AuthCheckbox({ checked, label, onPress }: AuthCheckboxProps) {
  const { palette } = useAuthPalette();

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.checkboxRow}>
      <View
        style={[
          styles.checkbox,
          { borderColor: palette.primary },
          checked && { backgroundColor: palette.primary, borderColor: palette.primary },
        ]}>
        {checked ? <Icon name="checkmark" size={13} color={palette.primaryText} /> : null}
      </View>
      <Text style={[styles.checkboxLabel, { color: palette.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    overflow: 'hidden',
  },
  mapOverlay: {
    position: 'absolute',
    top: -56,
    left: -32,
    right: -32,
    height: 390,
    opacity: 0.5,
  },
  routeLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-22deg' }],
  },
  routeLineOne: {
    top: 96,
    left: -22,
    width: 270,
  },
  routeLineTwo: {
    top: 174,
    right: -18,
    width: 330,
    transform: [{ rotate: '15deg' }],
  },
  routeLineThree: {
    top: 264,
    left: 74,
    width: 260,
    transform: [{ rotate: '-7deg' }],
  },
  mapDot: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
  },
  mapDotOne: {
    top: 44,
    right: 44,
  },
  mapDotTwo: {
    top: 188,
    left: 20,
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  mapDotThree: {
    top: 216,
    right: 92,
    width: 136,
    height: 136,
    borderRadius: 68,
  },
  mapPin: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  mapPinOne: {
    top: 143,
    left: 112,
  },
  mapPinTwo: {
    top: 243,
    right: 86,
  },
  header: {
    marginTop: 40,
    marginBottom: 48,
  },
  headerCompact: {
    marginTop: 34,
    marginBottom: 30,
  },
  logoMark: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 34,
    borderWidth: 1,
  },
  logoImage: {
    width: 30,
    height: 30,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
    letterSpacing: 0,
  },
  heroTitleCompact: {
    fontSize: 34,
    lineHeight: 42,
  },
  inputWrapper: {
    minHeight: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  inputIcon: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 56,
    fontSize: 15,
    paddingVertical: 0,
    paddingRight: 16,
  },
  inputAction: {
    width: 48,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 15,
    elevation: 5,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  googleButton: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 20,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  checkboxLabel: {
    fontSize: 12,
  },
  disabled: {
    opacity: 0.55,
  },
});
