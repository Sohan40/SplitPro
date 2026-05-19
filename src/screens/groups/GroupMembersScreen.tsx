import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { spacing, borderRadius, shadows, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import type { Group } from '../../models/Group';
import type { GroupMembersScreenProps } from '../../navigation/types';
import GlassCard from '../../components/GlassCard';
import Avatar from '../../components/Avatar';
import BalanceBadge from '../../components/BalanceBadge';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../components/Button';

function getMemberInviteErrorMessage(error: any): string {
  const code = typeof error?.code === 'string' ? error.code : '';

  if (code.includes('unauthenticated')) {
    return 'Your sign-in session expired. Please sign out, sign in again, and try once more.';
  }
  if (code.includes('already-exists')) {
    return 'This user is already a member of the group.';
  }
  if (code.includes('permission-denied')) {
    return "You don't have permission to add members to this group.";
  }
  if (code.includes('not-found')) {
    return 'No user found with this email address.';
  }
  if (code.includes('invalid-argument')) {
    return 'Enter a valid email address.';
  }

  return error?.message || 'Failed to add member.';
}

export default function GroupMembersScreen({ route, navigation }: GroupMembersScreenProps) {
  const { groupId, openAddMember } = route.params;
  const { user } = useAuth();
  const { theme } = useTheme();
  const { currency } = useCurrency();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Add Member State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchGroup = async () => {
    try {
      const data = await groupService.getGroup(groupId);
      setGroup(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = groupService.subscribeToGroup(groupId, (data) => {
      setGroup(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [groupId]);

  useEffect(() => {
    if (!openAddMember) return;

    setIsModalVisible(true);
    navigation.setParams({ openAddMember: false });
  }, [navigation, openAddMember]);

  const handleAddMember = async () => {
    if (!email.trim()) return;
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in again before adding members.');
      return;
    }
    
    try {
      setSearching(true);
      const foundUser = await userService.getUserByEmail(email.trim());
      
      if (!foundUser) {
        Alert.alert('Not Found', 'No user found with this email address.');
        return;
      }

      // Confirm add
      Alert.alert(
        'Add Member',
        `Add ${foundUser.name} to the group?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add',
            onPress: async () => {
              try {
                setAdding(true);
                await groupService.addMemberToGroupByEmail(groupId, foundUser.email);

                Alert.alert('Success', `${foundUser.name} has been added.`);
                setIsModalVisible(false);
                setEmail('');
                fetchGroup(); // Refresh list
              } catch (err: any) {
                Alert.alert('Error', getMemberInviteErrorMessage(err));
              } finally {
                setAdding(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Error', getMemberInviteErrorMessage(error));
    } finally {
      setSearching(false);
    }
  };

  const handleLeaveGroup = () => {
    if (!group || !user) return;
    
    const myBalance = group.balances?.[user.id] || 0;
    
    // Using a tiny epsilon because floating point math can sometimes leave 0.00000000001
    if (Math.abs(myBalance) > 0.01) {
      Alert.alert(
        'Cannot Leave Group',
        'You must settle all your balances (whether you owe or are owed) before you can leave.'
      );
      return;
    }

    Alert.alert(
      'Leave Group',
      group.memberIds.length === 1 
        ? 'You are the last member. Leaving will permanently delete this group. Are you sure?'
        : 'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Leave', 
          style: 'destructive',
          onPress: async () => {
            try {
              if (group.memberIds.length === 1) {
                await groupService.deleteGroup(groupId);
              } else {
                await groupService.removeMemberFromGroup(groupId, user.id);
              }
              navigation.popToTop();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={group?.members || []}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const balance = group?.balances?.[item.uid] || 0;
          const isMe = item.uid === user?.id;
          const displayName = isMe ? user?.name : item.name;
          
          return (
            <GlassCard style={styles.memberCard} padding="md">
              <View style={styles.row}>
                <Avatar name={displayName} size={48} />
                <View style={styles.info}>
                  <Text style={styles.name}>{displayName}{isMe ? ' (You)' : ''}</Text>
                  <Text style={styles.email}>{item.email}</Text>
                </View>
                <BalanceBadge amount={balance} currency={group?.currency || currency} size="sm" />
              </View>
            </GlassCard>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity 
            style={styles.leaveButton} 
            onPress={handleLeaveGroup}
            activeOpacity={0.7}
          >
            <Icon name="exit-outline" size={20} color={colors.owes} />
            <Text style={styles.leaveText}>Leave Group</Text>
          </TouchableOpacity>
        }
      />

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.8}
      >
        <Icon name="person-add" size={24} color={colors.white} />
      </TouchableOpacity>

      {/* Add Member Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Member</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Icon name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Scan QR option */}
            <TouchableOpacity
              style={[styles.qrScanOption, { backgroundColor: colors.primaryLight, borderColor: colors.borderLight }]}
              activeOpacity={0.7}
              onPress={() => {
                setIsModalVisible(false);
                navigation.navigate('ScanQrCode', {
                  groupId,
                  groupName: group?.name || 'Group',
                });
              }}
            >
              <Icon name="qr-code-outline" size={22} color={colors.primary} />
              <View style={styles.qrScanCopy}>
                <Text style={[styles.qrScanTitle, { color: colors.primary }]}>Scan QR Code</Text>
                <Text style={styles.qrScanSubtitle}>Instantly add by scanning their QR</Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textTertiary }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            <Text style={styles.modalLabel}>Enter friend's email address</Text>
            <TextInput
              style={styles.input}
              placeholder="friend@example.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoFocus
            />

            <Button
              title="Search & Add"
              onPress={handleAddMember}
              loading={searching || adding}
              style={styles.modalButton}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.owesLight,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.22)',
    borderRadius: borderRadius.md,
  },
  leaveText: {
    ...typography.bodyBold,
    color: colors.owes,
    marginLeft: spacing.sm,
  },
  list: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  memberCard: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    ...typography.bodyBold,
  },
  email: {
    ...typography.caption,
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%',
    ...shadows.lg,
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
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
  },
  modalButton: {
    marginTop: spacing.sm,
  },
  qrScanOption: {
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  qrScanCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  qrScanTitle: {
    ...typography.bodyBold,
  },
  qrScanSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  orDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: spacing.md,
  },
});
