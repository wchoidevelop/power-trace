import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Stage } from '@/lib/analyzer/types';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Stepper } from '@/components/ui/Stepper';
import { ThemeControls } from '@/components/ui/ThemeControls';

export function Header({
  stage,
  liveStage,
  onStepPress,
  onReset,
  onOpenLibrary,
  onBack,
  omitStages,
}: {
  stage: Stage;
  liveStage?: Stage;
  onStepPress?: (s: Stage) => void;
  onReset: () => void;
  onOpenLibrary?: () => void;
  onBack?: () => void;
  /** stages this run skips, hidden from the stepper rather than shown unreachable */
  omitStages?: Stage[];
}) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.root}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={10} style={styles.backRow}>
          {({ pressed }) => (
            <Text
              style={[
                styles.back,
                { color: t.textMuted, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              ← Intro
            </Text>
          )}
        </Pressable>
      )}

      <View style={styles.titleRow}>
        <View style={styles.mark}>
          <Logo size={34} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: t.accent, fontFamily: t.font.sans }]}>
            POWER DYNAMICS
          </Text>
          <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>
            Power Trace
          </Text>
        </View>
        {onOpenLibrary && <Button label="Library" variant="ghost" onPress={onOpenLibrary} />}
        {(liveStage ?? stage) !== 'org' && <Button label="Reset" variant="ghost" onPress={onReset} />}
      </View>

      <Text style={[styles.subtitle, { color: t.textMuted, fontFamily: t.font.sans }]}>
        Mapping the invisible forces of influence
      </Text>

      <ThemeControls />
      <Stepper stage={stage} liveStage={liveStage} onStepPress={onStepPress} omit={omitStages} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingTop: 8 },
  backRow: { alignSelf: 'flex-start', marginBottom: -4 },
  back: { fontSize: 14, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  mark: { marginTop: 2 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 20 },
});
