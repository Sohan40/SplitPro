import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import GlassCard from '../../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../../components/theme';
import { useTheme } from '../../../context/ThemeContext';

export type CategoryDonutItem = {
  id: string;
  label: string;
  amount: number;
  percentage: number;
  expenseCount: number;
  color: string;
};

type CategoryDonutChartProps = {
  items: CategoryDonutItem[];
  totalAmount: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  formatAmount: (amount: number) => string;
};

type DonutSegment = CategoryDonutItem & {
  path: string;
};

const CHART_SIZE = 204;
const CENTER = CHART_SIZE / 2;
const OUTER_RADIUS = 88;
const INNER_RADIUS = 66;

function polarToCartesian(radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: CENTER + radius * Math.cos(angleInRadians),
    y: CENTER + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(startAngle: number, endAngle: number): string {
  const safeEndAngle = Math.min(endAngle, startAngle + 359.99);
  const largeArcFlag = safeEndAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polarToCartesian(OUTER_RADIUS, startAngle);
  const outerEnd = polarToCartesian(OUTER_RADIUS, safeEndAngle);
  const innerEnd = polarToCartesian(INNER_RADIUS, safeEndAngle);
  const innerStart = polarToCartesian(INNER_RADIUS, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function CategoryDonutChart({
  items,
  totalAmount,
  selectedId,
  onSelect,
  formatAmount,
}: CategoryDonutChartProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const total = Math.max(items.reduce((sum, item) => sum + item.amount, 0), 1);
  const selectedItem = items.find(item => item.id === selectedId) || items[0];
  const segments = useMemo<DonutSegment[]>(() => {
    const gap = items.length > 1 ? 1.4 : 0;
    let currentAngle = 0;

    return items.map(item => {
      const sweep = (item.amount / total) * 360;
      const startAngle = currentAngle + (sweep > gap * 2 ? gap / 2 : 0);
      const endAngle = currentAngle + sweep - (sweep > gap * 2 ? gap / 2 : 0);
      currentAngle += sweep;

      return {
        ...item,
        path: describeDonutSegment(startAngle, Math.max(endAngle, startAngle + 0.1)),
      };
    });
  }, [items, total]);

  if (items.length === 0 || totalAmount <= 0) {
    return null;
  }

  return (
    <GlassCard style={styles.card} padding="md" opacity={0.7} radius={borderRadius.lg}>
      <View style={styles.chartArea}>
        <View style={styles.chartWrap}>
          <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={(OUTER_RADIUS + INNER_RADIUS) / 2}
              stroke={colors.surfaceContainerHighest}
              strokeWidth={OUTER_RADIUS - INNER_RADIUS}
              fill="transparent"
            />
            {segments.map(segment => {
              const isSelected = segment.id === selectedItem?.id;
              return (
                <Path
                  key={segment.id}
                  d={segment.path}
                  fill={segment.color}
                  opacity={isSelected ? 0.98 : 0.6}
                  stroke={isSelected ? colors.surface : colors.background}
                  strokeWidth={isSelected ? 1.5 : 1}
                  onPress={() => onSelect(segment.id)}
                />
              );
            })}
          </Svg>
          <View pointerEvents="none" style={styles.centerOverlay}>
            <Text
              style={styles.centerAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {formatAmount(totalAmount)}
            </Text>
            <Text style={styles.centerLabel} numberOfLines={1}>
              Total spend
            </Text>
          </View>
        </View>
      </View>

      {selectedItem ? (
        <View style={styles.detailPanel}>
          <View style={styles.detailLeft}>
            <View style={[styles.detailDot, { backgroundColor: selectedItem.color }]} />
            <View style={styles.detailCopy}>
              <Text style={styles.detailTitle} numberOfLines={1}>{selectedItem.label}</Text>
              {selectedItem.expenseCount > 0 ? (
                <Text style={styles.detailMeta} numberOfLines={1}>
                  {selectedItem.expenseCount} {selectedItem.expenseCount === 1 ? 'expense' : 'expenses'}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.detailRight}>
            <Text
              style={styles.detailAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {formatAmount(selectedItem.amount)}
            </Text>
            <Text style={styles.detailPercent}>{selectedItem.percentage}% of spend</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.legend}>
        {items.map(item => {
          const isSelected = item.id === selectedItem?.id;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(item.id)}
              style={[styles.legendRow, isSelected ? styles.legendRowSelected : null]}
            >
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{item.label}</Text>
              <Text
                style={styles.legendAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {formatAmount(item.amount)}
              </Text>
              <View style={styles.percentPill}>
                <Text style={styles.percentText} numberOfLines={1}>{item.percentage}%</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </GlassCard>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  chartArea: {
    alignItems: 'center',
  },
  chartWrap: {
    width: CHART_SIZE,
    height: CHART_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  centerAmount: {
    ...typography.heading3,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  centerLabel: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  detailPanel: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  detailLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailDot: {
    width: 9,
    height: 9,
    borderRadius: borderRadius.full,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
  },
  detailTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    lineHeight: 19,
  },
  detailMeta: {
    ...typography.small,
    marginTop: 1,
  },
  detailRight: {
    width: 124,
    alignItems: 'flex-end',
  },
  detailAmount: {
    ...typography.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'right',
    includeFontPadding: false,
  },
  detailPercent: {
    ...typography.small,
    marginTop: 1,
    textAlign: 'right',
  },
  legend: {
    gap: 2,
  },
  legendRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  legendRowSelected: {
    borderColor: colors.borderLight,
    backgroundColor: colors.glassHighlight > 0.05 ? 'rgba(167,139,250,0.08)' : 'rgba(124,58,237,0.05)',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  legendLabel: {
    ...typography.captionBold,
    flex: 1,
    minWidth: 0,
  },
  legendAmount: {
    ...typography.captionBold,
    width: 92,
    textAlign: 'right',
    includeFontPadding: false,
  },
  percentPill: {
    minWidth: 40,
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHigh,
  },
  percentText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
