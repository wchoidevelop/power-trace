import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import type { RetryableError } from '@/lib/analyzer/types';

/**
 * The failure state for a pipeline step. Every step that calls the API renders
 * this in place of its spinner when the call fails, so a failure is always a
 * tap away from being re-run rather than a stalled screen.
 *
 * When the error is not retryable — a rejected payload, a missing user role —
 * the retry button is withheld and only the way back is offered. Showing a
 * retry that is guaranteed to fail again is worse than showing none.
 */
export function ErrorRetry({
  error,
  title = 'This step failed',
  backLabel = 'Go back',
  extraAction,
}: {
  error: RetryableError;
  title?: string;
  backLabel?: string;
  /** a third way out, where one exists — e.g. continuing without this step's data */
  extraAction?: { label: string; onPress: () => void };
}) {
  const { theme: t } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: t.danger, borderRadius: t.radius.md },
      ]}
    >
      <Text style={[styles.title, { color: t.danger, fontFamily: t.font.sans }]}>{title}</Text>
      <Text style={[styles.message, { color: t.text, fontFamily: t.font.sans }]}>{error.message}</Text>

      {error.attempts != null && error.attempts > 1 && (
        <Text style={[styles.meta, { color: t.textFaint, fontFamily: t.font.mono }]}>
          {error.attempts} attempts{error.code ? ` · ${error.code}` : ''}
        </Text>
      )}

      <View style={styles.actions}>
        {error.retryable && <Button label="Try again" variant="primary" onPress={error.onRetry} />}
        {extraAction && (
          <Button label={extraAction.label} variant="secondary" onPress={extraAction.onPress} />
        )}
        {error.onBack && <Button label={backLabel} variant="ghost" onPress={error.onBack} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  message: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
});
