import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

// Group Stack (nested in Groups tab)
export type GroupStackParamList = {
  GroupList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  GroupMembers: { groupId: string };
  AddExpense: { groupId: string; groupName: string; expenseId?: string };
  ExpenseDetail: { groupId: string; expenseId: string };
  SettleUp: { groupId: string; groupName: string };
  SpendAnalysis: { groupId: string; groupName: string; monthKey?: string };
  UpgradeAi: undefined;
};

// Profile Stack (nested in Profile tab)
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Groups: NavigatorScreenParams<GroupStackParamList>;
  Activity: undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Screen prop types
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type GroupListScreenProps = NativeStackScreenProps<GroupStackParamList, 'GroupList'>;
export type CreateGroupScreenProps = NativeStackScreenProps<GroupStackParamList, 'CreateGroup'>;
export type GroupDetailScreenProps = NativeStackScreenProps<GroupStackParamList, 'GroupDetail'>;
export type AddExpenseScreenProps = NativeStackScreenProps<GroupStackParamList, 'AddExpense'>;
export type ExpenseDetailScreenProps = NativeStackScreenProps<GroupStackParamList, 'ExpenseDetail'>;
export type SettleUpScreenProps = NativeStackScreenProps<GroupStackParamList, 'SettleUp'>;
export type SpendAnalysisScreenProps = NativeStackScreenProps<GroupStackParamList, 'SpendAnalysis'>;
export type UpgradeScreenProps = NativeStackScreenProps<GroupStackParamList, 'UpgradeAi'>;

export type ActivityScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Activity'>,
  NativeStackScreenProps<RootStackParamList>
>;

export type ProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;
export type SettingsScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Settings'>;
