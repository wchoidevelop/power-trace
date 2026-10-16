import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Scored } from '@/lib/analyzer/types';
import { computeGini } from '@/lib/analyzer/helpers';
import { NarrativeAnalysis } from './NarrativeAnalysis';

export function Insights({ roles }: { roles: Scored[] }) {
  const { theme: t } = useTheme();

  const sorted = [...roles].sort(
    (a, b) => b.formalPower + b.informalInfluence - (a.formalPower + a.informalInfluence),
  );
  const shadow = roles
    .filter((r) => r.informalInfluence - r.formalPower > 25)
    .sort(
      (a, b) =>
        b.informalInfluence - b.formalPower - (a.informalInfluence - a.formalPower),
    );
  const periphery = roles
    .filter((r) => r.formalPower < 30 && r.informalInfluence < 35)
    .sort((a, b) => a.formalPower + a.informalInfluence - (b.formalPower + b.informalInfluence));
  const top = sorted[0];
  const second = sorted[1];
  const gini = computeGini(roles.map((r) => r.formalPower));
  const concentration =
    gini > 0.5 ? 'highly concentrated' : gini > 0.3 ? 'moderately concentrated' : 'relatively flat';

  return (
    <View style={{ gap: 16 }}>
      <View
        style={[
          styles.box,
          { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md },
        ]}
      >
        <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>Key observations</Text>
        {top && (
          <Line
            label="Most powerful overall"
            value={`${top.name} (${top.formalPower}/${top.informalInfluence}/${top.autonomy})`}
          />
        )}
        <Line
          label="Shadow power (influence ≫ formal)"
          value={shadow.length > 0 ? shadow.map((s) => s.name).join(', ') : 'None detected.'}
        />
        <Line
          label="Formal-power distribution"
          value={`${concentration} (Gini = ${gini.toFixed(2)})`}
        />
      </View>

      <NarrativeAnalysis
        roles={roles}
        top={top}
        second={second}
        shadow={shadow}
        periphery={periphery}
        gini={gini}
      />
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const { theme: t } = useTheme();
  return (
    <View style={{ marginTop: 6 }}>
      <Text style={[styles.label, { color: t.textMuted, fontFamily: t.font.sans }]}>{label}</Text>
      <Text style={[styles.value, { color: t.text, fontFamily: t.font.sans }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, padding: 16 },
  title: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  value: { fontSize: 14, marginTop: 2 },
});
