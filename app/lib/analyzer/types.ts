export type Stage =
  | 'org'
  | 'roles'
  | 'scoring'
  | 'questionnaire'
  | 'adjusting'
  | 'bias'
  | 'labor'
  | 'situation'
  | 'analysis'
  | 'viz';

/** The pipeline stages that call the API and can therefore fail. */
export type StepId = 'scoring' | 'questionnaire' | 'adjusting' | 'labor' | 'analysis';

export type StepFailure = {
  step: StepId;
  /** one sentence, already user-readable */
  message: string;
  code: string;
  /** false for errors that will fail identically on a second try (e.g. a 400) */
  retryable: boolean;
  /** attempts already spent inside the transport layer */
  attempts: number;
};

/**
 * Anything the ErrorRetry card can render. Pipeline steps supply a StepFailure;
 * screens that just fetch something (the legal documents, say) supply the two
 * fields that actually matter.
 */
export type RetryableError = {
  message: string;
  retryable: boolean;
  code?: string;
  attempts?: number;
  onRetry: () => void;
  /** omitted when there is nowhere to go back to */
  onBack?: () => void;
};

/** What a step component needs to render its own failure state. */
export type StepError = StepFailure & {
  onRetry: () => void;
  /** returns to the last stage the user can edit, clearing the failure */
  onBack: () => void;
};

export type Role = { id: string; name: string; description: string, isUserRole?: boolean };

export type Scored = Role & {
  formalPower: number;
  informalInfluence: number;
  autonomy: number;
  confidence: number;
};

export type Question = {
  id: string;
  roleId: string;
  text: string;
  dimension: 'formalPower' | 'informalInfluence' | 'autonomy';
};

export type Answer = 'yes' | 'no' | 'unsure';

export type BiasFinding = {
  roleId: string;
  category: string;
  detail: string;
  suggestion: string;
};
