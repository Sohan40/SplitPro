import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import Button from '../../components/Button';
import type { SignUpScreenProps } from '../../navigation/types';
import { auth } from '../../services/firebase';
import { userService } from '../../services/userService';

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      
      // Update Firebase Auth profile
      await userCredential.user.updateProfile({
        displayName: name,
      });

      // Save to Firestore
      await userService.saveUser({
        id: userCredential.user.uid,
        name,
        email: email.toLowerCase(),
        photoUrl: null,
        createdAt: Date.now(),
      });

      // Navigation will be handled automatically by AuthContext + App.tsx
    } catch (error: any) {
      console.error(error);
      Alert.alert('Sign Up Failed', error.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Image 
          source={require('../../../assets/images/logo.png')} 
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>SplitPro</Text>
        <Text style={styles.subtitle}>Start splitting expenses today</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
          />
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
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <Button 
            title="Create Account" 
            onPress={handleSignUp} 
            size="lg" 
            loading={loading}
            disabled={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Text
            style={styles.footerLink}
            onPress={() => navigation.goBack()}>
            Sign in
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.huge,
  },
  logoImage: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  logoText: {
    ...typography.heading1,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.huge,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
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
});
