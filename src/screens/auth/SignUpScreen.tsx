import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import type { SignUpScreenProps } from '../../navigation/types';
import { auth } from '../../services/firebase';
import { userService } from '../../services/userService';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
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
    <Animated.View style={[styles.container, { paddingBottom: keyboardAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

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
          <Text style={styles.subtitle}>Start splitting expenses today</Text>
        </View>

        {/* Form Card */}
        <GlassCard padding="lg" gradientDir="diagonal" style={styles.formCard}>
          <Text style={styles.formTitle}>Create Account</Text>
          <Text style={styles.formSubtitle}>Join SplitPro and simplify your splits</Text>

          {/* Name Input */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconBox}>
              <Icon name="person-outline" size={18} color={colors.textTertiary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </View>

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

          {/* Confirm Password Input */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconBox}>
              <Icon name="shield-checkmark-outline" size={18} color={colors.textTertiary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={secureConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setSecureConfirm(!secureConfirm)}
            >
              <Icon
                name={secureConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Footer nav */}
        <View style={styles.footerNav}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Text
            style={styles.footerLink}
            onPress={() => navigation.goBack()}>
            Sign in
          </Text>
        </View>
      </ScrollView>

      {/* Create Account button – sticks to the bottom, above keyboard */}
      <View style={styles.footer}>
        <Button 
          title="Create Account" 
          onPress={handleSignUp} 
          size="lg" 
          loading={loading}
          disabled={loading}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  // Brand / Logo
  brandSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  logoText: {
    fontSize: 28,
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
