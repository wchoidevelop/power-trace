import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { SectorFlows } from '@/components/analyzer/SectorFlows';
import type { BLS, DataPoint, IndustryCodes, JoltsResponse } from '@/lib/api';
import type { StepError } from '@/lib/analyzer/types';

// pick the latest datapoint from a BLS series and coerce to number (mirrors useAnalyzer)
function latest(series?: DataPoint[]): number | undefined {
  if (!series?.length) return undefined;
  const d = series.find((x) => x.latest) ?? series[0];
  const n = Number(d.value);
  return Number.isFinite(n) ? n : undefined;
}

const fmtMoney = (n: number) => `$${n.toLocaleString()}`;
const fmtPct = (n: number) => `${n}%`;

type Metric = { label: string; value?: number; fmt: (n: number) => string };

export function LaborStep({
  industryCodes,
  BLSData,
  joltsData,
  onNext,
  onSkip,
  readOnly,
  error,
  busy,
  notApplicable,
}: {
  industryCodes?: IndustryCodes;
  BLSData: BLS;
  joltsData?: JoltsResponse;
  onNext: () => void;
  /** abandon the labor data and analyze from the power map alone */
  onSkip?: () => void;
  readOnly?: boolean;
  error?: StepError;
  /** a retry is in flight while part of the data is already on screen */
  busy?: boolean;
  /** the classifier found no federal classification that fits this organization */
  notApplicable?: boolean;
}) {
  const { theme: t } = useTheme();
  const loaded = !!industryCodes && (!!BLSData.le || !!BLSData.lu || !!joltsData);

  // resolve the CODES used to index BLS data (not labels)
  const indCode = industryCodes?.cps_industry?.code ?? undefined;
  const leOccCode = industryCodes?.cps_occupation_le?.code ?? undefined;
  const luOccCode = industryCodes?.cps_occupation_lu?.code ?? undefined;

  const leInd = indCode ? BLSData.le?.industry?.[indCode] : undefined;
  const luInd = indCode ? BLSData.lu?.industry?.[indCode] : undefined;
  const leOcc = leOccCode ? BLSData.le?.occupation?.[leOccCode] : undefined;
  const luOcc = luOccCode ? BLSData.lu?.occupation?.[luOccCode] : undefined;

  const industryMetrics: Metric[] = [
    { label: 'Women median weekly earnings', value: latest(leInd?.women), fmt: fmtMoney },
    { label: 'Men median weekly earnings', value: latest(leInd?.men), fmt: fmtMoney },
    { label: 'Women earnings as % of men', value: latest(leInd?.women_pct_of_men), fmt: fmtPct },
    { label: 'Union coverage', value: latest(luInd?.coverage), fmt: fmtPct },
    { label: 'Union median weekly earnings', value: latest(luInd?.union_wages), fmt: fmtMoney },
    { label: 'Non-union median weekly earnings', value: latest(luInd?.nonunion_wages), fmt: fmtMoney },
  ];

  const occupationMetrics: Metric[] = [
    { label: 'Women median weekly earnings', value: latest(leOcc?.women), fmt: fmtMoney },
    { label: 'Men median weekly earnings', value: latest(leOcc?.men), fmt: fmtMoney },
    { label: 'Women earnings as % of men', value: latest(leOcc?.women_pct_of_men), fmt: fmtPct },
    { label: 'Union coverage', value: latest(luOcc?.coverage), fmt: fmtPct },
    { label: 'Union median weekly earnings', value: latest(luOcc?.union_wages), fmt: fmtMoney },
    { label: 'Non-union median weekly earnings', value: latest(luOcc?.nonunion_wages), fmt: fmtMoney },
  ];

  // Not a failure: no published federal classification describes this kind of
  // organization, so there is no wage or turnover data to show. Say that plainly
  // and move on — the analysis reads the power map on its own.
  if (notApplicable && !error) {
    return (
      <Section
        heading="No labor-market data for this organization"
        caption="BLS wage and turnover statistics cover paid employment. Nothing in the federal occupation and industry classifications describes this group, so this step has nothing to add."
        badge="LAYER 5"
      >
        {industryCodes?.warning && (
          <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>
            {industryCodes.warning}
          </Text>
        )}
        <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>
          The analysis will work from your power map alone, and will not make claims about how easy
          it is to leave based on the job market.
        </Text>
        {!readOnly && <Button label="Describe a situation →" variant="accent" onPress={onNext} />}
      </Section>
    );
  }

  if (!loaded) {
    return (
      <Section heading="Pulling labor market context" badge="LAYER 5">
        {error ? (
          <ErrorRetry
            error={error}
            title="Could not pull labor data"
            backLabel="Back to the power map"
            // the analysis reads fine without this section — it reasons from the
            // power map alone rather than guessing at the market
            extraAction={onSkip ? { label: 'Continue without it', onPress: onSkip } : undefined}
          />
        ) : (
          <Loading label="Classifying industry and fetching BLS series" />
        )}
      </Section>
    );
  }

  return (
    <Section
      heading="Labor market context"
      caption="Industry and occupation pay from BLS CPS. Sector flows from JOLTS, each rate placed against its own 19-year history rather than shown raw — a quits rate means nothing until you know what normal was for that sector."
      badge="LAYER 5"
    >
      {busy && <Loading label="Fetching the rest of the series" />}

      {/* part of the pull landed — show what we have and let the user retry the
          rest or move on without it */}
      {error && (
        <ErrorRetry
          error={error}
          title="Some labor data is missing"
          backLabel="Back to the power map"
        />
      )}

      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md }]}>
        <Row label="Industry" value={industryCodes?.cps_industry?.label} code={industryCodes?.cps_industry?.code} />
        <Row label="Occupation (LE)" value={industryCodes?.cps_occupation_le?.label} code={industryCodes?.cps_occupation_le?.code} />
        <Row label="Occupation (LU)" value={industryCodes?.cps_occupation_lu?.label} code={industryCodes?.cps_occupation_lu?.code} />
        <Row label="JOLTS supersector" value={industryCodes?.jolts?.supersector} code={industryCodes?.jolts?.code} />
        {industryCodes?.warning && (
          <Text style={[styles.warn, { color: t.danger, fontFamily: t.font.sans }]}>
            {industryCodes.warning}
          </Text>
        )}
      </View>

      <MetricGroup title="Industry" subtitle={industryCodes?.cps_industry?.label} metrics={industryMetrics} />
      <MetricGroup title="Occupation" subtitle={industryCodes?.cps_occupation_le?.label} metrics={occupationMetrics} />

      <SectorFlows jolts={joltsData} supersector={industryCodes?.jolts?.supersector} />

      {!readOnly && <Button label="Describe a situation →" variant="accent" onPress={onNext} />}
    </Section>
  );
}

