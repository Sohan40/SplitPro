import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LoginScreenProps } from '../../navigation/types';
import { auth } from '../../services/firebase';
import { signInWithGoogle } from '../../services/googleAuthService';
import {
  AuthBackground,
  AuthFooterLink,
  AuthGoogleButton,
  AuthHeader,
  AuthInput,
  AuthPrimaryButton,
  type AuthPalette,
  useAuthPalette,
} from './AuthScreenPrimitives';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { palette } = useAuthPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
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
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.signInWithEmailAndPassword(normalizedEmail, password);
      const firebaseUser = userCredential.user;

      await firebaseUser.reload();

      if (!firebaseUser.emailVerified) {
        await firebaseUser.sendEmailVerification();
        await auth.signOut();
        Alert.alert(
          'Email Not Verified',
          'Please verify your email address before signing in. We sent a new verification link to your inbox.',
        );
        return;
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Login Failed', error.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert('Email Required', 'Please enter your email address first to reset your password.');
      return;
    }

    try {
      await auth.sendPasswordResetEmail(normalizedEmail);
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
    } catch (error: any) {
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
      <StatusBar barStyle="light-content" backgroundColor={palette.background} />
      <AuthBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View>
            <AuthHeader title="Welcome" accent="Back!" />

            <View style={styles.form}>
              <AuthInput
                autoCapitalize="none"
                autoComplete="email"
                iconName="mail-outline"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email Address"
                textContentType="emailAddress"
                value={email}
              />
              <AuthInput
                iconName="lock-closed-outline"
                onChangeText={setPassword}
                onRightPress={() => setSecureEntry((value) => !value)}
                placeholder="Password"
                rightIconName={secureEntry ? 'eye-off-outline' : 'eye-outline'}
                secureTextEntry={secureEntry}
                textContentType="password"
                value={password}
              />

              <AuthPrimaryButton
                disabled={loading || googleLoading}
                loading={loading}
                onPress={handleLogin}
                style={styles.submitButton}
                title="LOG IN"
              />

              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <AuthGoogleButton
              disabled={loading || googleLoading}
              loading={googleLoading}
              onPress={handleGoogleSignIn}
            />
          </View>

          <AuthFooterLink
            linkText="Sign up"
            onPress={() => navigation.navigate('SignUp')}
            text="Don't have an account?"
          />
        </ScrollView>
      </AuthBackground>
    </Animated.View>
  );
}

const createStyles = (palette: AuthPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  form: {
    marginBottom: 6,
  },
  submitButton: {
    marginTop: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: palette.muted,
    fontSize: 14,
    textDecorationColor: palette.border,
    textDecorationLine: 'underline',
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    color: palette.mutedDim,
    fontSize: 13,
    marginHorizontal: 14,
  },
});
