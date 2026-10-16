import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { TextBox } from '@/components/ui/TextBox';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import type { StepError } from '@/lib/analyzer/types';

export function SituationStep({
  situation,
  setSituation,
  onAnalyze,
  readOnly,
  error,
}: {
  situation: string;
  setSituation: (v: string) => void;
  onAnalyze: () => void;
  readOnly?: boolean;
  /** analysis failures that happened before the request left the device */
  error?: StepError;
}) {
  return (
    <Section
      heading="Describe the situation"
      caption="A concrete event, conflict, or decision you want analyzed against the power map."
      badge="LAYER 6"
    >
      <TextBox
        label="Situation"
        subLabel="Who's involved, what happened, what's at stake."
        value={situation}
        onChangeText={setSituation}
        placeholder="My manager rerouted a project I led to another team during a reorg..."
        lines={6}
        editable={!readOnly}
      />
      {error && <ErrorRetry error={error} title="Analysis could not start" backLabel="Back to the power map" />}
      {!readOnly && (
        <Button
          label="Analyze →"
          variant="accent"
          onPress={onAnalyze}
          disabled={!situation.trim()}
        />
      )}
    </Section>
  );
}
