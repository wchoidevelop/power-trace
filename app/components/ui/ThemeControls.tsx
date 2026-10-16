import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCENT_ORDER, ACCENTS, type AccentKey } from '@/constants/theme';
import { useTheme } from '@/theme/ThemeProvider';

export function ThemeControls() {
  const { theme: t, modePref, accent, setAccent, cycleMode } = useTheme();

  const modeLabel = modePref === 'system' ? 'Auto' : modePref === 'light' ? 'Light' : 'Dark';
  const modeIcon = modePref === 'system' ? '◐' : modePref === 'light' ? '☀' : '☾';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={cycleMode}
        accessibilityLabel="Cycle theme mode"
        style={({ pressed }) => [
          styles.modeBtn,
          {
            backgroundColor: t.surface,
            borderColor: t.border,
            opacity: pressed ? 0.6 : 1,
            borderRadius: t.radius.pill,
          },
        ]}
      >
        <Text style={[styles.modeIcon, { color: t.text, fontFamily: t.font.sans }]}>{modeIcon}</Text>
        <Text style={[styles.modeLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          {modeLabel}
        </Text>
      </Pressable>

      <View style={styles.swatches}>
        {ACCENT_ORDER.map((key) => (
          <AccentSwatch key={key} accentKey={key} selected={accent === key} onPress={() => setAccent(key)} />
        ))}
      </View>
    </View>
  );
}

function AccentSwatch({
  accentKey,
  selected,
  onPress,
}: {
  accentKey: AccentKey;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme: t } = useTheme();
  const color = ACCENTS[accentKey].base;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Accent ${ACCENTS[accentKey].name}`}
      style={({ pressed }) => [
        styles.swatch,
        {
          backgroundColor: color,
          borderColor: selected ? t.text : 'transparent',
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: selected ? 1.1 : 1 }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  modeIcon: { fontSize: 13 },
  modeLabel: { fontSize: 12, fontWeight: '500' },
  swatches: { flexDirection: 'row', gap: 8 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
});
