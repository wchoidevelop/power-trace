import { Section } from '@/components/ui/Section';
import { Loading } from '@/components/ui/Loading';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import type { StepError } from '@/lib/analyzer/types';

export function AdjustingStep({ error }: { error?: StepError }) {
  return (
    <Section heading="Adjusting scores" badge="LAYER 3">
      {error ? (
        <ErrorRetry error={error} title="Adjustment failed" backLabel="Back to questionnaire" />
      ) : (
        <Loading label="Reweighting based on your answers" />
      )}
    </Section>
  );
}
