import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  style?: ViewStyle;
}

const AVATAR_COLORS = [
  '#4F46E5', '#7C3AED', '#2563EB', '#0891B2',
  '#059669', '#D97706', '#DC2626', '#DB2777',
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({ name, photoUrl, size = 40, style }: AvatarProps) {
  const bgColor = getColorForName(name);
  const fontSize = size * 0.4;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style as ImageStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
        styles.container,
        style,
      ]}>
      <Text style={[styles.text, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fafafa',
    fontWeight: '600',
  },
});
