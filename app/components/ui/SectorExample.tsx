import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { TINT } from '@/constants/dimensions';

/**
 * A coded, self-contained mock of a sector readout — no real data. It shows the
 * shape of the output the data slide describes: a quits rate placed against its
 * own industry's range (positioned, not raw), with hires and layoffs read
 * alongside it. Numbers are illustrative and fixed.
 */
export function SectorExample({ tone }: { tone: string }) {
  const { theme: t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: tone + TINT.line, borderRadius: t.radius.md }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>Example readout</Text>
        <View style={[styles.tag, { backgroundColor: tone + TINT.soft, borderRadius: t.radius.sm }]}>
          <Text style={[styles.tagText, { color: tone, fontFamily: t.font.mono }]}>JOLTS</Text>
        </View>
      </View>

      <Text style={[styles.metricLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
        Quits rate · software publishers
      </Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: t.text, fontFamily: t.font.sans }]}>1.9%</Text>
        <Text style={[styles.unit, { color: t.textFaint, fontFamily: t.font.mono }]}>/ mo</Text>
        <View style={{ flex: 1 }} />
        <View style={[styles.pill, { backgroundColor: tone + TINT.soft, borderRadius: t.radius.pill }]}>
          <Text style={[styles.pillText, { color: tone, fontFamily: t.font.sans }]}>elevated here</Text>
        </View>
      </View>

      {/* the rate placed within the industry's own low→high band */}
      <View style={[styles.track, { backgroundColor: t.surfaceMuted }]}>
        <View style={[styles.fill, { backgroundColor: tone + '55', width: '72%' }]}>
          <View style={[styles.marker, { backgroundColor: tone, borderColor: t.surface }]} />
        </View>
      </View>
      <View style={styles.scaleRow}>
        <Text style={[styles.scale, { color: t.textFaint, fontFamily: t.font.mono }]}>low</Text>
        <Text style={[styles.scale, { color: t.textFaint, fontFamily: t.font.mono }]}>industry range</Text>
        <Text style={[styles.scale, { color: t.textFaint, fontFamily: t.font.mono }]}>high</Text>
      </View>

      {/* read together, not in isolation */}
      <View style={styles.mini}>
        <MiniBar tone={tone} label="Hires" value="3.4%" pct={0.62} />
        <MiniBar tone={tone} label="Layoffs" value="1.1%" pct={0.26} />
      </View>

      <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.sans }]}>
        Illustrative — each rate sits against its own industry's history, and is read together.
      </Text>
    </View>
  );
}

function MiniBar({ tone, label, value, pct }: { tone: string; label: string; value: string; pct: number }) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.miniRow}>
      <Text style={[styles.miniLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>{label}</Text>
      <View style={[styles.miniTrack, { backgroundColor: t.surfaceMuted }]}>
        <View style={[styles.miniFill, { backgroundColor: tone + '55', width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <Text style={[styles.miniValue, { color: t.text, fontFamily: t.font.mono }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, gap: 8, marginTop: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  tag: { paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  metricLabel: { fontSize: 12.5, marginTop: 2 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 12 },
  pill: { alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },

  track: { height: 8, borderRadius: 999, marginTop: 6, marginBottom: 4 },
  fill: { height: 8, borderRadius: 999 },
  marker: {
    position: 'absolute',
    right: -6,
    top: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scale: { fontSize: 10, letterSpacing: 0.4 },

  mini: { gap: 8, marginTop: 12 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniLabel: { fontSize: 12.5, width: 56 },
  miniTrack: { flex: 1, height: 6, borderRadius: 999, overflow: 'hidden' },
  miniFill: { height: 6, borderRadius: 999 },
  miniValue: { fontSize: 12, fontWeight: '600', width: 40, textAlign: 'right' },

  caption: { fontSize: 11.5, lineHeight: 16, marginTop: 10, fontStyle: 'italic' },
});
