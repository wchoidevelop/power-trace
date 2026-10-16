import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Stage } from '@/lib/analyzer/types';

const STEPS: { key: Stage; label: string }[] = [
  { key: 'org', label: 'Org' },
  { key: 'roles', label: 'Roles' },
  { key: 'scoring', label: 'Score' },
  { key: 'questionnaire', label: 'Clarify' },
  { key: 'adjusting', label: 'Adjust' },
  { key: 'bias', label: 'Bias' },
  { key: 'labor', label: 'Labor' },
  { key: 'situation', label: 'Situation' },
  { key: 'analysis', label: 'Analyze' },
  { key: 'viz', label: 'Map' },
];

// pure loading stages have no reviewable content, so they aren't tappable
const NON_REVIEWABLE = new Set<Stage>(['adjusting', 'analysis']);

export function Stepper({
  stage,
  liveStage,
  onStepPress,
  omit,
}: {
  stage: Stage;
  liveStage?: Stage;
  onStepPress?: (s: Stage) => void;
  /** stages this run will not visit — the labor step for an unpaid organization */
  omit?: Stage[];
}) {
  const { theme: t } = useTheme();
  // numbering comes from the filtered list, so a skipped stage leaves no gap
  const steps = omit?.length ? STEPS.filter((s) => !omit.includes(s.key)) : STEPS;
  const activeIdx = steps.findIndex((s) => s.key === stage);
  const maxIdx = steps.findIndex((s) => s.key === (liveStage ?? stage));
  return (
    <View style={styles.row}>
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const reached = i <= maxIdx;
        const done = reached && !active;
        const navigable = !!onStepPress && reached && !NON_REVIEWABLE.has(s.key);
        const chip = (
          <View
            style={[
              styles.chip,
              {
                backgroundColor: active ? t.accent : done ? t.surfaceMuted : 'transparent',
                borderColor: active ? t.accent : t.border,
              },
            ]}
          >
            <Text
              style={[
                styles.text,
                {
                  color: active ? '#ffffff' : done ? t.textMuted : t.textFaint,
                  fontFamily: t.font.mono,
                },
              ]}
            >
              {i + 1} · {s.label}
            </Text>
          </View>
        );
        if (!navigable) return <View key={s.key}>{chip}</View>;
        return (
          <Pressable
            key={s.key}
            onPress={() => onStepPress!(s.key)}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {chip}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  text: { fontSize: 11, fontWeight: '600' },
});
