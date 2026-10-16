import { Children, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

/**
 * Responsive wrap grid. Column count is derived from the measured width of the
 * container rather than the window, so it stays correct inside padded parents
 * and inside the horizontal pager on the intro.
 *
 * Widths are computed in pixels, not percentages, because percentage widths and
 * `gap` fight each other in a wrapping row — the gap is added on top of the
 * percentage and the last column wraps early.
 */
export function Grid({
  children,
  minColumnWidth = 240,
  gap = 10,
  style,
}: {
  children: React.ReactNode;
  minColumnWidth?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children);

  // before the first layout pass we have no width, so render a single column
  const columns = width ? Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap))) : 1;
  const itemWidth = width ? (width - gap * (columns - 1)) / columns : undefined;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.grid, { gap }, style]}
    >
      {items.map((child, i) => (
        <View key={i} style={{ width: columns === 1 ? '100%' : itemWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
