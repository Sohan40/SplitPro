import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { auth } from '../../services/firebase';
import { calculateUserSummary } from '../../utils/balanceCalculator';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState({ totalBalance: 0, youOwe: 0, youAreOwed: 0 });

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
              // Delete from Firestore
              await userService.deleteUser(user.id);
              // Delete from Firebase Auth
              await auth.currentUser?.delete();
              // The AuthContext onAuthStateChanged will handle navigating back to login
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Avatar name={user?.name || 'User'} size={80} />
        <Text style={styles.userName}>{user?.name}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Balance</Text>
          <Text style={[
            styles.summaryAmount, 
            { color: summary.totalBalance >= 0 ? colors.primary : colors.owes }
          ]}>
            ₹{summary.totalBalance.toFixed(2)}
          </Text>
        </Card>
      </View>

      <View style={styles.row}>
        <Card style={[styles.miniCard, { marginRight: spacing.md }]}>
          <Text style={styles.miniLabel}>You are owed</Text>
          <Text style={[styles.miniAmount, { color: colors.owed }]}>₹{summary.youAreOwed.toFixed(2)}</Text>
        </Card>
        <Card style={styles.miniCard}>
          <Text style={styles.miniLabel}>You owe</Text>
          <Text style={[styles.miniAmount, { color: colors.owes }]}>₹{summary.youOwe.toFixed(2)}</Text>
        </Card>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
            <Icon name="settings-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>Settings</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={[styles.menuIcon, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="log-out-outline" size={20} color="#D97706" />
          </View>
          <Text style={[styles.menuText, { color: '#D97706' }]}>Logout</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
          <View style={[styles.menuIcon, { backgroundColor: '#FEE2E2' }]}>
            <Icon name="trash-outline" size={20} color={colors.owes} />
          </View>
          <Text style={[styles.menuText, { color: colors.owes }]}>Delete Account</Text>
          <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>SplitPro v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.xxl,
  },
  userName: {
    ...typography.heading2,
    marginTop: spacing.md,
  },
  userEmail: {
    ...typography.caption,
    marginTop: 2,
  },
  summaryGrid: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
});
