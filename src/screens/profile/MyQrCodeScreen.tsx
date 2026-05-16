import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../../components/Avatar';
import GlassCard from '../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { MyQrCodeScreenProps } from '../../navigation/types';
import { qrInviteService } from '../../services/qrInviteService';
import { AuthBackground } from '../auth/AuthScreenPrimitives';

const QR_PREFIX = 'splitpro://user-invite/';

export default function MyQrCodeScreen(_props: MyQrCodeScreenProps) {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await qrInviteService.createToken();
      setToken(result.token);
      setExpiresAt(new Date(result.expiresAt).getTime());
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR code. Please try again.');
      setToken(null);
      setExpiresAt(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate token on mount
  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const tick = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        setToken(null);
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  const qrValue = token ? `${QR_PREFIX}${token}` : '';
  const qrForeground = isDark ? '#fafafa' : '#1a1a2e';
  const qrBackground = isDark ? '#18181b' : '#ffffff';

  return (
    <View style={styles.container}>
      <AuthBackground>
        <View style={styles.content}>
          {/* Identity */}
          <View style={styles.identityRow}>
            <Avatar name={user?.name || 'User'} size={48} />
            <View style={styles.identityCopy}>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email || ''}</Text>
            </View>
          </View>

          {/* QR Card */}
          <GlassCard style={styles.qrCard} padding="lg">
            {loading ? (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Generating QR code…</Text>
              </View>
            ) : error ? (
              <View style={styles.qrPlaceholder}>
                <Icon name="alert-circle-outline" size={48} color={colors.owes} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={generateToken} activeOpacity={0.7}>
                  <Icon name="refresh-outline" size={18} color={colors.primary} />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : token ? (
              <View style={styles.qrContainer}>
                <View style={[styles.qrFrame, { backgroundColor: qrBackground }]}>
                  <QRCode
                    value={qrValue}
                    size={200}
                    color={qrForeground}
                    backgroundColor={qrBackground}
                  />
                </View>

                {/* Timer */}
                <View style={styles.timerRow}>
                  <Icon name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.timerText}>Valid for {remaining}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Icon name="qr-code-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.expiredText}>QR code expired</Text>
                <TouchableOpacity style={styles.retryButton} onPress={generateToken} activeOpacity={0.7}>
                  <Icon name="refresh-outline" size={18} color={colors.primary} />
                  <Text style={styles.retryText}>Generate New</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassCard>

          {/* Regenerate button */}
          {token && (
            <TouchableOpacity
              style={[styles.regenerateButton, { backgroundColor: colors.primaryLight, borderColor: colors.borderLight }]}
              onPress={generateToken}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Icon name="refresh-outline" size={18} color={colors.primary} />
              <Text style={[styles.regenerateText, { color: colors.primary }]}>Regenerate</Text>
            </TouchableOpacity>
          )}

          {/* Instructions */}
          <Text style={styles.instructions}>
            Show this QR code to a group member. They can scan it from the
            group's member list to add you instantly.
          </Text>
        </View>
      </AuthBackground>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  identityCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    ...typography.heading3,
  },
  userEmail: {
    ...typography.caption,
    marginTop: 2,
  },
  qrCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrFrame: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.owes,
    textAlign: 'center',
    maxWidth: 220,
  },
  expiredText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
  },
  retryText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  timerText: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xxl,
  },
  regenerateText: {
    ...typography.bodyBold,
  },
  instructions: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
});
