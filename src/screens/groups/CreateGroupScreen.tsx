import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';
import { groupService } from '../../services/groupService';
import type { GroupMember } from '../../models/Group';
import type { CreateGroupScreenProps } from '../../navigation/types';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Icon from 'react-native-vector-icons/Ionicons';

export default function CreateGroupScreen({ navigation }: CreateGroupScreenProps) {
  const { user } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>(
    user ? [{ uid: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl || null }] : []
  );

  const handleAddMember = async () => {
    if (!emailInput.trim()) return;
    
    if (emailInput.toLowerCase() === user?.email.toLowerCase()) {
      Alert.alert('Info', 'You are already in the group.');
      setEmailInput('');
      return;
    }

    if (members.some(m => m.email === emailInput.toLowerCase())) {
      Alert.alert('Info', 'User is already added.');
      setEmailInput('');
      return;
    }

    try {
      const foundUser = await userService.getUserByEmail(emailInput.trim());
      if (foundUser) {
        setMembers([...members, {
          uid: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          photoUrl: foundUser.photoUrl || null,
        }]);
        setEmailInput('');
      } else {
        Alert.alert('Not Found', 'No user found with that email. Please ensure their profile is in the Firestore Database.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to search for user.');
    }
  };

  const handleRemoveMember = (uid: string) => {
    if (uid === user?.id) return; // Can't remove self
    setMembers(members.filter(m => m.uid !== uid));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const groupId = await groupService.createGroup({
        name: groupName.trim(),
        createdBy: user.id,
        members,
        memberIds: members.map(m => m.uid),
        balances: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Go back to the group list, or jump into the new group
      navigation.replace('GroupDetail', { groupId, groupName: groupName.trim() });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to create group.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="E.g., Apartment, Trip to Bali"
            placeholderTextColor={colors.textTertiary}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Add Members</Text>
          <View style={styles.addMemberRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Friend's email"
              placeholderTextColor={colors.textTertiary}
              value={emailInput}
              onChangeText={setEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={handleAddMember}
            />
            <Button 
              title="Add" 
              onPress={handleAddMember} 
              style={{ marginLeft: spacing.md, height: 52 }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Members ({members.length})</Text>
          {members.map(member => (
            <Card key={member.uid} style={styles.memberCard} padding="sm">
              <View style={styles.memberRow}>
                <Avatar name={member.name} size={32} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name} {member.uid === user?.id ? '(You)' : ''}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                </View>
                {member.uid !== user?.id && (
                  <Icon 
                    name="close-circle" 
                    size={24} 
                    color={colors.textTertiary} 
                    onPress={() => handleRemoveMember(member.uid)}
                  />
                )}
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button 
          title="Create Group" 
          onPress={handleCreate} 
          size="lg" 
          loading={loading} 
        />
      </View>
    </View>
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
  section: {
    marginBottom: spacing.xxl,
  },
  label: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  addMemberRow: {
    flexDirection: 'row',
  },
  memberCard: {
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  memberName: {
    ...typography.bodyBold,
  },
  memberEmail: {
    ...typography.small,
  },
  footer: {
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
