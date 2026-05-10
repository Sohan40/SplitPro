import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from './theme';

interface GlassHeaderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

export default function GlassHeader({
  children,
  style,
  height = 56,
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { height: height + insets.top }, style]}>
      <View pointerEvents="none" style={styles.highlight} />
      <View style={[styles.content, { height }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'rgba(12,12,15,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(167,139,250,0.05)',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
});
