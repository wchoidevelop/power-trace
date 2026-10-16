import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { BiasFinding } from '@/lib/analyzer/types';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { AdjustedRoleType } from '@/lib/analyzer/prompts';

const BIAS_LABELS: Record<string, string> = {
  self_minimization: 'Self-Minimization',
  self_inflation: 'Self-Inflation',
  antagonist_inflation: 'Antagonist Inflation',
  threat_underweighting: 'Threat Underweighting',
  ally_halo: 'Ally Halo',
  victim_framing: 'Victim Framing',
  structural_normalization: 'Structural Normalization',
};

export function BiasStep({
  adjusted,
  onNext,
  readOnly,
}: {
  adjusted: AdjustedRoleType;
  onNext: () => void;
  readOnly?: boolean;
}) {
  const { theme: t } = useTheme();
  // flags name positions by id
  const nameById = Object.fromEntries((adjusted.adjusted_roles ?? []).map((r) => [r.id, r.position]));

  return (
    <Section
      heading="Bias check"
      caption="Scanning role descriptions and scores for language and structural bias."
      badge="LAYER 4"
    >
      {adjusted.confidence_rationale ? (
        <View
          style={[
            styles.card,
            { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md },
          ]}
        >
          <Text style={[styles.category, { color: t.text, fontFamily: t.font.sans }]}>
            Map confidence: {adjusted.confidence}
          </Text>
          <Text style={[styles.detail, { color: t.textMuted, fontFamily: t.font.sans }]}>
            {adjusted.confidence_rationale}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        {adjusted.bias_flags.length === 0 ? (
          <Text style={[styles.detail, { color: t.textMuted, fontFamily: t.font.sans }]}>
            No distortions flagged in how you described the org. That is a normal result, not a gap.
          </Text>
        ) : (
          adjusted.bias_flags.map((f, i) => (
            <View
              key={i}
              style={[
                styles.card,
                { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md },
              ]}
            >
              <View style={styles.header}>
                <Text style={[styles.category, { color: t.text, fontFamily: t.font.sans }]}>
                  {BIAS_LABELS[f.type] ?? f.type}
                </Text>
                <Text style={[styles.roleId, { color: t.textFaint, fontFamily: t.font.mono }]}>
                  {nameById[f.position_affected] ?? f.position_affected} · {f.severity}
                </Text>
              </View>

              {/* the verbatim quote that triggered the flag, then why */}
              <Text style={[styles.quote, { color: t.text, fontFamily: t.font.serif, borderColor: t.border }]}>
                “{f.evidence}”
              </Text>
              <Text style={[styles.detail, { color: t.textMuted, fontFamily: t.font.sans }]}>
                {f.inference}
              </Text>

              {/* every flag ships with the case against itself — showing the flag
                  without it would present a hypothesis as a finding */}
              {f.alternative_reading ? (
                <Text style={[styles.counter, { color: t.textFaint, fontFamily: t.font.sans }]}>
                  Or it may be accurate as you wrote it: {f.alternative_reading}
                </Text>
              ) : null}

              <Text style={[styles.suggestion, { color: t.success, fontFamily: t.font.sans }]}>
                → {f.adjustment}
              </Text>
            </View>
          ))
        )}
      </View>
      {!readOnly && <Button label="View power map →" variant="accent" onPress={onNext} />}
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 14, fontWeight: '600' },
  roleId: { fontSize: 11 },
  detail: { fontSize: 13, lineHeight: 19 },
  quote: { fontSize: 14, lineHeight: 20, fontStyle: 'italic', borderLeftWidth: 2, paddingLeft: 10 },
  counter: { fontSize: 12, lineHeight: 18 },
  suggestion: { fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
