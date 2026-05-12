import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
  Keyboard,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { spacing, borderRadius, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import type { LoginScreenProps } from '../../navigation/types';
import { auth } from '../../services/firebase';
import { signInWithGoogle } from '../../services/googleAuthService';
import Icon from 'react-native-vector-icons/Ionicons';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnim]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    setLoading(true);
    try {
      await auth.signInWithEmailAndPassword(email, password);
      // Navigation will be handled automatically by AuthContext + App.tsx
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Failed', error.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your email address first to reset your password.');
      return;
    }
    
    try {
      await auth.sendPasswordResetEmail(email);
      Alert.alert('Reset Email Sent', 'Check your inbox for a link to reset your password.');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Navigation handled by AuthContext
    } catch (error: any) {
      // User cancelled the sign-in flow
      if (error.code === 'SIGN_IN_CANCELLED' || error.code === '12501') {
        return;
      }
      console.error(error);
      Alert.alert('Google Sign-In Failed', error.message || 'An error occurred');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Animated.View style={[styles.container, { paddingBottom: keyboardAnim }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Branding */}
        <View style={styles.brandSection}>
          <View style={styles.logoGlow}>
            <Image 
              source={require('../../../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.logoText}>SplitPro</Text>
          <Text style={styles.subtitle}>Split expenses with friends</Text>
        </View>

        {/* Form Card */}
        <GlassCard padding="lg" gradientDir="diagonal" style={styles.formCard}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Sign in to continue</Text>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconBox}>
              <Icon name="mail-outline" size={18} color={colors.textTertiary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconBox}>
              <Icon name="lock-closed-outline" size={18} color={colors.textTertiary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={secureEntry}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setSecureEntry(!secureEntry)}
            >
              <Icon
                name={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || loading}
          activeOpacity={0.7}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <>
              <Icon name="logo-google" size={20} color="#ea4335" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Footer nav */}
        <View style={styles.footerNav}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('SignUp')}>
            Create one
          </Text>
        </View>
      </ScrollView>

      {/* Sign In button – sticks to the bottom, above keyboard */}
      <View style={styles.footer}>
        <Button 
          title="Sign In" 
          onPress={handleLogin} 
          size="lg" 
          loading={loading}
          disabled={loading}
        />
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.xl,
  },
  // Brand / Logo
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Form
  formCard: {
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.heading2,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.caption,
    marginBottom: spacing.xxl,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  inputIconBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: colors.textPrimary,
    paddingRight: spacing.lg,
  },
  eyeButton: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  forgotPasswordText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    marginHorizontal: spacing.md,
    color: colors.textTertiary,
  },
  // Google button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainer,
    marginBottom: spacing.md,
  },
  googleIcon: {
    marginRight: spacing.sm,
  },
  googleButtonText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  // Footer
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  footerText: {
    ...typography.caption,
  },
  footerLink: {
    ...typography.captionBold,
    color: colors.primary,
  },
});
