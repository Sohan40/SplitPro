import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useCameraPermission,
} from 'react-native-vision-camera';
import { CodeScanner, type Barcode } from 'react-native-vision-camera-barcode-scanner';
import Icon from 'react-native-vector-icons/Ionicons';
import GlassCard from '../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import type { ScanQrScreenProps } from '../../navigation/types';
import { qrInviteService } from '../../services/qrInviteService';

const QR_PREFIX = 'splitpro://user-invite/';

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'resolving'; token: string }
  | { kind: 'confirming'; token: string; uid: string; displayName: string; email: string }
  | { kind: 'adding'; token: string; displayName: string }
  | { kind: 'success'; displayName: string }
  | { kind: 'error'; message: string };

export default function ScanQrScreen({ route, navigation }: ScanQrScreenProps) {
  const { groupId, groupName, mode = 'addToGroup' } = route.params;
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  const { hasPermission, requestPermission } = useCameraPermission();

  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  const processedRef = useRef(false);

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCodeScanned = useCallback(
    async (token: string) => {
      if (processedRef.current) return;
      processedRef.current = true;

      setState({ kind: 'resolving', token });

      try {
        const resolved = await qrInviteService.resolveToken(token);
        setState({
          kind: 'confirming',
          token,
          uid: resolved.uid,
          displayName: resolved.displayName,
          email: resolved.email,
        });
      } catch (err: any) {
        const msg = mapErrorMessage(err);
        setState({ kind: 'error', message: msg });
      }
    },
    [],
  );

  const onBarcodeScanned = useCallback((barcodes: Barcode[]) => {
    if (processedRef.current) return;
    const code = barcodes[0];
    if (!code?.rawValue) return;

    const value = code.rawValue;
    if (!value.startsWith(QR_PREFIX)) {
      processedRef.current = true;
      setState({ kind: 'error', message: 'This QR code is not a SplitPro invite.' });
      return;
    }

    const token = value.slice(QR_PREFIX.length).trim();
    if (!token) {
      processedRef.current = true;
      setState({ kind: 'error', message: 'Invalid QR code format.' });
      return;
    }

    handleCodeScanned(token);
  }, [handleCodeScanned]);

  const handleConfirm = useCallback(async () => {
    if (state.kind !== 'confirming') return;
    const { token, uid, displayName, email } = state;

    if (mode === 'pickMember') {
      setState({ kind: 'success', displayName });
      setTimeout(() => {
        navigation.navigate('CreateGroup', {
          scannedAt: Date.now(),
          scannedMember: {
            uid,
            name: displayName,
            email,
            photoUrl: null,
          },
        });
      }, 600);
      return;
    }

    if (!groupId) {
      setState({ kind: 'error', message: 'Group details are missing. Please go back and try again.' });
      return;
    }

    setState({ kind: 'adding', token, displayName });

    try {
      await qrInviteService.addMemberByToken(token, groupId);
      setState({ kind: 'success', displayName });

      // Auto-navigate back after a short delay
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (err: any) {
      const msg = mapErrorMessage(err);
      setState({ kind: 'error', message: msg });
    }
  }, [state, groupId, mode, navigation]);

  const handleCancel = useCallback(() => {
    processedRef.current = false;
    setState({ kind: 'scanning' });
  }, []);

  const handleRetry = useCallback(() => {
    processedRef.current = false;
    setState({ kind: 'scanning' });
  }, []);

  // ── Permission denied state ──
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Icon name="camera-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionBody}>
            To scan QR codes, SplitPro needs access to your camera.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (Platform.OS === 'android') {
                requestPermission();
              } else {
                Linking.openSettings();
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.permissionButtonText}>
              {Platform.OS === 'android' ? 'Grant Permission' : 'Open Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }


  const isScanning = state.kind === 'scanning';
  const showOverlay = state.kind !== 'scanning';

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CodeScanner
        style={StyleSheet.absoluteFill}
        isActive={isScanning}
        barcodeFormats={['qr-code']}
        onBarcodeScanned={onBarcodeScanned}
        onError={(error: Error) => {
          if (!processedRef.current) {
            processedRef.current = true;
            setState({ kind: 'error', message: error.message || 'Error scanning QR code' });
          }
        }}
      />

      {/* Scanner overlay */}
      {isScanning && (
        <View style={styles.scannerOverlay} pointerEvents="none">
          <View style={styles.scannerFrame}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />
          </View>
          <Text style={styles.scanInstruction}>
            Point at a SplitPro QR code
          </Text>
        </View>
      )}

      {/* Result overlay */}
      {showOverlay && (
        <View style={styles.resultOverlay}>
          {state.kind === 'resolving' && (
            <GlassCard style={styles.resultCard} padding="lg">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.resultText}>Looking up user…</Text>
            </GlassCard>
          )}

          {state.kind === 'confirming' && (
            <GlassCard style={styles.resultCard} padding="lg">
              <Icon name="person-add-outline" size={40} color={colors.primary} />
              <Text style={styles.confirmTitle}>
                {mode === 'pickMember' ? 'Add to pending group?' : `Add to ${groupName}?`}
              </Text>
              <Text style={styles.confirmName}>{state.displayName}</Text>
              {state.email ? (
                <Text style={styles.confirmEmail}>{state.email}</Text>
              ) : null}
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.addButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirm}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addButtonText}>Add Member</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          )}

          {state.kind === 'adding' && (
            <GlassCard style={styles.resultCard} padding="lg">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.resultText}>Adding {state.displayName}…</Text>
            </GlassCard>
          )}

          {state.kind === 'success' && (
            <GlassCard style={styles.resultCard} padding="lg">
              <Icon name="checkmark-circle" size={56} color={colors.owed} />
              <Text style={styles.successTitle}>Member Added!</Text>
              <Text style={styles.resultText}>
                {mode === 'pickMember'
                  ? `${state.displayName} is ready to add.`
                  : `${state.displayName} has been added to ${groupName}.`}
              </Text>
            </GlassCard>
          )}

          {state.kind === 'error' && (
            <GlassCard style={styles.resultCard} padding="lg">
              <Icon name="alert-circle" size={48} color={colors.owes} />
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorBody}>{state.message}</Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.retryBtn, { backgroundColor: colors.primaryLight, borderColor: colors.borderLight }]}
                onPress={handleRetry}
                activeOpacity={0.7}
              >
                <Icon name="refresh-outline" size={18} color={colors.primary} />
                <Text style={[styles.retryBtnText, { color: colors.primary }]}>Scan Again</Text>
              </TouchableOpacity>
            </GlassCard>
          )}
        </View>
      )}
    </View>
  );
}

