import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius as themeRadius } from './theme';

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
  glowColor = colors.primary,
  padding = 'md',
}: GlassCardProps) {
  const paddingValues = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 20,
  };
  const pad = paddingValues[padding];
  const backgroundColor = gradientDir === 'diagonal'
    ? `rgba(30,28,40,${Math.min(opacity + 0.1, 0.9)})`
    : `rgba(24,24,27,${opacity})`;

  return (
    <View style={[styles.container, { borderRadius: radius, backgroundColor }, style]}>
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: glowColor }]} />
      <View style={[styles.content, { padding: pad }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.06,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  content: {},
});
