import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Scored } from '@/lib/analyzer/types';

export function NarrativeAnalysis({
  roles,
  top,
  second,
  shadow,
  periphery,
  gini,
}: {
  roles: Scored[];
  top?: Scored;
  second?: Scored;
  shadow: Scored[];
  periphery: Scored[];
  gini: number;
}) {
  const { theme: t } = useTheme();
  const get = (id: string) => roles.find((r) => r.id === id);
  const ceo = get('ceo');
  const vp = get('vp-eng');
  const pm = get('pm');
  const ea = get('ea');
  const eng = get('eng');
  const designer = get('ic-design');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md },
      ]}
    >
      <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>
        Structural analysis
      </Text>
      <Text style={[styles.meta, { color: t.textMuted, fontFamily: t.font.sans }]}>
        Generated from post-adjustment scores, the bias-check pass, and I-O psychology frameworks.
      </Text>

      <NSection title="1. Executive summary">
        <NText>
          This organization shows a {gini > 0.45 ? 'steep' : 'moderate'} power gradient (Gini{' '}
          {gini.toFixed(2)} across {roles.length} roles).{' '}
          {top &&
            `Formal authority concentrates in ${top.name} (${top.formalPower}/100)${
              second
                ? `, with ${second.name} (${second.formalPower}/100) as the only meaningful secondary pole.`
                : '.'
            } `}
          At least {shadow.length || 'no'} role{shadow.length === 1 ? '' : 's'} exercise influence well above
          what their job description authorizes.
        </NText>
      </NSection>

      <NSection title="2. Power-base composition (French & Raven, 1959)">
        {ceo && (
          <Bullet>
            <NBold>{ceo.name}</NBold> draws on legitimate and reward power (formal {ceo.formalPower},
            autonomy {ceo.autonomy}). Risk is insulation from dissent.
          </Bullet>
        )}
        {vp && (
          <Bullet>
            <NBold>{vp.name}</NBold> holds the classic deputy position: high legitimate ({vp.formalPower})
            plus expert credibility. Headcount and roadmap clear here.
          </Bullet>
        )}
        {ea && (
          <Bullet>
            <NBold>{ea.name}</NBold> is a textbook case of informational power: formal {ea.formalPower} but
            influence {ea.informalInfluence}. Decisions can be prevented here.
          </Bullet>
        )}
        {designer && (
          <Bullet>
            <NBold>{designer.name}</NBold> uses pure expert and referent power (formal{' '}
            {designer.formalPower}, influence {designer.informalInfluence}). Most fragile base.
          </Bullet>
        )}
        {pm && (
          <Bullet>
            <NBold>{pm.name}</NBold> wields coordination authority (influence {pm.informalInfluence})
            without legitimate backing (formal {pm.formalPower}). Every decision is a negotiation.
          </Bullet>
        )}
      </NSection>

      {shadow.length > 0 && (
        <NSection title="3. The shadow-power problem">
          <NText>
            {shadow.map((s) => s.name).join(', ')} operate{shadow.length === 1 ? 's' : ''} with influence
            at least 25 points above formal authority — Goffman&apos;s &quot;backstage&quot; power.
            Decisions get shaped in conversations that never appear on the org chart.
          </NText>
        </NSection>
      )}

      <NSection title="4. Structural risks">
        <Bullet>
          <NBold>Groupthink at the top (Janis, 1972).</NBold>{' '}
          {ceo && vp
            ? `${ceo.name} and ${vp.name} carry ${ceo.formalPower + vp.formalPower} combined formal-power points; dissent has at most two checkpoints.`
            : 'When few roles hold >70% formal power, dissent has nowhere to land.'}
        </Bullet>
        <Bullet>
          <NBold>Asch conformity (1951).</NBold>{' '}
          {eng
            ? `${eng.name} sits at formal ${eng.formalPower}, influence ${eng.informalInfluence}. ~33% conformity rate is the baseline.`
            : 'Lower-left roles face the Asch dynamic by default.'}
        </Bullet>
        <Bullet>
          <NBold>Psychological-safety deficit (Edmondson, 1999).</NBold> With Gini {gini.toFixed(2)},
          errors get absorbed at the level where they occur — and only reach the top once compounded.
        </Bullet>
        {periphery.length > 0 && (
          <Bullet>
            <NBold>Exit risk (Hirschman, 1970).</NBold>{' '}
            {periphery.map((p) => p.name).join(', ')} score low on both axes. When voice is unavailable,
            employees default to exit or neglect.
          </Bullet>
        )}
      </NSection>

      <NSection title="5. Recommendations">
        <Numbered n={1}>
          <NBold>Formalize what is already informal.</NBold>{' '}
          {pm
            ? `Give ${pm.name} explicit decision rights on scope — or remove the coordination expectation.`
            : 'Match responsibility to authority to reduce equity-theory tension.'}
        </Numbered>
        <Numbered n={2}>
          <NBold>Add a structural devil&apos;s advocate.</NBold> Rotating role in exec meetings to argue
          against consensus. Janis&apos; own prescription.
        </Numbered>
        {ea && shadow.some((s) => s.id === 'ea') && (
          <Numbered n={3}>
            <NBold>Make {ea.name}&apos;s gatekeeping legible.</NBold> Publish the criteria. Informational
            power becomes corrosive only when invisible.
          </Numbered>
        )}
        <Numbered n={ea && shadow.some((s) => s.id === 'ea') ? 4 : 3}>
          <NBold>Run an Edmondson-style psych-safety survey.</NBold> Seven items, validated.
        </Numbered>
        <Numbered n={ea && shadow.some((s) => s.id === 'ea') ? 5 : 4}>
          <NBold>Audit attribution patterns in the last four perf cycles.</NBold> Look for the Ross
          asymmetry (1977).
        </Numbered>
      </NSection>

      <Text
        style={[
          styles.footnote,
          { color: t.textFaint, borderColor: t.border, fontFamily: t.font.sans },
        ]}
      >
        Frameworks: Milgram (1963), Asch (1951), Edmondson (1999), Adams (1965), Hirschman (1970),
        Hofstede (1980), French &amp; Raven (1959), Janis (1972), Steele (1997), Ross (1977),
        Goffman (1959). Demo: scores hardcoded.
      </Text>
    </View>
  );
}

