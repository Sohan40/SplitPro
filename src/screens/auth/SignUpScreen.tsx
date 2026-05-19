import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SignUpScreenProps } from '../../navigation/types';
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

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { palette } = useAuthPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);

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

  const handleSignUp = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedName || !normalizedEmail || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(normalizedEmail, password);

      await userCredential.user.updateProfile({
        displayName: trimmedName,
      });

      await userCredential.user.sendEmailVerification();
      await auth.signOut();

      Alert.alert(
        'Verify Your Email',
        'We sent a verification link to your email address. Please verify it, then sign in.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
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
            <AuthHeader title="Create" accent="Account!" compact />

            <View style={styles.form}>
              <AuthInput
                autoCapitalize="words"
                iconName="person-outline"
                onChangeText={setName}
                placeholder="Full Name"
                textContentType="name"
                value={name}
              />
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
                textContentType="newPassword"
                value={password}
              />
              <AuthInput
                iconName="shield-checkmark-outline"
                onChangeText={setConfirmPassword}
                onRightPress={() => setSecureConfirm((value) => !value)}
                placeholder="Confirm Password"
                rightIconName={secureConfirm ? 'eye-off-outline' : 'eye-outline'}
                secureTextEntry={secureConfirm}
                textContentType="newPassword"
                value={confirmPassword}
              />

              <Text style={styles.helperText}>
                We will send a verification link before your account is activated.
              </Text>

              <AuthPrimaryButton
                disabled={loading || googleLoading}
                loading={loading}
                onPress={handleSignUp}
                style={styles.submitButton}
                title="SIGN UP"
              />
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
            linkText="Log in"
            onPress={() => navigation.goBack()}
            text="Already have an account?"
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  form: {
    marginBottom: 4,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  submitButton: {
    marginTop: 2,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 18,
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
