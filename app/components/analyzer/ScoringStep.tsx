import { StyleSheet, Text, View } from 'react-native';
import type { Scored, StepError } from '@/lib/analyzer/types';
import { Section } from '@/components/ui/Section';
import { Loading } from '@/components/ui/Loading';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { ScoreRow } from '@/components/ui/ScoreRow';
import { Collapsible } from '@/components/ui/Collapsible';
import { Button } from '../ui/Button';
import { ScoreType } from '@/lib/analyzer/prompts';
import { useTheme } from '@/theme/ThemeProvider';
import { DIMENSIONS } from '@/constants/dimensions';

export function ScoringStep({ scored, onNext, readOnly, error }: { scored: ScoreType[]; onNext: () => void; readOnly?: boolean; error?: StepError }) {
  const { theme: t } = useTheme();
  return (
    <Section
      heading="Initial scoring"
      caption="Scoring formal authority, informal influence, and autonomy from role descriptions."
      badge="LAYER 2"
    >
      {error ? (
        <ErrorRetry error={error} title="Scoring failed" backLabel="Back to roles" />
      ) : scored.length === 0 ? (
        <Loading label="Analyzing roles" />
      ) : (
        <View style={{ gap: 10 }}>
          <Collapsible title="What do these dimensions mean?">
            {DIMENSIONS.map((d) => (
              <View key={d.key} style={styles.dim}>
                <Text style={[styles.dimLabel, { color: t.text, fontFamily: t.font.sans }]}>{d.label}</Text>
                <Text style={[styles.dimBlurb, { color: t.textMuted, fontFamily: t.font.sans }]}>{d.blurb}</Text>
              </View>
            ))}
          </Collapsible>
          <Text style={[styles.hint, { color: t.textFaint, fontFamily: t.font.sans }]}>
            Tap a dimension to see why it was scored that way.
          </Text>
          {scored.map((s, i) => (
            <ScoreRow key={i} s={s} />
          ))}
          {!readOnly && <Button label='Next' variant='primary' onPress={onNext} />}
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  dim: { gap: 2 },
  dimLabel: { fontSize: 13, fontWeight: '700' },
  dimBlurb: { fontSize: 13, lineHeight: 18 },
  hint: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
