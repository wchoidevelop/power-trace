import { z } from "zod";

/**
 * Client-side mirror of the response shapes in server/lib/ai.ts.
 *
 * The prompts and the .describe() text live on the server — this file only needs
 * the field shapes, because these types are what the UI renders. When ai.ts
 * changes a shape, this file changes with it or the two silently disagree.
 */

/** stated — the description said it; implied — follows from what it said; assumed — defaulted from the role type. */
export const ProvenanceSchema = z.enum(['stated', 'implied', 'assumed']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

const PowerScore = z.object({
  score: z.number(),
  reasoning: z.string(),
  /**
   * Where the number came from, NOT how confident the model was. The questionnaire
   * layer asks about `assumed` cells; the UI can mark them as resting on a default
   * rather than on anything the user wrote.
   */
  provenance: ProvenanceSchema,
});

/**
 * Only the adjusted scores carry per-base uncertainty. The initial scoring layer
 * deliberately does not: deciding what is uncertain needs the whole map and the
 * ability to draft the question, so the questionnaire layer owns that judgment
 * and expresses it as the questions themselves.
 */
const AdjustedPowerScore = PowerScore.extend({
  is_uncertain: z.boolean(),
});

const scoreBlockOf = <T extends z.ZodTypeAny>(cell: T) =>
  z.object({
    legitimate:    cell,
    reward:        cell,
    coercive:      cell,
    expert:        cell,
    referent:      cell,
    informational: cell,
  });

const ScoreBlock = scoreBlockOf(PowerScore);
const AdjustedScoreBlock = scoreBlockOf(AdjustedPowerScore);

/** The six bases and the weights power_index is built from. Server is authoritative. */
export const POWER_WEIGHTS = {
  legitimate: 0.2,
  reward: 0.2,
  coercive: 0.15,
  expert: 0.15,
  referent: 0.15,
  informational: 0.15,
} as const;
export type PowerBase = keyof typeof POWER_WEIGHTS;
export const POWER_BASES = Object.keys(POWER_WEIGHTS) as PowerBase[];

/** The shape of a position's power, rather than a free-text label. */
export const PowerProfileSchema = z.enum([
  "positional",
  "resource_controller",
  "enforcer",
  "expert_authority",
  "social_hub",
  "gatekeeper",
  "figurehead",
  "diffuse",
]);
export type PowerProfile = z.infer<typeof PowerProfileSchema>;

/**
 * Who can impose a cost on this position. `target_id` is a role id when the
 * source is inside the mapped org, and null otherwise — so the UI must resolve
 * it to a name rather than printing the object.
 */
const MostExposedTo = z.object({
  kind: z.enum(["internal", "external", "none"]),
  target_id: z.string().nullable(),
  label: z.string(),
  basis: z.string(),
});
export type MostExposedToType = z.infer<typeof MostExposedTo>;

export const InitialScore = z.object({
  id: z.string(),
  position: z.string(),
  scores: ScoreBlock,
  power_profile: PowerProfileSchema,
  most_exposed_to: MostExposedTo,
});

export const Questionnaire = z.object({
  id: z.number(),
  question: z.string(),
  /** role IDS, not names — the UI resolves them for display */
  targets: z.array(z.string()),
  resolves: z.array(z.enum(["legitimate", "reward", "coercive", "expert", "referent", "informational"])),
  why_uncertain: z.string(),
  answer_format: z.enum(["open", "choose_one", "yes_no"]),
  options: z.array(z.string()).nullish(),
});

export const BiasFlag = z.object({
  type: z.enum([
    "self_minimization",
    "self_inflation",
    "antagonist_inflation",
    "threat_underweighting",
    "ally_halo",
    "victim_framing",
    "structural_normalization",
  ]),
  /** a role id */
  position_affected: z.string(),
  evidence: z.string(),
  inference: z.string(),
  /** the strongest case that this flag is wrong — shown alongside it, never hidden */
  alternative_reading: z.string(),
  severity: z.enum(["minor", "moderate", "significant"]),
  adjustment: z.string(),
});
export type BiasFlagType = z.infer<typeof BiasFlag>;

const DeltaBlock = z.object(
  Object.fromEntries(POWER_BASES.map((b) => [b, z.number()])) as Record<PowerBase, z.ZodNumber>,
);

/**
 * A role after adjustment. power_index, deltas, and moved are computed on the
 * server from the scores — never by the model, and never here.
 */
export const AdjustedRoleItem = z.object({
  id: z.string(),
  position: z.string(),
  scores: AdjustedScoreBlock,
  power_profile: PowerProfileSchema,
  most_exposed_to: MostExposedTo,
  adjustment_notes: z.string(),
  /** `type` of each bias flag whose correction is already in the scores above */
  bias_corrections_applied: z.array(z.string()),
  power_index: z.number(),
  /** per-base change vs. the initial scoring; null when there was no initial score */
  deltas: DeltaBlock.nullable(),
  moved: z.boolean().nullable(),
});

export const AdjustedRole = z.object({
  bias_flags: z.array(BiasFlag),
  adjusted_roles: z.array(AdjustedRoleItem),
  confidence: z.enum(['low', 'medium', 'high']),
  confidence_rationale: z.string(),
});

const Concept = z.object({
  /** whitelist key the server enriches with term/researcher/year */
  framework: z.string(),
  term: z.string(),
  researcher: z.string(),
  year: z.number(),
  how_it_applies: z.string(),
  what_most_people_do_wrong: z.string(),
  recommended_action: z.string(),
});

export const SituationAnalysis = z.object({
  situation_label: z.string(),
  structural_diagnosis: z.string(),
  // named for the UI, but this is about market leverage, not how common the
  // situation is — JOLTS cannot support a prevalence claim
  prevalence: z.object({
    description: z.string(),
    data_point: z.string(),
    source: z.string(),
  }),
  concepts: z.array(Concept),
  power_position_note: z.string(),
  evln_prediction: z.object({
    most_likely_response: z.enum(["Exit", "Voice", "Loyalty", "Neglect"]),
    why: z.string(),
    better_alternative: z.string(),
  }),
});

export type SituationAnalysisType = z.infer<typeof SituationAnalysis>;
export type InitialScoreType = z.infer<typeof InitialScore>;
export type ScoreType = InitialScoreType & { power_index: number };
export type QuestionnaireType = z.infer<typeof Questionnaire>;
export type QuestionAnswer = QuestionnaireType & { answer: string; id: string | number };
export type AdjustedRoleType = z.infer<typeof AdjustedRole>;
export type AdjustedRoleItemType = z.infer<typeof AdjustedRoleItem>;
