import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, shadows } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { notificationService } from '../../services/notificationService';
import type { Notification } from '../../models/Notification';
import Card from '../../components/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import EmptyState from '../../components/EmptyState';

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = notificationService.subscribeToUserNotifications(user.id, (data) => {
      setNotifications(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
    }

    if (notification.type === 'expense' && notification.data?.groupId && notification.data?.expenseId) {
      // Navigate to the expense
      navigation.navigate('Groups', {
        screen: 'ExpenseDetail',
        params: { groupId: notification.data.groupId, expenseId: notification.data.expenseId }
      });
    } else if (notification.type === 'group_add' && notification.data?.groupId) {
      // Navigate to the group
      navigation.navigate('Groups', {
        screen: 'GroupDetail',
        params: { groupId: notification.data.groupId, groupName: 'Group' }
      });
    }
  };

  const markAllAsRead = async () => {
    if (user) {
      await notificationService.markAllAsRead(user.id);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    return (
      <TouchableOpacity onPress={() => handleNotificationPress(item)} activeOpacity={0.7}>
        <Card style={[styles.card, !item.read && styles.unreadCard]} padding="md">
          <View style={styles.iconContainer}>
            <Icon 
              name={item.type === 'expense' ? 'receipt' : 'people'} 
              size={24} 
              color={!item.read ? colors.primary : colors.textSecondary} 
            />
          </View>
          <View style={styles.contentContainer}>
            <Text style={[styles.title, !item.read && styles.unreadText]}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {!item.read && <View style={styles.unreadDot} />}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some(n => !n.read) ? (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 80 }} />}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState 
              title="All caught up!" 
              message="You have no notifications right now."
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.heading3,
  },
  markReadText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.md,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  unreadCard: {
    backgroundColor: colors.primaryLight,
    borderColor: 'rgba(99, 102, 241, 0.2)', // primary color with low opacity
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  unreadText: {
    color: colors.primary,
  },
  body: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
});
