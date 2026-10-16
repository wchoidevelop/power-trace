import { Section } from '@/components/ui/Section';
import { Loading } from '@/components/ui/Loading';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import type { StepError } from '@/lib/analyzer/types';

export function AnalysisStep({ error }: { error?: StepError }) {
  return (
    <Section heading="Analyzing situation" badge="LAYER 6">
      {error ? (
        <ErrorRetry error={error} title="Analysis failed" backLabel="Back to your situation" />
      ) : (
        <Loading label="Cross-referencing power map, labor data, and concepts" />
      )}
    </Section>
  );
}