function mapErrorMessage(err: any): string {
  const code = err?.code || '';
  const message = err?.message || '';

  if (code.includes('not-found') || message.includes('invalid or has expired')) {
    return 'This QR code is invalid or has expired. Ask the user to generate a new one.';
  }
  if (code.includes('failed-precondition') || message.includes('expired')) {
    return 'This QR code has expired. Ask the user to generate a new one.';
  }
  if (code.includes('already-exists') || message.includes('already a member')) {
    return 'This user is already a member of the group.';
  }
  if (code.includes('permission-denied')) {
    return 'You don\'t have permission to add members to this group.';
  }
  if (message.includes('network') || message.includes('Network')) {
    return 'Connection error. Please check your network and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}

const FRAME_SIZE = 240;
const CORNER_SIZE = 32;
const CORNER_THICKNESS = 4;

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  permissionTitle: {
    ...typography.heading3,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  permissionBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  permissionButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },

  // Scanner
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: borderRadius.sm,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: borderRadius.sm,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: borderRadius.sm,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: borderRadius.sm,
  },
  scanInstruction: {
    ...typography.bodyBold,
    color: '#fff',
    textAlign: 'center',
    marginTop: spacing.xxl,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Result overlays
  resultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  resultCard: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Confirm
  confirmTitle: {
    ...typography.heading3,
    textAlign: 'center',
  },
  confirmName: {
    ...typography.heading2,
    color: colors.primary,
    textAlign: 'center',
  },
  confirmEmail: {
    ...typography.caption,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    ...typography.bodyBold,
  },
  addButton: {},
  addButtonText: {
    ...typography.bodyBold,
    color: '#fff',
  },

  // Success
  successTitle: {
    ...typography.heading2,
    color: colors.owed,
    textAlign: 'center',
  },

  // Error
  errorTitle: {
    ...typography.heading3,
    color: colors.owes,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    marginTop: spacing.sm,
    flex: 0,
    paddingHorizontal: spacing.xxl,
  },
  retryBtnText: {
    ...typography.bodyBold,
  },
});
