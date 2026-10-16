import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Bar({
  label,
  value,
  color,
  reasoning,
}: {
  label: string;
  value: number;
  color: string;
  reasoning?: string;
}) {
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(false);

  const bar = (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: t.textFaint, fontFamily: t.font.sans }]}>
          {label}
          {reasoning ? <Text style={{ color: t.accent }}>{open ? '  ▾' : '  ⓘ'}</Text> : null}
        </Text>
        <Text style={[styles.value, { color: t.text, fontFamily: t.font.mono }]}>{value}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.surfaceMuted }]}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      {open && reasoning ? (
        <Text style={[styles.reasoning, { color: t.textMuted, fontFamily: t.font.sans }]}>{reasoning}</Text>
      ) : null}
    </View>
  );

  if (!reasoning) return bar;

  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((o) => !o);
      }}
      hitSlop={6}
    >
      {bar}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { fontSize: 11, fontWeight: '600' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  reasoning: { fontSize: 12, lineHeight: 17, marginTop: 4 },
});
