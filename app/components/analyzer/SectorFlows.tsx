import { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Theme } from '@/constants/theme';
import type {
  JOLTSSeriesType,
  JoltsIndustry,
  JoltsPoint,
  JoltsResponse,
  JoltsScore,
  MarketState,
} from '@/lib/api';

// ── formatting ──────────────────────────────────────────────────────────────

const signed = (n: number, unit = '') =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${unit}`;

const ordinal = (n: number) => {
  const r = n % 100;
  if (r >= 11 && r <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

// 'YYYY-MM' → 'May 2026'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtMonth(date?: string | null) {
  if (!date) return null;
  const [y, m] = date.split('-').map(Number);
  return MONTHS[m - 1] ? `${MONTHS[m - 1]} ${y}` : date;
}

// ── metric metadata ─────────────────────────────────────────────────────────
// `favors` is which direction of movement hands leverage to workers. Layoffs
// are the inversion: a high layoffs rate is a high number and a bad one.

type MetricMeta = {
  label: string;
  favors: 'up' | 'down' | 'neutral';
  blurb: string;
};

const METRICS: Record<JOLTSSeriesType, MetricMeta> = {
  quits: {
    label: 'Quits',
    favors: 'up',
    blurb:
      'Share of employees who left voluntarily this month. The strongest single read on exit power — nobody quits without believing something better is reachable, so this measures perceived options rather than inferring them.',
  },
  layoffs: {
    label: 'Layoffs & discharges',
    favors: 'down',
    blurb:
      'Share removed involuntarily this month. Elevated layoffs override every other signal: a market cannot be called healthy for workers while people are being cut, regardless of how many openings are posted.',
  },
  job_openings: {
    label: 'Job openings',
    favors: 'up',
    blurb:
      'Unfilled positions as a share of employment plus openings. Read this alongside vacancy yield — a posting is not an offer, and openings can stay high while almost nobody is actually hired.',
  },
  hires: {
    label: 'Hires',
    favors: 'up',
    blurb:
      'Share of employment hired this month. Low hires alone reads as weakness, but paired with low layoffs it means something different: employers holding staff without committing to more.',
  },
  total_separations: {
    label: 'Total separations',
    favors: 'neutral',
    blurb:
      'Quits plus layoffs plus other separations. The headline sum hides what matters — whether people are leaving or being removed — so read the composition below it, not this number.',
  },
};

const ORDER: JOLTSSeriesType[] = ['quits', 'layoffs', 'job_openings', 'hires', 'total_separations'];

// ── market state ────────────────────────────────────────────────────────────

const STATE_LABEL: Record<MarketState, string> = {
  tight: 'Tight',
  frozen: 'Frozen',
  contracting: 'Contracting',
  reallocating: 'Reallocating',
  balanced: 'Balanced',
  unknown: 'Unknown',
};

function stateColor(state: MarketState, t: Theme) {
  switch (state) {
    case 'tight':
      return t.success;
    case 'frozen':
      return t.warning;
    case 'contracting':
      return t.danger;
    case 'reallocating':
      return t.accent;
    default:
      return t.textMuted;
  }
}

// ── panel ───────────────────────────────────────────────────────────────────

export function SectorFlows({
  jolts,
  supersector,
}: {
  jolts?: JoltsResponse;
  supersector?: string | null;
}) {
  const { theme: t } = useTheme();
  const ind: JoltsIndustry | undefined = jolts?.industries?.[0];

  if (!ind) {
    return (
      <View style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md }]}>
        <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.font.sans }]}>Sector flows (JOLTS)</Text>
        <Text style={[styles.body, { color: t.textFaint, fontFamily: t.font.sans }]}>No data available.</Text>
      </View>
    );
  }

  const asOf = fmtMonth(ind.asOf);
  const rateSeries = (m: JOLTSSeriesType) =>
    ind.series.find((s) => s.metric === m && s.kind === 'rate')?.data;

  return (
    <View style={{ gap: 12 }}>
      <StateCard
        state={ind.classification.state}
        description={ind.classification.description}
        index={ind.workerPowerIndex}
        supersector={supersector}
        asOf={asOf}
        preliminary={ind.preliminary}
      />

      <View style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md }]}>
        <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.font.sans }]}>Flow rates</Text>
        <Text style={[styles.subtitle, { color: t.textFaint, fontFamily: t.font.sans }]}>
          Each rate against its own history — {jolts?.baseline ?? 'pre-COVID baseline'}. Tap a row for
          what it measures.
        </Text>
        {ORDER.map((m) => {
          const score = ind.rates[m];
          if (!score) return null;
          return <FlowRow key={m} meta={METRICS[m]} score={score} history={rateSeries(m)} />;
        })}
      </View>

      <DerivedCard derived={ind.derived} />

      {jolts?.national?.vacanciesPerUnemployed != null && (
        <View style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md }]}>
          <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.font.sans }]}>National context</Text>
          <Text style={[styles.subtitle, { color: t.textFaint, fontFamily: t.font.sans }]}>
            All sectors — unemployment has no industry breakdown.
          </Text>
          <View style={styles.metricRow}>
            <Text style={[styles.metricLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
              Job openings per unemployed worker
              {jolts.national.asOf ? ` (${fmtMonth(jolts.national.asOf)})` : ''}
            </Text>
            <Text style={[styles.metricValue, { color: t.text, fontFamily: t.font.mono }]}>
              {jolts.national.vacanciesPerUnemployed}
            </Text>
          </View>
          {jolts.national.change12m != null && (
            <View style={styles.metricRow}>
              <Text style={[styles.metricLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
                Change over 12 months
              </Text>
              <Text style={[styles.metricValue, { color: t.textMuted, fontFamily: t.font.mono }]}>
                {signed(jolts.national.change12m)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── market state + composite index ──────────────────────────────────────────

function StateCard({
  state,
  description,
  index,
  supersector,
  asOf,
  preliminary,
}: {
  state: MarketState;
  description: string;
  index: number | null;
  supersector?: string | null;
  asOf?: string | null;
  preliminary?: boolean;
}) {
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(false);
  const color = stateColor(state, t);

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: color, borderRadius: t.radius.md }]}>
      <Text style={[styles.label, { color: t.textFaint, fontFamily: t.font.sans }]}>Market state</Text>
      <View style={styles.stateHeader}>
        <Text style={[styles.stateName, { color, fontFamily: t.font.sans }]}>{STATE_LABEL[state]}</Text>
        {asOf && (
          <Text style={[styles.stamp, { color: t.textFaint, fontFamily: t.font.mono }]}>
            {asOf}
            {preliminary ? ' (p)' : ''}
          </Text>
        )}
      </View>
      {supersector && (
        <Text style={[styles.subtitle, { color: t.textFaint, fontFamily: t.font.sans }]}>{supersector}</Text>
      )}
      <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>{description}</Text>

      {index != null && (
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setOpen((o) => !o);
          }}
          hitSlop={6}
          style={{ marginTop: 12, gap: 4 }}
        >
          <View style={styles.row}>
            <Text style={[styles.label, { color: t.textFaint, fontFamily: t.font.sans }]}>
              Worker power index
              <Text style={{ color: t.accent }}>{open ? '  ▾' : '  ⓘ'}</Text>
            </Text>
            <Text style={[styles.metricValue, { color: t.text, fontFamily: t.font.mono }]}>
              {index}
              <Text style={{ color: t.textFaint }}> / 100</Text>
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: t.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${index}%`, backgroundColor: color }]} />
            <View style={[styles.tick, { left: '50%', backgroundColor: t.borderStrong }]} />
          </View>
          <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.sans }]}>
            50 (the tick) = this sector&apos;s pre-pandemic norm
          </Text>
          {open && (
            <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>
              A composite built for this app, not a published BLS statistic: quits weighted heaviest
              (0.5), openings next (0.3), layoffs subtracted (0.2), each as its distance from the
              2015–2019 norm. Quits leads because it is revealed preference; openings counts for less
              because a posting is not an offer. Cite it as a constructed index, never as a
              government figure.
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

// ── one flow rate ───────────────────────────────────────────────────────────

function FlowRow({
  meta,
  score,
  history,
}: {
  meta: MetricMeta;
  score: JoltsScore;
  history?: JoltsPoint[];
}) {
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(false);

  // colour the z chip by what the deviation means for workers, not by its sign
  const z = score.z;
  const tone =
    z == null || Math.abs(z) < 0.5 || meta.favors === 'neutral'
      ? t.textMuted
      : (z > 0) === (meta.favors === 'up')
        ? t.success
        : t.warning;

  const zText =
    z == null
      ? null
      : `${Math.abs(z).toFixed(2)}σ ${z >= 0 ? 'above' : 'below'} the ${score.baselineMean}% norm`;

  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((o) => !o);
      }}
      hitSlop={6}
      style={[styles.flowRow, { borderTopColor: t.border }]}
    >
      <View style={styles.row}>
        <Text style={[styles.flowLabel, { color: t.text, fontFamily: t.font.sans }]}>
          {meta.label}
          <Text style={{ color: t.accent }}>{open ? '  ▾' : '  ⓘ'}</Text>
        </Text>
        <Text style={[styles.flowValue, { color: t.text, fontFamily: t.font.mono }]}>
          {score.latest}
          <Text style={[styles.unit, { color: t.textFaint }]}> %/mo</Text>
        </Text>
      </View>

      {/* percentile against the full 19-year pull; the tick is the median */}
      <View style={[styles.track, { backgroundColor: t.surface, marginTop: 6 }]}>
        <View style={[styles.fill, { width: `${score.percentile}%`, backgroundColor: tone }]} />
        <View style={[styles.tick, { left: '50%', backgroundColor: t.borderStrong }]} />
      </View>

      <View style={[styles.row, { marginTop: 4 }]}>
        <Text style={[styles.caption, { color: tone, fontFamily: t.font.sans }]}>
          {ordinal(score.percentile)} percentile of the last 19 years
        </Text>
        <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {[
            score.change3m != null ? `3mo ${signed(score.change3m, 'pp')}` : null,
            score.change12m != null ? `12mo ${signed(score.change12m, 'pp')}` : null,
          ]
            .filter(Boolean)
            .join('   ')}
        </Text>
      </View>

      {zText && (
        <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.sans, marginTop: 2 }]}>
          {zText}
        </Text>
      )}

      {open && (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>{meta.blurb}</Text>
          {history && history.length > 12 && <Sparkline points={history} color={tone} />}
        </View>
      )}
    </Pressable>
  );
}

