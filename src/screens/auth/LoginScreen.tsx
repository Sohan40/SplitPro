import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import type { LoginScreenProps } from '../../navigation/types';
import { auth } from '../../services/firebase';

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Image 
          source={require('../../../assets/images/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>SplitPro</Text>
        <Text style={styles.subtitle}>Split expenses with friends</Text>

        <GlassCard padding="lg" gradientDir="diagonal">
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button 
            title="Sign In" 
            onPress={handleLogin} 
            size="lg" 
            loading={loading}
            disabled={loading}
          />
          
          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text
            style={styles.footerLink}
            onPress={() => navigation.navigate('SignUp')}>
            Create one
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  logoImage: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  logoText: {
    ...typography.amountLarge,
    color: colors.primary,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.huge,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  footer: {
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
  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  forgotPasswordText: {
    ...typography.caption,
    color: colors.primary,
  },
});
