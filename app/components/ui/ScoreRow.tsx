import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Scored } from '@/lib/analyzer/types';
import { Bar } from './Bar';
import { ScoreType } from '@/lib/analyzer/prompts';

export function ScoreRow({ s }: { s: ScoreType }) {
  const { theme: t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md }]}>
      <View style={styles.body}>
        <Text style={[styles.name, { color: t.text, fontFamily: t.font.sans }]}>{s.position}</Text>
        <View style={styles.bars}>
          <Bar label="Legitimate" value={s.scores.legitimate.score * 10} color={t.accent} reasoning={s.scores.legitimate.reasoning} />
          <Bar label="Reward" value={s.scores.reward.score * 10} color={t.accent} reasoning={s.scores.reward.reasoning} />
          <Bar label="Referent" value={s.scores.referent.score * 10} color={t.accent} reasoning={s.scores.referent.reasoning} />
          <Bar label="Expert" value={s.scores.expert.score * 10} color={t.accent} reasoning={s.scores.expert.reasoning} />
          <Bar label="Coercive" value={s.scores.coercive.score * 10} color={t.accent} reasoning={s.scores.coercive.reasoning} />
          <Bar label="Informational" value={s.scores.informational.score * 10} color={t.accent} reasoning={s.scores.informational.reasoning} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  body: { flex: 1, gap: 10 },
  name: { fontSize: 15, fontWeight: '600' },
  bars: { gap: 8 },
  confCol: { alignItems: 'flex-end', gap: 2, minWidth: 44 },
  confLabel: { fontSize: 9, letterSpacing: 0.8, fontWeight: '700' },
  confValue: { fontSize: 16, fontWeight: '700' },
});
