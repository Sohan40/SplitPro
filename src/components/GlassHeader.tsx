import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

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
  const { theme } = useTheme();
  const { colors } = theme;

  const headerBg = theme.dark
    ? 'rgba(12,12,15,0.96)'
    : 'rgba(255,255,255,0.96)';
  const highlightBg = theme.dark
    ? 'rgba(167,139,250,0.05)'
    : 'rgba(124,58,237,0.03)';

  return (
    <View style={[styles.container, { height: height + insets.top, backgroundColor: headerBg, borderBottomColor: colors.borderLight }, style]}>
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: highlightBg }]} />
      <View style={[styles.content, { height }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
