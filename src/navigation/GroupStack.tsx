import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import GroupListScreen from '../screens/groups/GroupListScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import SettleUpScreen from '../screens/groups/SettleUpScreen';
import GroupMembersScreen from '../screens/groups/GroupMembersScreen';
import SpendAnalysisScreen from '../screens/analytics/SpendAnalysisScreen';
import UpgradeScreen from '../screens/upgrade/UpgradeScreen';
import type { GroupStackParamList } from './types';

const Stack = createNativeStackNavigator<GroupStackParamList>();

export default function GroupStack() {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
        headerShadowVisible: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="GroupList" component={GroupListScreen} options={{ title: 'Groups' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'New Group' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={({ route }) => ({ title: route.params.groupName })} />
      <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add Expense' }} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Expense Details' }} />
      <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ title: 'Settle Up' }} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: 'Group Members' }} />
      <Stack.Screen name="SpendAnalysis" component={SpendAnalysisScreen} options={{ title: 'Spend Analysis' }} />
      <Stack.Screen name="UpgradeAi" component={UpgradeScreen} options={{ title: 'SplitPro AI' }} />
    </Stack.Navigator>
  );
}