// ── sparkline ───────────────────────────────────────────────────────────────
// Column chart over the rate history. Scaled to its own min/max because the
// question is always shape, never level.

function Sparkline({ points, color }: { points: JoltsPoint[]; color: string }) {
  const { theme: t } = useTheme();
  const window = points.slice(-120); // ten years
  const values = window.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <View style={{ gap: 4 }}>
      <View style={[styles.spark, { backgroundColor: t.surface }]}>
        {window.map((p, i) => (
          <View
            key={p.date}
            style={{
              flex: 1,
              height: `${8 + ((p.value - min) / span) * 92}%`,
              backgroundColor: color,
              opacity: i === window.length - 1 ? 1 : 0.45,
            }}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {fmtMonth(window[0]?.date)}
        </Text>
        <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {min}–{max}%
        </Text>
        <Text style={[styles.caption, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {fmtMonth(window[window.length - 1]?.date)}
        </Text>
      </View>
    </View>
  );
}

// ── derived indicators ──────────────────────────────────────────────────────

function DerivedCard({ derived }: { derived: JoltsIndustry['derived'] }) {
  const { theme: t } = useTheme();

  const rows = [
    {
      label: 'Quits per layoff',
      value: derived.quitsToLayoffs?.toFixed(2),
      note:
        'Above ~2 means separations are mostly people choosing to leave rather than being removed. Same total separations either way — the composition is the whole difference.',
    },
    {
      label: 'Voluntary share of separations',
      value: derived.quitsShareOfSeparations != null ? `${derived.quitsShareOfSeparations}%` : undefined,
      note: 'The same reading scaled as a percentage, easier to follow as a trend.',
    },
    {
      label: 'Vacancy yield',
      value: derived.vacancyYield?.toFixed(3),
      note:
        'Hires produced per open posting per month. Falling yield while openings hold steady means postings are stale or speculative — the openings number is overstating how reachable those jobs are.',
    },
    {
      label: 'Net flow (hires − separations)',
      value: derived.netFlowRate != null ? `${signed(derived.netFlowRate, 'pp')}/mo` : undefined,
      note: 'Employment growth in one number. Near zero means the sector is treading water.',
    },
  ].filter((r) => r.value !== undefined);

  if (!rows.length) return null;

  return (
    <View style={[styles.card, { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md }]}>
      <Text style={[styles.cardTitle, { color: t.text, fontFamily: t.font.sans }]}>Composition</Text>
      <Text style={[styles.subtitle, { color: t.textFaint, fontFamily: t.font.sans }]}>
        What the individual rates hide. Tap for what each one catches.
      </Text>
      {rows.map((r) => (
        <DerivedRow key={r.label} label={r.label} value={r.value!} note={r.note} />
      ))}
    </View>
  );
}

function DerivedRow({ label, value, note }: { label: string; value: string; note: string }) {
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen((o) => !o);
      }}
      hitSlop={6}
    >
      <View style={styles.metricRow}>
        <Text style={[styles.metricLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          {label}
          <Text style={{ color: t.accent }}>{open ? '  ▾' : '  ⓘ'}</Text>
        </Text>
        <Text style={[styles.metricValue, { color: t.text, fontFamily: t.font.mono }]}>{value}</Text>
      </View>
      {open && (
        <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans, marginTop: 4 }]}>{note}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, marginBottom: 4, lineHeight: 17 },
  body: { fontSize: 12, lineHeight: 17 },
  caption: { fontSize: 11 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },

  stateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  stateName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  stamp: { fontSize: 11 },

  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1 },

  flowRow: { borderTopWidth: 1, paddingTop: 10, marginTop: 8 },
  flowLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  flowValue: { fontSize: 15, fontWeight: '700' },
  unit: { fontSize: 11, fontWeight: '500' },

  spark: { flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 1, borderRadius: 4, overflow: 'hidden', padding: 2 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 },
  metricLabel: { fontSize: 13, flexShrink: 1 },
  metricValue: { fontSize: 14, fontWeight: '600' },
});
