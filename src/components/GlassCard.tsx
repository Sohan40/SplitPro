import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius as themeRadius } from './theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
  gradientDir?: 'top' | 'diagonal';
  radius?: number;
  glowColor?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function GlassCard({
  children,
  style,
  opacity = 0.55,
  gradientDir = 'top',
  radius = themeRadius.xl,
  glowColor,
  padding = 'md',
}: GlassCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const paddingValues = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 20,
  };
  const pad = paddingValues[padding];
  const glow = glowColor || colors.primary;

  const backgroundColor = gradientDir === 'diagonal'
    ? colors.glassDiagonal
    : colors.glassBackground.replace(/[\d.]+\)$/u, `${opacity})`);

  return (
    <View style={[styles.container, { borderRadius: radius, backgroundColor, borderColor: colors.borderLight }, style]}>
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: glow, opacity: colors.glassHighlight, borderTopColor: colors.glassBorderTop }]} />
      <View style={[styles.content, { padding: pad }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
  },
  content: {},
});