function Row({ label, value, code }: { label: string; value?: string | null; code?: string | null }) {
  const { theme: t } = useTheme();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[styles.label, { color: t.textMuted, fontFamily: t.font.sans }]}>{label}</Text>
      <Text style={[styles.value, { color: t.text, fontFamily: t.font.sans }]}>
        {value ?? '—'} {code ? <Text style={{ color: t.textFaint, fontFamily: t.font.mono }}>({code})</Text> : null}
      </Text>
    </View>
  );
}

function MetricGroup({ title, subtitle, metrics }: { title: string; subtitle?: string | null; metrics: Metric[] }) {
  const { theme: t } = useTheme();
  const shown = metrics.filter((m) => m.value !== undefined);
  return (
    <View style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md }]}>
      <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.font.sans }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: t.textFaint, fontFamily: t.font.sans }]}>{subtitle}</Text>
      ) : null}
      {shown.length === 0 ? (
        <Text style={[styles.body, { color: t.textFaint, fontFamily: t.font.sans }]}>No data available.</Text>
      ) : (
        shown.map((m) => (
          <View key={m.label} style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>{m.label}</Text>
            <Text style={[styles.metricValue, { color: t.text, fontFamily: t.font.mono }]}>{m.fmt(m.value!)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  value: { fontSize: 14, marginTop: 2 },
  body: { fontSize: 12, marginTop: 4 },
  warn: { fontSize: 12, marginTop: 8 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 },
  metricLabel: { fontSize: 13, flexShrink: 1 },
  metricValue: { fontSize: 14, fontWeight: '600' },
});
