import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { spacing, borderRadius, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { auth } from '../../services/firebase';
import { calculateUserSummary, hasOutstandingBalances } from '../../utils/balanceCalculator';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ProfileScreenProps } from '../../navigation/types';

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [summary, setSummary] = useState({ totalBalance: 0, youOwe: 0, youAreOwed: 0 });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchSummary = async () => {
      try {
        const groups = await groupService.getUserGroups(user.id);
        const data = calculateUserSummary(groups, user.id);
        setSummary(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchSummary();
  }, [user]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your data will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              const groups = await groupService.getUserGroups(user.id);
              const latestSummary = calculateUserSummary(groups, user.id);

              if (hasOutstandingBalances(groups, user.id)) {
                const unsettledDetails: string[] = [];

                if (latestSummary.youOwe > 0.01) {
                  unsettledDetails.push(`you still owe \u20B9${latestSummary.youOwe.toFixed(2)}`);
                }

                if (latestSummary.youAreOwed > 0.01) {
                  unsettledDetails.push(`you are still owed \u20B9${latestSummary.youAreOwed.toFixed(2)}`);
                }

                Alert.alert(
                  'Settle Up Required',
                  `Please settle all balances before deleting your account. Right now ${unsettledDetails.join(' and ')}.`
                );
                return;
              }

              await userService.deleteUser(user.id);
              await auth.currentUser?.delete();
            } catch (error: any) {
              console.error(error);
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Authentication Required',
                  'For security reasons, please log out and log back in before deleting your account.'
                );
              } else {
                Alert.alert('Error', error.message || 'Failed to delete account.');
              }
            }
          }
        },
      ]
    );
  };

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;

    try {
      setUpdating(true);
      await userService.updateUserName(user.id, newName.trim());
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <GlassCard padding="lg" gradientDir="diagonal" style={styles.header}>
        <View style={styles.identityContent}>
          <Avatar name={user?.name || 'User'} size={80} />
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
            <TouchableOpacity
              style={styles.editIcon}
              onPress={() => {
                setNewName(user?.name || '');
                setIsEditModalVisible(true);
              }}
            >
              <Icon name="pencil" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{user?.email}</Text>
        </View>
      </GlassCard>

      <View style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryInner}>
            <Text style={styles.summaryLabel}>Total Balance</Text>
            <Text
              style={[
                styles.summaryAmount,
                { color: summary.totalBalance >= 0 ? colors.primary : colors.owes }
              ]}
            >
              {'\u20B9'}{summary.totalBalance.toFixed(2)}
            </Text>
          </View>
        </GlassCard>
      </View>

      <View style={styles.row}>
        <GlassCard style={[styles.miniCard, { marginRight: spacing.md }]}>
          <View style={styles.miniInner}>
            <Text style={styles.miniLabel}>You are owed</Text>
            <Text style={[styles.miniAmount, { color: colors.owed }]}>{'\u20B9'}{summary.youAreOwed.toFixed(2)}</Text>
          </View>
        </GlassCard>
        <GlassCard style={styles.miniCard}>
          <View style={styles.miniInner}>
            <Text style={styles.miniLabel}>You owe</Text>
            <Text style={[styles.miniAmount, { color: colors.owes }]}>{'\u20B9'}{summary.youOwe.toFixed(2)}</Text>
          </View>
        </GlassCard>
      </View>

      <GlassCard padding="none" style={styles.menu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
          <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
            <Icon name="settings-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>Settings</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(245,158,11,0.14)' }]}>
            <Icon name="log-out-outline" size={20} color={colors.warning} />
          </View>
          <Text style={[styles.menuText, { color: colors.warning }]}>Logout</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, styles.menuItemLast]} onPress={handleDeleteAccount}>
          <View style={[styles.menuIcon, { backgroundColor: colors.owesLight }]}>
            <Icon name="trash-outline" size={20} color={colors.owes} />
          </View>
          <Text style={[styles.menuText, { color: colors.owes }]}>Delete Account</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </GlassCard>

      <Text style={styles.version}>SplitPro v1.0.0</Text>

      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalContent} padding="lg" gradientDir="diagonal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Profile</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Display Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholderTextColor={colors.textTertiary}
            />

            <Button
              title={updating ? 'Updating...' : 'Save Changes'}
              onPress={handleUpdateName}
              loading={updating}
              disabled={updating}
            />
          </GlassCard>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  identityContent: {
    alignItems: 'center',
    width: '100%',
  },
  userName: {
    ...typography.heading2,
    textAlign: 'center',
    maxWidth: '78%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: spacing.md,
  },
  editIcon: {
    marginLeft: spacing.xs,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userEmail: {
    ...typography.caption,
    marginTop: 2,
    maxWidth: '100%',
    textAlign: 'center',
  },
  summaryGrid: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    paddingVertical: spacing.lg,
  },
  summaryInner: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  summaryAmount: {
    ...typography.heading1,
  },
  row: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  miniCard: {
    flex: 1,
  },
  miniInner: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  miniLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  miniAmount: {
    ...typography.bodyBold,
  },
  menu: {
    marginTop: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuText: {
    flex: 1,
    ...typography.bodyBold,
  },
  version: {
    textAlign: 'center',
    ...typography.caption,
    marginTop: spacing.huge,
    color: colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.heading3,
  },
  modalLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.body,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
