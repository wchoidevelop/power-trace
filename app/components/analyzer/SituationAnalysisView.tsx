import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Section } from '@/components/ui/Section';
import type { SituationAnalysisType } from '@/lib/analyzer/prompts';

type EVLN = SituationAnalysisType['evln_prediction']['most_likely_response'];

export function SituationAnalysisView({ analysis }: { analysis: SituationAnalysisType }) {
  const { theme: t } = useTheme();

  return (
    <Section
      heading={analysis.situation_label}
      caption="Structural reading of your situation"
      badge="SITUATION ANALYSIS"
    >
      <Block label="Structural diagnosis" body={analysis.structural_diagnosis} />

      <EVLNCard prediction={analysis.evln_prediction} />

      <Block label="Your power position" body={analysis.power_position_note} />

      <PrevalenceCard prevalence={analysis.prevalence} />

      <View style={{ gap: 10 }}>
        <Text style={[styles.sectionLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          Relevant concepts
        </Text>
        {analysis.concepts.map((c, i) => (
          <ConceptCard key={i} concept={c} />
        ))}
      </View>
    </Section>
  );
}

// ──────────────────────────────────────────────

function Block({ label, body }: { label: string; body: string }) {
  const { theme: t } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md },
      ]}
    >
      <Text style={[styles.cardLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>{label}</Text>
      <Text style={[styles.body, { color: t.text, fontFamily: t.font.sans }]}>{body}</Text>
    </View>
  );
}

function EVLNCard({ prediction }: { prediction: SituationAnalysisType['evln_prediction'] }) {
  const { theme: t } = useTheme();
  const colors = evlnColors(prediction.most_likely_response, t);

  return (
    <View
      style={[
        styles.evlnCard,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderRadius: t.radius.md,
        },
      ]}
    >
      <View style={styles.evlnHeader}>
        <Text style={[styles.cardLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          EVLN prediction
        </Text>
        <View
          style={[
            styles.evlnChip,
            { backgroundColor: colors.bg, borderColor: colors.fg, borderRadius: t.radius.pill },
          ]}
        >
          <Text style={[styles.evlnChipText, { color: colors.fg, fontFamily: t.font.sans }]}>
            {prediction.most_likely_response.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: t.text, fontFamily: t.font.sans, marginTop: 8 }]}>
        {prediction.why}
      </Text>

      <View
        style={[
          styles.calloutRow,
          { borderTopColor: t.border, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
        ]}
      >
        <Text style={[styles.arrowGlyph, { color: t.success, fontFamily: t.font.mono }]}>→</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.calloutLabel, { color: t.success, fontFamily: t.font.sans }]}>
            Better alternative
          </Text>
          <Text style={[styles.body, { color: t.text, fontFamily: t.font.sans }]}>
            {prediction.better_alternative}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PrevalenceCard({
  prevalence,
}: {
  prevalence: SituationAnalysisType['prevalence'];
}) {
  const { theme: t } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surfaceMuted,
          borderColor: t.border,
          borderRadius: t.radius.md,
        },
      ]}
    >
      <Text style={[styles.cardLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
        How common is this
      </Text>
      <Text style={[styles.body, { color: t.text, fontFamily: t.font.sans }]}>
        {prevalence.description}
      </Text>
      <View style={[styles.dataChip, { backgroundColor: t.accentSoft, borderRadius: t.radius.sm }]}>
        <Text style={[styles.dataPoint, { color: t.accent, fontFamily: t.font.mono }]}>
          {prevalence.data_point}
        </Text>
        <Text style={[styles.dataSource, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {prevalence.source}
        </Text>
      </View>
    </View>
  );
}

function ConceptCard({ concept }: { concept: SituationAnalysisType['concepts'][number] }) {
  const { theme: t } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderRadius: t.radius.md,
          borderLeftWidth: 3,
          borderLeftColor: t.accent,
        },
      ]}
    >
      <View style={styles.conceptHeader}>
        <Text style={[styles.conceptTerm, { color: t.text, fontFamily: t.font.sans }]}>
          {concept.term}
        </Text>
        <View style={[styles.researcherChip, { borderColor: t.border, borderRadius: t.radius.pill }]}>
          <Text style={[styles.researcherText, { color: t.textMuted, fontFamily: t.font.mono }]}>
            {concept.researcher} · {concept.year}
          </Text>
        </View>
      </View>

      <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans, marginTop: 8 }]}>
        {concept.how_it_applies}
      </Text>

      <View style={styles.conceptRow}>
        <Text style={[styles.rowGlyph, { color: t.danger, fontFamily: t.font.sans }]}>✕</Text>
        <Text style={[styles.rowText, { color: t.textMuted, fontFamily: t.font.sans, flex: 1 }]}>
          <Text style={{ color: t.danger, fontWeight: '600' }}>Common mistake. </Text>
          {concept.what_most_people_do_wrong}
        </Text>
      </View>

      <View style={styles.conceptRow}>
        <Text style={[styles.rowGlyph, { color: t.success, fontFamily: t.font.sans }]}>✓</Text>
        <Text style={[styles.rowText, { color: t.text, fontFamily: t.font.sans, flex: 1 }]}>
          <Text style={{ color: t.success, fontWeight: '600' }}>Do this instead. </Text>
          {concept.recommended_action}
        </Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────

function evlnColors(response: EVLN, t: ReturnType<typeof useTheme>['theme']) {
  switch (response) {
    case 'Voice':
      return { fg: t.success, bg: t.mode === 'dark' ? '#064e3b' : '#d1fae5' };
    case 'Exit':
      return { fg: t.danger, bg: t.mode === 'dark' ? '#7f1d1d' : '#fee2e2' };
    case 'Loyalty':
      return { fg: t.accent, bg: t.accentSoft };
    case 'Neglect':
      return { fg: t.warning, bg: t.warningSoft };
  }
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 8 },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  body: { fontSize: 14, lineHeight: 21 },

  evlnCard: { borderWidth: 1, padding: 14 },
  evlnHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  evlnChip: { borderWidth: 1, paddingVertical: 4, paddingHorizontal: 12 },
  evlnChipText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  calloutRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  arrowGlyph: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
  calloutLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 },

  dataChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
    marginTop: 4,
  },
  dataPoint: { fontSize: 13, fontWeight: '700' },
  dataSource: { fontSize: 11 },

  conceptHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  conceptTerm: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  researcherChip: { borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8 },
  researcherText: { fontSize: 10, fontWeight: '500' },
  conceptRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-start' },
  rowGlyph: { fontSize: 13, lineHeight: 20, fontWeight: '700', width: 14 },
  rowText: { fontSize: 13.5, lineHeight: 20 },
});