function NSection({ title, children }: { title: string; children: ReactNode }) {
  const { theme: t } = useTheme();
  return (
    <View style={{ gap: 8, marginTop: 14 }}>
      <Text style={[styles.heading, { color: t.text, fontFamily: t.font.sans }]}>{title}</Text>
      {children}
    </View>
  );
}

function NText({ children }: { children: ReactNode }) {
  const { theme: t } = useTheme();
  return <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>{children}</Text>;
}

function NBold({ children }: { children: ReactNode }) {
  const { theme: t } = useTheme();
  return <Text style={{ color: t.text, fontWeight: '600' }}>{children}</Text>;
}

function Bullet({ children }: { children: ReactNode }) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.dot, { color: t.textFaint }]}>•</Text>
      <Text style={[styles.body, { color: t.textMuted, flex: 1, fontFamily: t.font.sans }]}>
        {children}
      </Text>
    </View>
  );
}

function Numbered({ n, children }: { n: number; children: ReactNode }) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.dot, { color: t.accent, fontWeight: '600', fontFamily: t.font.mono }]}>
        {n}.
      </Text>
      <Text style={[styles.body, { color: t.textMuted, flex: 1, fontFamily: t.font.sans }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, padding: 18 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  heading: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 13.5, lineHeight: 21 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { fontSize: 14, lineHeight: 21 },
  footnote: { fontSize: 11, lineHeight: 16, marginTop: 16, paddingTop: 12, borderTopWidth: 1 },
});
