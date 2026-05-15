import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { userService } from '../../services/userService';
import { groupService } from '../../services/groupService';
import type { GroupMember } from '../../models/Group';
import type { CreateGroupScreenProps } from '../../navigation/types';
import type { CurrencyCode } from '../../utils/currency';
import Avatar from '../../components/Avatar';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  AuthInput,
  AuthPrimaryButton,
  type AuthPalette,
  useAuthPalette,
} from '../auth/AuthScreenPrimitives';

export default function CreateGroupScreen({ navigation }: CreateGroupScreenProps) {
  const { user } = useAuth();
  const { currency, options: currencyOptions } = useCurrency();
  const { palette, isDark } = useAuthPalette();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const scrollRef = useRef<ScrollView | null>(null);
  const memberSectionY = useRef(0);
  const memberInputFocused = useRef(false);
  const [groupName, setGroupName] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(currency);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>(
    user ? [{ uid: user.id, name: user.name, email: user.email, photoUrl: user.photoUrl || null }] : []
  );
  const selectedCurrencyOption = useMemo(
    () => currencyOptions.find(option => option.code === selectedCurrency) || currencyOptions[0],
    [currencyOptions, selectedCurrency],
  );
  const contentBottomPadding = keyboardInset > 0 ? keyboardInset + 140 : 32;

  const scrollMemberInputIntoView = useCallback(() => {
    const targetY = Math.max(memberSectionY.current - 72, 0);

    [80, 220, 420].forEach(delay => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
      }, delay);
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, event => {
      setKeyboardInset(event.endCoordinates.height);
      if (memberInputFocused.current) {
        scrollMemberInputIntoView();
      }
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
      memberInputFocused.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollMemberInputIntoView]);

  const handleAddMember = async () => {
    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail) return;
    
    if (normalizedEmail === user?.email.toLowerCase()) {
      Alert.alert('Info', 'You are already in the group.');
      setEmailInput('');
      return;
    }

    if (members.some(m => m.email.toLowerCase() === normalizedEmail)) {
      Alert.alert('Info', 'User is already added.');
      setEmailInput('');
      return;
    }

    try {
      const foundUser = await userService.getUserByEmail(normalizedEmail);
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
        currency: selectedCurrency,
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={palette.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        style={styles.keyboardView}>
        <ScrollView
          alwaysBounceVertical={false}
          bounces={false}
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: contentBottomPadding },
          ]}
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
          overScrollMode="never"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.heroTitle}>
              Create{'\n'}
              <Text style={styles.heroAccent}>Group</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <AuthInput
              autoFocus
              iconName="people-outline"
              onChangeText={setGroupName}
              placeholder="Group name"
              returnKeyType="next"
              value={groupName}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Currency</Text>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => setCurrencyDropdownOpen(value => !value)}
                style={styles.dropdownButton}>
                <View style={styles.dropdownIcon}>
                  <Text style={styles.dropdownSymbol}>{selectedCurrencyOption.symbol}</Text>
                </View>
                <View style={styles.dropdownCopy}>
                  <Text style={styles.dropdownCode}>{selectedCurrencyOption.code}</Text>
                  <Text style={styles.dropdownLabel}>{selectedCurrencyOption.label}</Text>
                </View>
                <Icon
                  name={currencyDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.muted}
                />
              </TouchableOpacity>

              {currencyDropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  {currencyOptions.map((option, index) => {
                    const isSelected = selectedCurrency === option.code;
                    const isLast = index === currencyOptions.length - 1;

                    return (
                      <TouchableOpacity
                        key={option.code}
                        activeOpacity={0.75}
                        onPress={() => {
                          setSelectedCurrency(option.code);
                          setCurrencyDropdownOpen(false);
                        }}
                        style={[
                          styles.dropdownItem,
                          !isLast && styles.dropdownDivider,
                          !isLast && { borderBottomColor: palette.border },
                        ]}>
                        <Text style={styles.itemSymbol}>{option.symbol}</Text>
                        <View style={styles.itemCopy}>
                          <Text style={styles.itemCode}>{option.code}</Text>
                          <Text style={styles.itemLabel}>{option.label}</Text>
                        </View>
                        {isSelected ? <Icon name="checkmark-circle" size={20} color={palette.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
              <Text style={styles.lockedHint}>Locked after creation</Text>
            </View>

            <View
              onLayout={event => {
                memberSectionY.current = event.nativeEvent.layout.y;
              }}
              style={styles.fieldBlock}>
              <Text style={styles.label}>Members</Text>
              <View style={styles.memberInputRow}>
                <AuthInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  iconName="mail-outline"
                  onChangeText={setEmailInput}
                  onBlur={() => {
                    memberInputFocused.current = false;
                  }}
                  onFocus={() => {
                    memberInputFocused.current = true;
                    setCurrencyDropdownOpen(false);
                    scrollMemberInputIntoView();
                  }}
                  onSubmitEditing={handleAddMember}
                  placeholder="Friend's email"
                  returnKeyType="done"
                  value={emailInput}
                  wrapperStyle={styles.memberInput}
                />
                <TouchableOpacity activeOpacity={0.8} onPress={handleAddMember} style={styles.addButton}>
                  <Icon name="add" size={25} color={palette.primaryText} />
                </TouchableOpacity>
              </View>

              <View style={styles.membersList}>
                {members.map(member => {
                  const isMe = member.uid === user?.id;
                  return (
                    <View key={member.uid} style={styles.memberRow}>
                      <Avatar name={member.name} size={36} />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {member.name}{isMe ? ' (You)' : ''}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                      </View>
                      {!isMe ? (
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => handleRemoveMember(member.uid)}
                          style={styles.removeButton}>
                          <Icon name="close" size={18} color={palette.muted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <AuthPrimaryButton
              disabled={loading}
              loading={loading}
              onPress={handleCreate}
              style={styles.submitButton}
              title="CREATE GROUP"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (palette: AuthPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  header: {
    marginBottom: 28,
    paddingTop: 8,
  },
  heroTitle: {
    color: palette.inputText,
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 43,
  },
  heroAccent: {
    color: palette.primary,
  },
  form: {
    paddingBottom: 12,
  },
  label: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  fieldBlock: {
    marginBottom: 18,
  },
  dropdownButton: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingHorizontal: 14,
  },
  dropdownIcon: {
    alignItems: 'center',
    backgroundColor: palette.accentSoft,
    borderColor: palette.border,
    borderRadius: 13,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    marginRight: 12,
    width: 38,
  },
  dropdownSymbol: {
    color: palette.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  dropdownCopy: {
    flex: 1,
  },
  dropdownCode: {
    color: palette.inputText,
    fontSize: 15,
    fontWeight: '700',
  },
  dropdownLabel: {
    color: palette.mutedDim,
    fontSize: 12,
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
  },
  dropdownDivider: {
    borderBottomWidth: 1,
  },
  itemSymbol: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '800',
    marginRight: 12,
    textAlign: 'center',
    width: 26,
  },
  itemCopy: {
    flex: 1,
  },
  itemCode: {
    color: palette.inputText,
    fontSize: 14,
    fontWeight: '700',
  },
  itemLabel: {
    color: palette.mutedDim,
    fontSize: 12,
    marginTop: 2,
  },
  lockedHint: {
    color: palette.mutedDim,
    fontSize: 12,
    marginTop: 8,
  },
  memberInputRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  memberInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 14,
    height: 56,
    justifyContent: 'center',
    marginLeft: 10,
    width: 56,
  },
  membersList: {
    marginTop: 14,
  },
  memberRow: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    color: palette.inputText,
    fontSize: 14,
    fontWeight: '700',
  },
  memberEmail: {
    color: palette.mutedDim,
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  submitButton: {
    marginTop: 6,
  },
});
