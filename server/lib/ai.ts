/**
 * Power Map pipeline — embeddings, classification, scoring, questionnaire,
 * adjustment/bias audit, and situation analysis.
 *
 * French & Raven 6-dimension model: legitimate, reward, coercive, expert,
 * referent, informational.
 *
 * INVARIANTS (violating any of these is what broke the previous version):
 *   1. Position ids flow through EVERY layer. A layer that must emit an id
 *      must have been given the id list. Never join on position name.
 *   2. power_index is computed in code, never by a model. It is a pure
 *      function of the six scores.
 *   3. Every model call goes through responses.parse(). No JSON.parse on
 *      output_text — that skips validation and turns truncation into a
 *      SyntaxError with no context.
 *   4. Output shape lives in the Zod schema, not in the prompt. Duplicating
 *      it drifts.
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { SOC, CPS } from "./types";
import { getDb } from "./db";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ────────────────────────────────────────────────────────────────
   MODEL TIERS
   Named centrally so the reasoning-heavy layers can't silently end
   up on a nano model again.
   ──────────────────────────────────────────────────────────────── */

const MODELS = {
  /** Cheap, high-volume, structured extraction with candidates supplied. */
  classify: "gpt-5.4-nano",
  /** Judgment-heavy: scoring, questionnaire design, bias audit. */
  reason: "gpt-5.6-luna",
  /** Long-form synthesis with tight style constraints. */
  synthesize: "gpt-5.4-mini",
} as const;

/* ────────────────────────────────────────────────────────────────
   SHARED PRIMITIVES
   ──────────────────────────────────────────────────────────────── */

export const StageSchema = z.enum([
  "org",
  "roles",
  "scoring",
  "questionnaire",
  "adjusting",
  "bias",
  "viz",
]);
export type Stage = z.infer<typeof StageSchema>;

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

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

const clampScore = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

const SCORE_RANGE_DESC =
  "Integer 0-10. 0 = absent, 1-2 negligible, 3-4 weak, 5-6 moderate, " +
  "7-8 strong, 9-10 dominant. Calibrate against the other positions in this " +
  "input, not against organizations in general.";

const PowerScore = z.object({
  score: z.number().int().describe(SCORE_RANGE_DESC),
  reasoning: z
    .string()
    .describe(
      "One sentence citing the specific text or inference that drove this score. " +
        "Do not restate the definition of the power base."
    ),
  /**
   * Provenance, not confidence. "Where did this number come from?" is a fact about
   * the input text that anyone can re-check; "how sure am I?" is introspection
   * models report badly. Downstream layers filter on this, so it is an enum rather
   * than a phrase buried in the reasoning.
   */
  provenance: z
    .enum(["stated", "implied", "assumed"])
    .describe(
      "stated — the description explicitly names this resource, authority, or control. " +
        "implied — not named, but follows necessarily from something that is named. " +
        "assumed — nothing in the description bears on this base; defaulted from what " +
        "this kind of role usually looks like. Records where the score came from, " +
        "never how confident you are in it."
    ),
});

/**
 * The adjust layer reports per-base uncertainty, because by then there is no
 * further round of questions to feed: the flag describes the finished map rather
 * than queueing work.
 *
 * The scoring layer deliberately does NOT carry it. Deciding "could a question
 * move this score?" needs the whole distribution and the ability to draft the
 * question; only the questionnaire layer has both, and it works from `provenance`
 * — see LAYER2B_QUESTIONNAIRE_SYSTEM.
 */
const AdjustedPowerScore = PowerScore.extend({
  is_uncertain: z
    .boolean()
    .describe(
      "true if, even after the answers, the evidence for this base is thin or " +
        "contradictory. false otherwise."
    ),
});

/**
 * One definition of the six keys, two cell shapes. Writing the block out twice
 * is how the bases drift apart between layers.
 */
const scoreBlockOf = <T extends z.ZodTypeAny>(cell: T) =>
  z
    .object({
      legitimate: cell.describe("A social norm obliges the target to comply."),
      reward: cell.describe("Can deliver positive outcomes for compliance."),
      coercive: cell.describe("Can impose costs for noncompliance."),
      expert: cell.describe("Trusted judgment; target complies without understanding why."),
      referent: cell.describe("Identification, admiration, shared 'we'."),
      informational: cell.describe(
        "Supplies content the target understands and accepts on its merits; controls what reaches whom."
      ),
    })
    .describe("The six French & Raven power bases, scored independently. They do not sum to a fixed total.");

const ScoreBlock = scoreBlockOf(PowerScore);
const AdjustedScoreBlock = scoreBlockOf(AdjustedPowerScore);

const PowerProfile = z
  .enum([
    "positional",
    "resource_controller",
    "enforcer",
    "expert_authority",
    "social_hub",
    "gatekeeper",
    "figurehead",
    "diffuse",
  ])
  .describe(
    "The shape of this position's power: " +
      "positional (legitimate dominates); resource_controller (reward dominates); " +
      "enforcer (coercive dominates); expert_authority (expert dominates); " +
      "social_hub (referent dominates); gatekeeper (informational dominates); " +
      "figurehead (high legitimate, low everything else — title without traction); " +
      "diffuse (no single base stands out)."
  );

const MostExposedTo = z
  .object({
    kind: z
      .enum(["internal", "external", "none"])
      .describe(
        "'internal' — another position in this input. 'external' — outside the mapped " +
          "org (board, regulator, key client, funder). 'none' — no meaningful exposure identified."
      ),
    target_id: z
      .string()
      .nullable()
      .describe(
        "The id of the internal position, copied exactly from the input id list. " +
          "Null when kind is 'external' or 'none'."
      ),
    label: z
      .string()
      .describe("Readable name of the source of exposure. Empty string when kind is 'none'."),
    basis: z
      .string()
      .describe(
        "One sentence: what this position stands to lose, and through which power base " +
          "the other party could impose it."
      ),
  })
  .describe(
    "The single party best positioned to impose a cost this position could not readily " +
      "absorb or route around."
  );

export type ScoreBlockType = z.infer<typeof ScoreBlock>;
export type AdjustedScoreBlockType = z.infer<typeof AdjustedScoreBlock>;

/** The one place power_index is defined. Models never compute this. */
export function powerIndex(scores: ScoreBlockType): number {
  const raw = POWER_BASES.reduce(
    (sum, b) => sum + clampScore(scores[b].score) * POWER_WEIGHTS[b],
    0
  );
  return Math.round(raw * 100) / 100;
}

/** Generic so the adjust layer's extra per-cell fields survive the clamp. */
function clampBlock<T extends ScoreBlockType>(scores: T): T {
  return Object.fromEntries(
    POWER_BASES.map((b) => [b, { ...scores[b], score: clampScore(scores[b].score) }])
  ) as T;
}

/** Narrow a parsed response or fail loudly with the reason. */
function requireParsed<T>(
  label: string,
  res: { output_parsed: T | null; status?: string | null; incomplete_details?: unknown }
): T {
  if (!res.output_parsed) {
    const why =
      res.status === "incomplete"
        ? `incomplete: ${JSON.stringify(res.incomplete_details)}`
        : `status=${res.status ?? "unknown"} (possible refusal)`;
    throw new Error(`${label}: model returned no parsed output — ${why}`);
  }
  return res.output_parsed;
}

/**
 * Time a model call and say so. Every layer here runs long enough that "is it
 * working or is it wedged?" is a real question, and the answer has to come from
 * the log rather than from guessing. Also the only way to see the OpenAI SDK's
 * own internal retries: two silent 5xx retries look exactly like one slow call.
 */
async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[ai] ${label} → calling model`);
  try {
    const out = await fn();
    console.log(`[ai] ${label} ← model answered in ${secs()}s`);
    return out;
  } catch (err) {
    console.error(`[ai] ${label} ✗ failed after ${secs()}s:`, (err as Error)?.message);
    throw err;
  }
}

/** Roles serialized for the model. Ids ALWAYS included. */
const rolesForModel = (roles: Role[]) =>
  JSON.stringify(
    roles.map((r) => ({ id: r.id, position: r.name, description: r.description })),
    null,
    2
  );

/* ────────────────────────────────────────────────────────────────
   LABOR-MARKET INPUT TYPES
   These are never sent to zodTextFormat — they describe data we
   fetch, so .optional()/.partial() are safe here.
   ──────────────────────────────────────────────────────────────── */

const WageUnionCut = z.object({
  // from CPS LE
  women: z.number().optional(),
  men: z.number().optional(),
  women_pct_of_men: z.number().optional(),
  // from CPS LU
  coverage: z.number().optional(),
  union_wages: z.number().optional(),
  nonunion_wages: z.number().optional(),
});

/**
 * A JOLTS rate plus its position in its own history. The bare rate is not
 * interpretable on its own — 1.9% quits is high for information and low for
 * leisure & hospitality — so every rate arrives with where it sits.
 *   z          — SDs from the 2015-19 (pre-COVID normal) mean
 *   percentile — rank against the full ~19-year pull, including 2009 and 2022
 */
const FlowScore = z.object({
  latest: z.number(),
  date: z.string(), // 'YYYY-MM'
  preliminary: z.boolean().optional(),
  baselineMean: z.number().nullish(),
  z: z.number().nullish(),
  percentile: z.number().nullish(),
  change3m: z.number().nullish(), // percentage points
  change12m: z.number().nullish(),
});

// from JOLTS — sector level only, no occupation breakdown
const SectorFlows = z.object({
  label: z.string().optional(),
  asOf: z.string().nullish(),
  preliminary: z.boolean().optional(),
  baseline: z.string().optional(),

  state: z
    .enum(["tight", "frozen", "contracting", "reallocating", "balanced", "unknown"])
    .optional(),
  stateDescription: z.string().optional(),

  rates: z
    .object({
      quits: FlowScore.nullish(),
      layoffs: FlowScore.nullish(),
      job_openings: FlowScore.nullish(),
      hires: FlowScore.nullish(),
      total_separations: FlowScore.nullish(),
    })
    .partial()
    .optional(),

  derived: z
    .object({
      quitsToLayoffs: z.number().nullish(),
      quitsShareOfSeparations: z.number().nullish(),
      vacancyYield: z.number().nullish(),
      netFlowRate: z.number().nullish(),
    })
    .partial()
    .optional(),

  workerPowerIndex: z.number().nullish(),
});

const NationalContext = z
  .object({
    vacanciesPerUnemployed: z.number().nullish(),
    asOf: z.string().nullish(),
    change12m: z.number().nullish(),
  })
  .partial();

export const LaborDataSchema = z.object({
  labels: z.object({
    cps_le_industry: z.string().optional(),
    cps_le_occupation: z.string().optional(),
    cps_lu_industry: z.string().optional(),
    cps_lu_occupation: z.string().optional(),
    jolts_supersector: z.string().optional(),
  }),
  industry: WageUnionCut.optional(),
  occupation: WageUnionCut.optional(),
  sector: SectorFlows.optional(),
  national: NationalContext.optional(),
});
export type LaborData = z.infer<typeof LaborDataSchema>;

/* ────────────────────────────────────────────────────────────────
   RETRIEVAL
   ──────────────────────────────────────────────────────────────── */

export function toEmbedInput(entry: SOC) {
  // Richer text = better retrieval
  return `${entry.SOCTitle}. ${entry.SOCDefinition}`.trim();
}

const cpsTypes = ["le", "lu_wages"] as const;

export async function findOccupations(userQuery: string, { group = "Detailed", k = 5 } = {}) {
  const db = await getDb();
  const col = db.collection("soc");
  const cps = db.collection("cps");

  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: userQuery,
  });
  const queryVector = res.data[0].embedding;

  const makeVectorStage = (filter?: Record<string, string>) => ({
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector,
      numCandidates: k * 10,
      limit: k,
      ...(filter ? { filter } : {}),
    },
  });

  const [soc, ...cpsResults] = await Promise.all([
    col
      .aggregate([
        makeVectorStage(group ? { SOCGroup: group } : undefined),
        {
          $project: {
            _id: 0,
            SOCCode: 1,
            SOCTitle: 1,
            SOCDefinition: 1,
            SOCGroup: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
      .toArray() as Promise<SOC[]>,
    ...cpsTypes.map((type) =>
      cps
        .aggregate([
          makeVectorStage({ type }),
          {
            $project: {
              _id: 0,
              occupation_code: 1,
              occupation_text: 1,
              type: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray()
    ),
  ]);

  const cpsGrouped = Object.fromEntries(
    cpsTypes.map((type, i) => [type, cpsResults[i]])
  ) as Record<(typeof cpsTypes)[number], CPS[]>;

  return { soc, cps: cpsGrouped };
}

export async function classifyIndustryOccupation(
  orgDescription: string,
  userRole: string,
  SOCCandidates: SOC[],
  LECandidates: CPS[],
  LUCandidates: CPS[]
) {
  const response = await openai.responses.create({
    model: MODELS.classify,
    prompt: {
      id: "pmpt_69fc551b083481949eb6a1c6da33538b099c95a6d7edabfa",
      variables: {
        orgdescription: orgDescription,
        userrole: userRole,
        soccandidates: JSON.stringify(SOCCandidates),
        lecandidates: JSON.stringify(LECandidates),
        lucandidates: JSON.stringify(LUCandidates),
      },
    },
  });
  return response.output_text;
}

/* ────────────────────────────────────────────────────────────────
   LAYER 2 — initial scoring
   Route: POST /api/scoreRoles
   ──────────────────────────────────────────────────────────────── */

export const InitialScore = z.object({
  id: z
    .string()
    .describe("The position's id, copied exactly from the input. Never invent, renumber, or omit."),
  position: z.string().describe("The position's title, copied verbatim from the input."),
  scores: ScoreBlock,
  power_profile: PowerProfile,
  most_exposed_to: MostExposedTo,
});

export type InitialScoreType = z.infer<typeof InitialScore>;
export type ScoreType = InitialScoreType & { power_index: number };

export const LAYER2_SCORE_SYSTEM = `You are an organizational power analyst trained in French and Raven's six bases of social power.
 
SIX BASES OF POWER — SCORING REFERENCE (French & Raven, 1959; Raven, 2004)
 
Definitions
- Social influence = a change in the belief, attitude, or behavior of a TARGET
  resulting from the action of an AGENT.
- Social power = the POTENTIAL for such influence — the agent's ability to bring
  about that change with available resources.
Score the agent's POTENTIAL (available resource), not whether they used it.
 
The six bases
 
1. INFORMATIONAL POWER — the agent supplies content/logic/evidence the target
   understands and accepts on its own merits. Produces socially INDEPENDENT change:
   the target keeps the new behavior without reference to the agent.
   Cues: "That argument makes sense." Reasoning is transparent and checkable.
   Distinguishing test: the target understands WHY. (If they comply without
   understanding, it's Expert, not Informational.)
 
2. REWARD POWER — the agent can deliver positive outcomes for compliance.
   Impersonal: pay, promotion, privileges, resources, access.
   Personal: approval, praise, warmth from someone the target values.
   Socially dependent AND requires surveillance (the agent must be able to tell
   whether the target complied). Surveillance is easy here — targets advertise
   compliance to collect.
   Cues: "I did it because there was something in it for me."
 
3. COERCIVE POWER — the agent can impose negative outcomes for noncompliance.
   Impersonal: demotion, termination, fines, bad assignments.
   Personal: rejection, disapproval, withdrawal of regard.
   Socially dependent AND requires surveillance, which is harder — targets hide
   noncompliance. Tends to generate resentment toward both the behavior and the agent.
   Cues: "I did it because of what happens if I don't."
 
4. LEGITIMATE POWER — a social norm obliges the target to comply. Socially dependent
   but NO surveillance needed. Signal words: should, ought, must, obliged, required.
   Four subtypes:
   - Position: formal/informal rank (supervisor, officer, parent, teacher).
   - Reciprocity: "I did something for you, so you owe me."
   - Equity (compensatory): "I've suffered/worked hard, so you owe me."
   - Responsibility / dependence ("power of the powerless"): "I depend on you;
     you have an obligation to help someone who can't help themselves."
 
5. EXPERT POWER — the target believes the agent has superior knowledge or judgment
   and complies WITHOUT understanding the reasoning. Socially dependent, no
   surveillance needed.
   Cues: "She's done this a hundred times, so she's probably right."
   Distinguishing test: trust in the source, not comprehension of the argument.
 
6. REFERENT POWER — the target identifies with the agent: admires them, wants to be
   like them, or feels a shared "we." Socially dependent, no surveillance needed.
   Cues: "Doing it her way feels right to me." Built via similarity and communality.
   Note: leaning on referent power can undercut perceived expertise and position.
 
Grouping (Raven, Schwarzwald & Koslowsky, 1998)
- SOFT: Informational, Expert, Referent, Legitimate-Responsibility.
  Associated with higher job satisfaction.
- HARSH: both Reward forms, both Coercive forms, Legitimate Position/Reciprocity/Equity.
  Associated with lower job satisfaction.
 
INPUT
You receive an organization description and a list of positions. Every position
carries an "id". Ids are fixed. Copy each id verbatim into your output. Never
invent an id, never renumber, and never substitute a position name where an id is
asked for. Return every position you were given.

SCORING — rate each of the six bases 0–10 independently.
Bases are NOT mutually exclusive and do NOT sum to a fixed total. An agent can be
high on several, or near zero on all.

Score what the role ACTUALLY controls, not what its title implies — a "Senior"
title with no described authority is not legitimate power.

Anchors (apply to each base separately):
 0  Absent. No such resource exists in this relationship.
 1–2 Negligible. Theoretically present but the target would not register it.
 3–4 Weak. Occasionally relevant; easily overridden by any competing base.
 5–6 Moderate. A real, recognized resource; moves the target on ordinary matters
     but not on ones they care about.
 7–8 Strong. Reliably shifts behavior, including on issues where the target
     initially disagrees.
 9–10 Dominant. Would by itself secure compliance on high-stakes matters; the
     defining feature of this relationship.
 
Scoring rules
1. Score the agent's potential as PERCEIVED BY THE TARGET, not objective resources.
   Unbelieved coercion is weak coercion.
2. Reward and Coercive scores are capped by surveillance: if the agent cannot detect
   compliance, cap at 4 regardless of resources.
3. Informational vs. Expert: does the target understand the reasoning (Informational)
   or trust the source (Expert)? Score whichever fits; do not double-count the same
   evidence at full weight in both.
4. Legitimate: name the subtype (position / reciprocity / equity / responsibility) in
   the rationale; score the strongest, and note others present.
5. Reward and Coercive: state whether the basis is personal, impersonal, or both.
6. Score every base for every position. You will often have to default from the role
   type — that is expected and is not a failure. Record where the score came from in
   the "provenance" field rather than refusing to score.
7. Flag the harsh/soft balance and any metamorphic risk (heavy coercion + surveillance
   escalating into distrust and harsher strategies over time) in the relevant reasoning
   fields.

THE PROVENANCE FIELD — read this carefully, it is the most commonly misused field
"provenance" records where the number CAME FROM, not your confidence in it. It answers
"where did this number come from?", never "how sure am I?".

- stated   — the description explicitly names the resource, authority, or control.
             "approves budget over $50k" → reward is stated.
- implied  — not named, but it follows necessarily from something that IS named.
             "runs the weekly leadership meeting" → informational is implied, because
             agenda control follows from it.
- assumed  — nothing in the description bears on this base, and you are defaulting
             from what this kind of role usually looks like. A director you were told
             nothing else about probably has moderate legitimate power; that is an
             assumption, and labelling it one is the correct, expected behaviour.

Calibration. Role descriptions here are typically one or two sentences. They usually
speak to formal authority and resource control, and rarely to how people feel about
the person. So expect a distribution roughly like this per position:
  - legitimate and reward — usually stated or implied
  - coercive and expert   — mixed
  - referent and informational — usually assumed
Two to four "assumed" cells per position is normal and correct. Do not treat that as
a problem to be avoided, and do not inflate a cell to "implied" to look more rigorous.
The opposite error matters too: marking something "assumed" when the description
plainly states it makes the label meaningless. Use "stated" whenever the text supports
it.

Never lower a score because you are unsure of it. An assumed score should be your
best estimate, not a hedge toward the middle for its own sake.

EXPOSURE
For each position, identify the single party best positioned to impose a cost it
could not readily absorb or route around. If that party is another position in this
input, set kind to "internal" and target_id to that position's id. If it sits
outside the mapped organization (board, regulator, key client, funder), set kind to
"external" and target_id to null. If nothing meaningful applies, use "none".

Do not compute any composite or aggregate index. That is handled downstream.`;

export const generateInitialScoring = async ({
  org,
  roles,
}: {
  org: string;
  roles: Role[];
}): Promise<ScoreType[]> => {
  const res = await timed("scoring", () =>
    openai.responses.parse({
      model: MODELS.reason,
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: LAYER2_SCORE_SYSTEM },
        {
          role: "user",
          content: `<organization>\n${org}\n</organization>\n\n<positions>\n${rolesForModel(
            roles
          )}\n</positions>`,
        },
      ],
      text: {
        format: zodTextFormat(
          z.object({ initial_score: z.array(InitialScore) }),
          "initial_score"
        ),
        verbosity: 'low'
      },
    })
  );

  const { initial_score } = requireParsed("generateInitialScoring", res);

  const known = new Set(roles.map((r) => r.id));
  const unknown = initial_score.filter((r) => !known.has(r.id)).map((r) => r.id);
  if (unknown.length) {
    throw new Error(`generateInitialScoring: model returned unknown ids: ${unknown.join(", ")}`);
  }
  if (initial_score.length !== roles.length) {
    console.warn(
      `generateInitialScoring: expected ${roles.length} positions, got ${initial_score.length}`
    );
  }

  return initial_score.map((r) => {
    const scores = clampBlock(r.scores);
    return { ...r, scores, power_index: powerIndex(scores) };
  });
};

/* ────────────────────────────────────────────────────────────────
   LAYER 2b — questionnaire generation
   Route: POST /api/genQuestions
   ──────────────────────────────────────────────────────────────── */

export const Questionnaire = z.object({
  question: z
    .string()
    .describe(
      "Plain language a non-expert inside the organization can answer. Refer to positions " +
        "by their NAME here, not their id. Ask about observable behavior or specific events, " +
        "never abstract opinion."
    ),
  targets: z
    .array(z.string())
    .describe(
      "Position ids this question is about, copied exactly from the input. Exactly one id " +
        "unless answer_format is 'open'."
    ),
  resolves: z
    .array(z.enum(["legitimate", "reward", "coercive", "expert", "referent", "informational"]))
    .describe("The power bases whose uncertainty this question is designed to resolve."),
  why_uncertain: z.string().describe("One sentence: what specifically is unclear in the current scoring."),
  answer_format: z.enum(["open", "choose_one", "yes_no"]),
  options: z
    .array(z.string())
    .nullable()
    .describe(
      "The selectable choices when answer_format is 'choose_one'. Must be null for " +
        "'open' and 'yes_no'. Never omit the key — use null."
    ),
});

export type QuestionnaireType = z.infer<typeof Questionnaire> & { id: number };
export type QuestionAnswer = QuestionnaireType & { answer: string };

export const LAYER2B_QUESTIONNAIRE_SYSTEM = `You are an organizational power analyst.

You will receive:
- The original scoring context: organization description and the position list, each with an id.
- The power scores you previously generated for those positions.

Design a short, targeted questionnaire that resolves the remaining uncertainties in
those scores.

STEP 1 — DECIDE WHICH SCORES ARE WORTH ASKING ABOUT
Every score carries a "provenance": stated, implied, or assumed. That tells you where
the number came from — not how confident anyone was in it.

Your candidates are the "assumed" cells, and only those. A "stated" score came out of
the description, so asking about it wastes a question; an "implied" score follows
necessarily from something stated, so an answer cannot move it without contradicting
the text. An assumed score, by contrast, is the scorer's default for that kind of role
— a reasonable guess about this org that the user can simply confirm or overturn.

Two to four assumed cells per position is normal, so you will have more candidates than
questions. Filtering them is the actual work of this step, and it is yours because it
needs two things only you have: the whole map at once, and the ability to try drafting
the question.

Prioritize among the assumed cells by:
1. WEIGHT. legitimate and reward move a position's overall standing most; the other
   four matter equally and less. An assumed legitimate score is worth more than an
   assumed referent score, all else equal.
2. DIFFERENTIATION. Two positions sitting close on the same base, where the ordering
   between them matters, and at least one of those scores is assumed. You can see this
   comparison; the scorer, working position by position, could not.
3. DRAFTABILITY. Can you write a one-line question about observable behavior that
   would settle it? If you cannot draft the question, there is nothing to ask, however
   thin the evidence was.

Do not ask about an assumed cell when the default is simply correct. A junior IC almost
certainly has near-zero reward power; that is an assumption AND it is right. The
question has to be one where a real answer could plausibly land either way.

Never treat a score's position on the 0-10 scale as evidence of anything. A confident 5
is a genuine mid-range resource, and an assumed 9 is still an assumption. Provenance is
what tells you a number was defaulted; the number itself does not.

STEP 2 — WRITE ONE QUESTION PER UNCERTAINTY
Each question must:
- Be answerable by a non-expert inside the organization.
- Name real positions in the question text, using their NAMES.
- Put the corresponding position IDS in "targets".
- Ask about specific observable behavior or events, not abstract opinion.
- Map to one or more specific power bases in "resolves".

STEP 3 — DEDUPLICATE
"choose_one" and "yes_no" questions must have exactly one target. If several
positions share an uncertainty, write one question per position. List multiple
targets only when answer_format is "open" and a single free-text answer can
meaningfully cover them together.

CONSTRAINTS
- Aim for 3 to 8 questions. Fewer is right when the descriptions were detailed;
  going past 8 means you are asking about scores no answer would move. There is no
  floor to fill: if a question fails the test in STEP 1, leaving it out is the
  correct choice, not a gap in your work.
- Prioritize the uncertainties that most affect a position's overall standing —
  legitimate and reward carry the most weight, then the remaining four equally.
- "options" is required on every question. Populate it only for "choose_one";
  set it to null for "open" and "yes_no".`;

export const generateQuestionnaire = async ({
  org,
  roles,
  scoring,
}: {
  org: string;
  roles: Role[];
  scoring: ScoreType[];
}): Promise<QuestionnaireType[]> => {
  const res = await openai.responses.parse({
    model: MODELS.reason,
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: LAYER2B_QUESTIONNAIRE_SYSTEM },
      {
        role: "user",
        content: `<organization>\n${org}\n</organization>\n\n<positions>\n${rolesForModel(
          roles
        )}\n</positions>`,
      },
      { role: "assistant", content: JSON.stringify(scoring, null, 2) },
      { role: "user", content: "Based on the scores above, generate the questionnaire." },
    ],
    text: { format: zodTextFormat(z.object({ qs: z.array(Questionnaire) }), "questionnaire"), verbosity: 'low' },
  });

  const { qs } = requireParsed("generateQuestionnaire", res);

  const known = new Set(roles.map((r) => r.id));
  for (const q of qs) {
    const bad = q.targets.filter((t) => !known.has(t));
    if (bad.length) console.warn(`generateQuestionnaire: unknown target ids: ${bad.join(", ")}`);
    if (q.answer_format !== "open" && q.targets.length !== 1) {
      console.warn(`generateQuestionnaire: ${q.answer_format} question has ${q.targets.length} targets`);
    }
  }
  // Zero is a legitimate outcome now that this layer decides what is worth asking
  // — the UI has a path for it. Both ends are still worth a line in the log: none
  // may mean the descriptions were rich, or that the layer under-asked; a flood
  // means it padded past what any answer would move.
  if (qs.length === 0) console.warn("generateQuestionnaire: no questions — nothing judged worth asking");
  if (qs.length > 8) console.warn(`generateQuestionnaire: ${qs.length} questions, past the 8 the prompt asks for`);

  // id is assigned here, not by the model — never ask for a value you overwrite.
  return qs.map((q, i) => ({ ...q, id: i }));
};

/* ────────────────────────────────────────────────────────────────
   LAYER 3 + 4 — adjustment and bias audit (combined)
   Route: POST /api/adjustScores

   Field order is load-bearing. JSON generates top-to-bottom, so
   bias_flags must precede adjusted_roles for "apply these
   corrections to the scores" to be physically possible.
   ──────────────────────────────────────────────────────────────── */

const BiasFlag = z.object({
  type: z
    .enum([
      "self_minimization",
      "self_inflation",
      "antagonist_inflation",
      "threat_underweighting",
      "ally_halo",
      "victim_framing",
      "structural_normalization",
    ])
    .describe(
      "self_minimization — user describes their own role as weaker than the evidence supports. " +
        "self_inflation — user describes their own role as stronger than the evidence supports. " +
        "antagonist_inflation — user overstates the coercive or legitimate power of someone they " +
        "appear to be in conflict with. " +
        "threat_underweighting — user downplays a position the evidence shows can materially harm them. " +
        "ally_halo — user understates the power of positions they appear to favour. " +
        "victim_framing — user frames themselves as uniquely targeted where ordinary structural " +
        "disadvantage explains the facts equally well. " +
        "structural_normalization — user attributes to ordinary structure a pattern the evidence " +
        "suggests is directed at them specifically."
    ),
  position_affected: z
    .string()
    .describe("The id of the position whose scores this flag affects. Use the user's own id where relevant."),
  evidence: z.string().describe("Verbatim quote from the user's input. Do not paraphrase or compose."),
  inference: z
    .string()
    .describe("One sentence: why that quote suggests distortion rather than accurate reporting."),
  alternative_reading: z
    .string()
    .describe(
      "One sentence stating the strongest case that this flag is WRONG and the user's account is " +
        "accurate as given. Required — every flag carries its own counter-argument."
    ),
  severity: z
    .enum(["minor", "moderate", "significant"])
    .describe(
      "minor — shifts one score by 1. moderate — shifts one or two scores by 2-3. " +
        "significant — changes the position's rank order or power_profile."
    ),
  adjustment: z
    .string()
    .describe(
      "Which score changed and in which direction, e.g. 'coercive 8 -> 6 for pos_04'. " +
        "Must match what appears in adjusted_roles."
    ),
});

const AdjustedRoleItem = z.object({
  id: z.string().describe("The position's id, copied exactly from the input. Never invent or renumber."),
  position: z.string().describe("The position's title, copied verbatim from the input."),
  scores: AdjustedScoreBlock,
  power_profile: PowerProfile,
  most_exposed_to: MostExposedTo,
  adjustment_notes: z
    .string()
    .describe(
      "What the questionnaire answers changed relative to the initial scores, quoting the " +
        "triggering phrase. Empty string if nothing changed."
    ),
  bias_corrections_applied: z
    .array(z.string())
    .describe(
      "The `type` value of every bias_flag whose correction is reflected in the scores above. " +
        "Empty array if none. Must be consistent with bias_flags."
    ),
});

export const AdjustedOutput = z.object({
  bias_flags: z
    .array(BiasFlag)
    .describe(
      "Detected distortions in the user's own framing. Empty array if none — do not manufacture " +
        "flags to appear rigorous. These are hypotheses about the input, not facts about the user."
    ),
  adjusted_roles: z
    .array(AdjustedRoleItem)
    .describe("Every position from the input, including ones nothing changed for."),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "high — specific, internally consistent input, little bias detected. " +
        "medium — some vagueness or minor bias. " +
        "low — significant vagueness, self-contradiction, or bias; read the map with caution."
    ),
  confidence_rationale: z
    .string()
    .describe("One or two sentences naming the specific gaps or inconsistencies that set the rating."),
});

export type AdjustedOutputType = z.infer<typeof AdjustedOutput>;
export type AdjustedRoleItemType = z.infer<typeof AdjustedRoleItem>;
export type BiasFlagType = z.infer<typeof BiasFlag>;

/** What callers actually get: scores clamped, index computed, deltas vs. initial. */
export type FinalRole = AdjustedRoleItemType & {
  power_index: number;
  deltas: Record<PowerBase, number> | null;
  moved: boolean | null;
};
export type AdjustedRoleType = Omit<AdjustedOutputType, "adjusted_roles"> & {
  adjusted_roles: FinalRole[];
};

export const LAYER34_ADJUST_SYSTEM = `You are an organizational power analyst and bias auditor.

INPUT
You receive, in order:
  <organization>   The organization description.
  <positions>      Every position, each with a fixed id.
  <user_position>  The id of the position the user themselves occupies.
  then the initial power scores as an assistant turn,
  then <answers> — the user's answers to the behavioural questionnaire.

Ids are fixed. Copy them verbatim. Never invent, renumber, or substitute a name
where an id is asked for. Return every position, including ones you do not change.

SCORING SCALE
All six bases are scored 0-10 as integers:
  0 none | 1-3 minimal | 4-6 moderate (roughly what the formal role implies)
  7-8 strong | 9-10 among the highest in this organization
Calibrate relative to the other positions here. A 9 means "near the top of this
org", not "powerful by world standards".

═══ PASS 1 — ADJUST SCORES FROM BEHAVIOURAL ANSWERS ═══

Job descriptions capture formal power. The answers reveal informal power the
descriptions miss. Where an answer contradicts an initial score, the answer
generally wins — but say so in adjustment_notes and quote the phrase that moved you.

Signals worth attending to. These are weak indicators, not rules. A signal alone is
not sufficient grounds to move a score, and you must name the one you acted on so
the user can check your reading:
- Hedged contrast ("technically X, but in practice Y") — the "in practice" side
  usually describes the real distribution. Fairly reliable.
- Deference language ("no one argues with", "people just go along") — suggests
  referent power. Fairly reliable.
- Described exclusion, freeze-out, or social cost — suggests coercive power.
  Reliable when concrete, weak when vague.
- Passive routing ("decisions go through them", "it gets run past her") — may
  suggest informational power, but passive voice is simply how people narrate
  process. Treat as weak. Act on it only when a specific gatekeeping event is
  described.

Do not move a score on tone or phrasing alone. Move it on described behaviour.

Re-examine each position's exposure in light of the answers, using the same
internal/external/none rule as before.

═══ PASS 2 — BIAS AUDIT ═══

The user produced all of this input, so the picture may be shaped by where they
stand in it. Audit for distortion in BOTH directions — the goal is an accurate map,
not a sceptical one.

Two disciplines apply:
1. Every flag needs a verbatim quote in "evidence". If you cannot quote it, you are
   inferring from vibe. Drop the flag.
2. Every flag needs an "alternative_reading" — the strongest good-faith case that
   the user's account is simply accurate. If it is as strong as the flag, do not
   raise the flag.

On victim_framing specifically: people are sometimes genuinely targeted, and
retaliation is a real organizational phenomenon, not only a perception. Raise this
flag only when ordinary structural disadvantage explains the described facts at
least as well as targeting does. When the user describes a specific pattern
directed at them and nothing else accounts for it, the correct flag may be
structural_normalization instead — or no flag at all.

An empty bias_flags array is a valid and often correct result.

Apply the corrections you identify to the scores you report, and list the applied
flag types under bias_corrections_applied for that position. The scores you output
are final and post-correction.

CONSTRAINTS
- Score every position on all six bases. Where the evidence is thin, say so in the
  reasoning and set is_uncertain to true — but score your best estimate, not a hedge
  toward the middle. The initial scoring was given the same instruction, and deltas
  are read as "what the answers changed": a score you pulled toward 5 out of caution
  shows up as movement the user's answers did not cause.
- Reasoning fields are one sentence. Cite input; do not restate definitions.
- Do not compute any composite or aggregate index. That is handled downstream.`;

export const adjustScoring = async ({
  org,
  selfRoleId,
  roles,
  scoring,
  questionAnswers,
}: {
  org: string;
  /** The id of the user's own position — NOT a prose description. */
  selfRoleId: string;
  roles: Role[];
  scoring: ScoreType[];
  questionAnswers: QuestionAnswer[];
}): Promise<AdjustedRoleType> => {
  if (!roles.some((r) => r.id === selfRoleId)) {
    throw new Error(`adjustScoring: selfRoleId "${selfRoleId}" is not in the roles list`);
  }

  const res = await openai.responses.parse({
    model: MODELS.reason, // the bias audit is the most judgment-heavy step in the pipeline
    reasoning: { effort: "medium" },
    input: [
      { role: "system", content: LAYER34_ADJUST_SYSTEM },
      {
        role: "user",
        content: [
          `<organization>\n${org}\n</organization>`,
          `<positions>\n${rolesForModel(roles)}\n</positions>`,
          `<user_position>${selfRoleId}</user_position>`,
        ].join("\n\n"),
      },
      { role: "assistant", content: JSON.stringify(scoring, null, 2) },
      {
        role: "user",
        content: `<answers>\n${JSON.stringify(questionAnswers, null, 2)}\n</answers>`,
      },
    ],
    text: { format: zodTextFormat(AdjustedOutput, "adjusted_roles"), verbosity: 'low' },
  });

  const out = requireParsed("adjustScoring", res);

  const known = new Set(roles.map((r) => r.id));
  const unknown = out.adjusted_roles.filter((r) => !known.has(r.id)).map((r) => r.id);
  if (unknown.length) throw new Error(`adjustScoring: unknown ids returned: ${unknown.join(", ")}`);

  // The model is asked to keep two sections consistent; it does so imperfectly.
  const flagTypes = new Set(out.bias_flags.map((f) => f.type));
  for (const r of out.adjusted_roles) {
    const orphan = r.bias_corrections_applied.filter((t) => !flagTypes.has(t as BiasFlagType["type"]));
    if (orphan.length) {
      console.warn(`adjustScoring: ${r.id} claims corrections with no matching flag: ${orphan.join(", ")}`);
    }
  }

  const initialById = new Map(scoring.map((s) => [s.id, s]));

  return {
    ...out,
    adjusted_roles: out.adjusted_roles.map((role) => {
      const scores = clampBlock(role.scores);
      const before = initialById.get(role.id);
      const deltas = before
        ? (Object.fromEntries(
            POWER_BASES.map((b) => [b, scores[b].score - before.scores[b].score])
          ) as Record<PowerBase, number>)
        : null;
      return {
        ...role,
        scores,
        power_index: powerIndex(scores),
        deltas,
        moved: deltas ? POWER_BASES.some((b) => deltas[b] !== 0) : null,
      };
    }),
  };
};

/* ────────────────────────────────────────────────────────────────
   MODULE 3 — situation analysis
   ──────────────────────────────────────────────────────────────── */

/**
 * The framework whitelist, as data. The model picks a key; researcher and year
 * are attached in code. Asking a model to emit a citation year is asking it to
 * fabricate one eventually — this removes the surface entirely.
 *
 * Steele (1997) stereotype threat was deliberately dropped: it is the item most
 * likely to be applied to a user on assumed group membership with nothing in the
 * input to support it. Re-add it only with an explicit evidence requirement.
 */
const FrameworkKey = z.enum([
  "obedience_to_authority",
  "conformity",
  "bystander_effect",
  "social_identity",
  "psychological_safety",
  "equity_theory",
  "organizational_justice",
  "evln",
  "power_distance",
  "cognitive_dissonance",
  "power_bases",
  "groupthink",
  "fundamental_attribution_error",
  "impression_management",
  "abusive_supervision",
  "workplace_incivility",
]);
export type FrameworkKeyType = z.infer<typeof FrameworkKey>;

export const FRAMEWORKS: Record<
  FrameworkKeyType,
  { term: string; researcher: string; year: number }
> = {
  obedience_to_authority: { term: "Obedience to authority", researcher: "Milgram", year: 1963 },
  conformity: { term: "Conformity", researcher: "Asch", year: 1951 },
  bystander_effect: { term: "Bystander effect", researcher: "Darley & Latané", year: 1968 },
  social_identity: { term: "Social identity theory", researcher: "Tajfel & Turner", year: 1979 },
  psychological_safety: { term: "Psychological safety", researcher: "Edmondson", year: 1999 },
  equity_theory: { term: "Equity theory", researcher: "Adams", year: 1965 },
  organizational_justice: { term: "Organizational justice", researcher: "Greenberg", year: 1987 },
  evln: { term: "Exit, Voice, Loyalty, Neglect", researcher: "Hirschman; Rusbult", year: 1988 },
  power_distance: { term: "Power distance", researcher: "Hofstede", year: 1980 },
  cognitive_dissonance: { term: "Cognitive dissonance", researcher: "Festinger", year: 1957 },
  power_bases: { term: "Bases of social power", researcher: "French & Raven", year: 1959 },
  groupthink: { term: "Groupthink", researcher: "Janis", year: 1972 },
  fundamental_attribution_error: {
    term: "Fundamental attribution error",
    researcher: "Ross",
    year: 1977,
  },
  impression_management: { term: "Impression management", researcher: "Goffman", year: 1959 },
  abusive_supervision: { term: "Abusive supervision", researcher: "Tepper", year: 2000 },
  workplace_incivility: { term: "Workplace incivility", researcher: "Cortina et al.", year: 2001 },
};

const Concept = z.object({
  framework: FrameworkKey.describe("Which whitelisted framework explains this mechanism."),
  how_it_applies: z
    .string()
    .describe(
      "How the mechanism operates in THIS org, naming the specific positions involved. " +
        "At most 2 sentences."
    ),
  what_most_people_do_wrong: z
    .string()
    .describe("The common mistake, as one sentence under 20 words. No hedging."),
  recommended_action: z
    .string()
    .describe(
      "What to do, following directly from this mechanism. Start with a verb. " +
        "At most 2 sentences. No generic advice."
    ),
});

export const SituationAnalysis = z.object({
  situation_label: z
    .string()
    .describe(
      "A short handle for this situation, shown as a card title. Under 8 words. " +
        "Name the dynamic, not the emotion."
    ),

  structural_diagnosis: z
    .string()
    .describe(
      "What arrangement of power produces this situation — the mechanism, not a retelling of " +
        "the events. At most 3 sentences."
    ),

  /* NOTE: this field is about market LEVERAGE, not how common the situation is.
     JOLTS cannot support a prevalence claim. The key name is kept for UI
     compatibility — the description below is what governs. */
  prevalence: z.object({
    description: z
      .string()
      .describe(
        "What the labor market means for this user's options — leverage, not prevalence. " +
          "At most 2 sentences, and no numbers (those belong in data_point)."
      ),
    data_point: z
      .string()
      .describe(
        "ONE sentence about ONE metric, with its positioning attached. A second metric is a " +
          "violation even if the sentence stays short. Round to at most two decimals."
      ),
    source: z.string().describe("A citation, not a sentence. 'BLS JOLTS, May 2026' and nothing more."),
  }),

  concepts: z.array(Concept).describe("The 1-3 frameworks that fit most closely. Three is a cap, not a quota."),

  power_position_note: z
    .string()
    .describe(
      "What the user's own position makes possible and what it forecloses. Do not restate " +
        "their scores — the card already displays them. At most 2 sentences."
    ),

  evln_prediction: z.object({
    most_likely_response: z
      .enum(["Exit", "Voice", "Loyalty", "Neglect"])
      .describe(
        "Which response this power configuration and market pushes toward. This is a property " +
          "of the situation, not a prediction about the person's character."
      ),
    why: z
      .string()
      .describe(
        "At most 2 sentences. This field owns the market state — name it here and nowhere else."
      ),
    better_alternative: z
      .string()
      .describe("At most 2 sentences. Start with a verb. Must be realistic given the map."),
  }),
});

type SituationAnalysisRaw = z.infer<typeof SituationAnalysis>;

/** What callers get: concepts enriched with researcher/year from FRAMEWORKS. */
export type SituationAnalysisType = Omit<SituationAnalysisRaw, "concepts"> & {
  concepts: (z.infer<typeof Concept> & { term: string; researcher: string; year: number })[];
};

const MODULE3_SYSTEM = `You are an industrial-organizational psychologist analyzing a real workplace situation.

You receive:
1. A situation the user is facing (their words).
2. The FULL organizational power map — every role with adjusted scores across French & Raven's six bases, not just the user's role.
3. Which role is the user.
4. Bias flags raised when the power map was built.
5. Labor-market data for the user's industry/occupation.

YOUR JOB
Analyze the situation through established I-O psychology research. Be specific to THIS org and THIS power configuration — never generic.

USE THE FULL MAP
The situation almost always involves other people. Identify which roles in the map correspond to the people in the user's description, and reason about the power DIFFERENTIAL between them — not just the user's own scores. "Your manager's informational power (8) over leadership is why your concern never reached the people who could act on it" is the level of specificity expected.

WHAT EACH FIELD IS
- situation_label — a short handle for this situation, used as a card title. Name the dynamic, not the emotion.
- structural_diagnosis — what arrangement of power produces this situation. The mechanism, not a retelling of the events.
- prevalence — despite the field name, this is about what the labor market means for this user's options: LEVERAGE. You are not being asked how common the situation is; the data cannot answer that.
- concepts — the research that explains the mechanism, and what to do about it.
- power_position_note — what the user's own position makes possible and what it forecloses. Their scores are already on the card; do not read them back.
- evln_prediction — which response this configuration pushes toward, and a better route.

ACCOUNT FOR BIAS
Bias flags are hypotheses about how the user framed their input, not established facts about the user. Each arrives with an alternative_reading arguing it is wrong — weigh that before leaning on the flag.
- self_minimization → the user likely understates their own leverage; correct for it.
- self_inflation → the user may overstate their leverage; check claimed authority against the map.
- antagonist_inflation → the user's account of an adversary may be distorted. This is itself fundamental attribution error (Ross, 1977) — name it if relevant.
- threat_underweighting → the user may be discounting someone who can materially harm them; say so plainly.
- ally_halo → read favourable descriptions with caution.
- victim_framing → ordinary structural disadvantage may explain the facts; offer it as an alternative, not a correction.
- structural_normalization → the opposite: the user may be explaining away a pattern that is in fact directed at them. Do not talk them out of it.
Never tell the user their experience did not happen. Distinguish "the pattern is real but the cause may be structural" from "the pattern is imagined" — only the first is ever supportable here.
If overall confidence is "low", hedge structural claims rather than asserting them.

DRAW ONLY FROM THESE FRAMEWORKS
Pick by key. Each key's researcher and publication year are attached downstream — never write a citation yourself.
  obedience_to_authority | conformity | bystander_effect | social_identity |
  psychological_safety | equity_theory | organizational_justice | evln |
  power_distance | cognitive_dissonance | power_bases | groupthink |
  fundamental_attribution_error | impression_management | abusive_supervision |
  workplace_incivility
Most workplace situations are explained by psychological_safety, organizational_justice, power_bases, evln, abusive_supervision, or workplace_incivility. obedience_to_authority, conformity, and bystander_effect describe extreme or emergency conditions and are almost always a reach for ordinary organizational friction — do not use them to fill a slot.

If a labor-market block is present in the input, it is preceded by instructions for reading it. Follow them. If it is absent, reason from the power map alone and do not manufacture market claims.

HOW TO WRITE THIS
Your output is read on a phone, as a stack of small cards. Every field is its own card or line — nobody reads it end to end. Long paragraphs are the single most common failure here, and a dense field is a field that gets skipped.

- One idea per sentence. Short declarative sentences. Break compound sentences apart instead of joining them with "and", "so", or "which".
- Lead with the claim, then the evidence. Never build up to the point.
- Do not restate the user's situation back to them. They wrote it. Go straight to what it means.
- Cut hedging stacks ("may possibly tend to"), throat-clearing ("It is worth noting that"), and any sentence that only sets up the next one. Never open by classifying the situation ("This is a classic X", "This is a textbook case of") — name the mechanism instead of announcing that you are about to.
- Plain words over academic register. You are naming a mechanism for someone in the middle of it, not writing an abstract.
- No markdown, bullets, or headers inside a field. These are rendered as plain text.

LENGTH BUDGET — hard caps, not targets. Being under them is good.
- situation_label — under 8 words.
- structural_diagnosis — at most 3 sentences. This is the one place you may spend two clauses on a single sentence.
- prevalence.description — at most 2 sentences, no numbers.
- prevalence.data_point — 1 sentence, 1 metric.
- prevalence.source — a citation, not a sentence.
- how_it_applies — at most 2 sentences.
- what_most_people_do_wrong — exactly 1 sentence, under 20 words.
- recommended_action — at most 2 sentences, starting with a verb.
- power_position_note — at most 2 sentences.
- evln_prediction.why — at most 2 sentences.
- evln_prediction.better_alternative — at most 2 sentences, starting with a verb.

WORKED EXAMPLES
prevalence.data_point
  BAD:  "Quits are at 1.9% and layoffs at 1.1%, both below average."
        Two metrics, no positioning, and "average" of what.
  GOOD: "Quits are running 1.4 SD below this sector's pre-COVID norm, in the bottom
        fifth of the last 19 years."
what_most_people_do_wrong
  BAD:  "Many people in this situation make the mistake of escalating too quickly,
        before they have built the relationships they would need to succeed."
        25 words, hedged, no mechanism.
  GOOD: "They escalate to a decision-maker their manager controls access to."
power_position_note
  BAD:  "Your legitimate power is 3 and your informational power is 4, which is low."
        Reads the card back to them.
  GOOD: "You can raise this in writing without permission. You cannot make anyone
        act on it, so the channel you pick decides the outcome."

RULES
- Select the 1–3 concepts that fit most closely. Three is a maximum, not a quota. One well-matched concept beats three padded ones, and a forced fit is worse than a short answer.
- The prevalence field is about LEVERAGE despite its name. Do not claim how many people experience this situation — JOLTS cannot support that, and inventing a prevalence statistic is a fabrication.
- data_point is the ONLY field where a JOLTS figure carries its full positioning. Never a bare rate, and never a rate compared against a different industry's.
- evln_prediction.why OWNS the market state. Name the state there. Everywhere else, reason from it without naming it again.
- The worker power index, if present, is a constructed composite built for this app, not a published BLS statistic. You may use it to summarize, but never attribute it to BLS and never present it as an official measure.
- Every recommended_action must follow from a named mechanism. No generic advice ("communicate clearly").
- most_likely_response describes what the SITUATION pulls toward, not what the user will do. Write it that way. A low-power position in a frozen market pushes toward Loyalty or Neglect — say that the structure produces it, never that the person is the type to disengage, and put a realistic alternative directly alongside it.
- Weight the market state and the quits positioning over any single rate. Exit is realistic in a "tight" or "reallocating" market and largely illusory in a "frozen" or "contracting" one — in those, better_alternative must work from inside, without an exit threat behind it.`;

/**
 * Injected into the USER message immediately above the data it describes, and
 * omitted entirely when there is no labor data. Previously this lived in the
 * system prompt, where it spent ~700 tokens teaching the model to read a block
 * that was often absent.
 */
const LABOR_MARKET_GUIDE = `HOW TO READ THE BLOCK BELOW
The sector flows come from BLS JOLTS. A raw JOLTS rate means nothing on its own — normal quit rates differ several-fold between sectors, so "quits are 1.9%" is not a finding. Read the POSITIONING, never the bare number:
- "z" is standard deviations from that same sector's 2015-2019 (pre-COVID normal) mean. |z| under 0.5 is ordinary; beyond ±1 is genuinely unusual. A z-score is NEVER a percentage — write "1.4 standard deviations below" or "1.4 SD below", never "1.4% below". Writing a z as a percent is a factual error, not a style choice.
- "pct" is the percentile rank against the last ~19 years of that sector, which includes 2009 and 2022. A rate can be well below its pre-COVID norm and still not be historically extreme — both facts are given, and they can point different directions. Say so when they do.
- "3mo"/"12mo" are changes in percentage points. Direction matters independently of level: a market at the same low level can be thawing or deteriorating.

MARKET STATE is the most important line. It is a joint read of hiring and separations, because neither means anything alone:
- tight        — workers hold a credible exit threat. Voice carries real risk to the employer.
- frozen       — low-hire, low-fire. Employers hoard staff but will not commit to new headcount. This is the trap case: openings can look healthy while almost nobody actually moves, so Exit is far weaker than an openings number suggests. Treat the exit option as mostly theoretical and say why.
- contracting  — involuntary separations dominate; worker leverage is minimal and raising Voice carries real personal risk.
- reallocating — layoffs are elevated but hiring is strong; leaving is viable, staying is not safe.
- balanced     — flows are near their pre-pandemic norms.
Derived indicators, when present: quits/layoffs ratio above ~2 means separations are mostly voluntary (leverage sits with labor); vacancy yield is hires per open posting per month, and a falling yield alongside healthy openings means postings are stale or speculative rather than real offers; net flow is hires minus separations. "Vacancies per unemployed" is national, not this sector's — cite it as national context only.
If the market state is "unknown", reason from the power map alone.`;

/* ── formatting helpers ──────────────────────────────────────── */

type DescribedRole = FinalRole & { description: string };

const round = (n: number, d = 2) => Number(n.toFixed(d));

const signed = (n: number, unit = "", d = 2) => {
  const r = round(n, d);
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)}${unit}`;
};

const ordinal = (n: number) => {
  const i = Math.round(n); // percentiles arrive as floats; "23.4th" is not a word
  const r = i % 100;
  if (r >= 11 && r <= 13) return `${i}th`;
  return `${i}${["th", "st", "nd", "rd"][i % 10] ?? "th"}`;
};

/** Renders exposure with a name, since the model never sees the id table. */
function formatExposure(e: FinalRole["most_exposed_to"], byId: Map<string, string>): string {
  if (e.kind === "none") return "no single dominant exposure";
  const name = e.kind === "internal" && e.target_id ? byId.get(e.target_id) ?? e.label : e.label;
  const tag = e.kind === "external" ? " (external to the org)" : "";
  return `${name}${tag} — ${e.basis}`;
}

function formatRole(r: DescribedRole, isUser: boolean, byId: Map<string, string>): string {
  const s = r.scores;
  const moved =
    r.deltas && r.moved
      ? `    adjusted from initial: ${POWER_BASES.filter((b) => r.deltas![b] !== 0)
          .map((b) => `${b} ${signed(r.deltas![b], "", 0)}`)
          .join(", ")}`
      : null;
  return [
    `- ${r.position}${isUser ? " (THE USER)" : ""} — power index ${r.power_index.toFixed(
      1
    )}/10, "${r.power_profile}"`,
    `    ${r.description}`,
    `    legitimate ${s.legitimate.score}, reward ${s.reward.score}, coercive ${s.coercive.score}, expert ${s.expert.score}, referent ${s.referent.score}, informational ${s.informational.score}`,
    `    most exposed to: ${formatExposure(r.most_exposed_to, byId)}`,
    moved,
  ]
    .filter(Boolean)
    .join("\n");
}

type FlowScoreT = NonNullable<NonNullable<LaborData["sector"]>["rates"]>["quits"];

/**
 * One flow rate + its positioning, on a single line. The positioning is the
 * point — a bare rate invites the model to compare across industries, which
 * is exactly the mistake the whole pipeline exists to prevent.
 *
 * Everything is rounded HERE. Models copy digits verbatim, so a raw
 * 1.4372819 in the prompt becomes a raw 1.4372819 in the output.
 */
function formatFlow(name: string, s: FlowScoreT): string | null {
  if (!s) return null;
  const parts = [`${name.padEnd(18)} ${String(round(s.latest)).padStart(5)}%/mo`];
  if (s.z != null) {
    const base = s.baselineMean != null ? `${round(s.baselineMean)}%` : "?";
    parts.push(`z ${signed(s.z)} vs pre-COVID norm (${base})`);
  }
  if (s.percentile != null) parts.push(`${ordinal(s.percentile)} pct of last 19y`);
  const mom: string[] = [];
  if (s.change3m != null) mom.push(`3mo ${signed(s.change3m, "pp")}`);
  if (s.change12m != null) mom.push(`12mo ${signed(s.change12m, "pp")}`);
  if (mom.length) parts.push(mom.join(", "));
  return `  ${parts.join("   ")}`;
}

/** Returns null when there is nothing to say, so the caller can omit the block. */
function formatLabor(l?: LaborData): string | null {
  if (!l) return null;
  const lines: string[] = [];

  /**
   * LE (wages) and LU (union) can carry DIFFERENT category labels for the same
   * lens. Printing one label over both silently attaches union figures to the
   * wrong category, so both are shown whenever they diverge.
   */
  const lens = (
    name: string,
    leLabel: string | undefined,
    luLabel: string | undefined,
    c?: z.infer<typeof WageUnionCut>
  ) => {
    if (!c) return;
    const wage: string[] = [];
    if (c.women_pct_of_men != null) wage.push(`women earn ${round(c.women_pct_of_men)}% of men`);
    if (c.men != null && c.women != null)
      wage.push(`median $${round(c.men, 0)}/wk men vs $${round(c.women, 0)}/wk women`);

    const union: string[] = [];
    if (c.coverage != null) union.push(`union coverage ${round(c.coverage)}%`);
    if (c.union_wages != null && c.nonunion_wages != null)
      union.push(`union $${round(c.union_wages, 0)} vs nonunion $${round(c.nonunion_wages, 0)}/wk`);

    if (wage.length) lines.push(`${name} WAGES${leLabel ? ` (${leLabel})` : ""} — ${wage.join("; ")}`);
    if (union.length) lines.push(`${name} UNION${luLabel ? ` (${luLabel})` : ""} — ${union.join("; ")}`);
  };

  lens("INDUSTRY", l.labels.cps_le_industry, l.labels.cps_lu_industry, l.industry);
  lens("OCCUPATION", l.labels.cps_le_occupation, l.labels.cps_lu_occupation, l.occupation);

  const s = l.sector;
  if (s) {
    const head = [s.label ?? l.labels.jolts_supersector, s.asOf].filter(Boolean).join(", ");
    lines.push(
      `SECTOR FLOWS (BLS JOLTS${head ? ` — ${head}` : ""})${
        s.preliminary ? " [preliminary, subject to revision]" : ""
      }`
    );
    if (s.baseline) lines.push(`  positioning is against the ${s.baseline} for this same sector`);

    const r = s.rates ?? {};
    lines.push(
      ...([
        formatFlow("quits", r.quits),
        formatFlow("layoffs", r.layoffs),
        formatFlow("job openings", r.job_openings),
        formatFlow("hires", r.hires),
        formatFlow("total separations", r.total_separations),
      ].filter(Boolean) as string[])
    );

    if (s.state) {
      lines.push(`  MARKET STATE: ${s.state}${s.stateDescription ? ` — ${s.stateDescription}` : ""}`);
    }

    const d = s.derived ?? {};
    const dp: string[] = [];
    if (d.quitsToLayoffs != null) dp.push(`quits/layoffs ${round(d.quitsToLayoffs)}`);
    if (d.quitsShareOfSeparations != null)
      dp.push(`${round(d.quitsShareOfSeparations)}% of separations are voluntary`);
    if (d.vacancyYield != null) dp.push(`vacancy yield ${round(d.vacancyYield)} hires per open posting/mo`);
    if (d.netFlowRate != null) dp.push(`net flow ${signed(d.netFlowRate, "pp")}/mo`);
    if (dp.length) lines.push(`  ${dp.join("; ")}`);

    if (s.workerPowerIndex != null) {
      lines.push(
        `  worker power index ${round(s.workerPowerIndex, 1)}/100 (50 = this sector's pre-COVID norm; ` +
          `a composite constructed for this app, NOT a published BLS statistic)`
      );
    }
  }

  const n = l.national;
  if (n?.vacanciesPerUnemployed != null) {
    lines.push(
      `NATIONAL (all sectors) — ${round(n.vacanciesPerUnemployed)} job openings per unemployed worker` +
        `${n.asOf ? ` (${n.asOf})` : ""}${n.change12m != null ? `, ${signed(n.change12m)} over 12mo` : ""}`
    );
  }

  // null rather than a "none available" string, so the caller can tell the
  // difference between "here is the data" and "there is none" and omit the
  // reading guide accordingly
  return lines.length ? lines.join("\n") : null;
}

/* ── the function ────────────────────────────────────────────── */

export async function analyzeSituation(params: {
  situationText: string;
  orgDescription: string;
  userRole: DescribedRole;
  allRoles: DescribedRole[]; // includes userRole
  biasFlags: BiasFlagType[];
  confidence: AdjustedOutputType["confidence"];
  confidenceRationale?: string;
  laborData?: LaborData;
}): Promise<SituationAnalysisType> {
  const {
    situationText,
    orgDescription,
    userRole,
    allRoles,
    biasFlags,
    confidence,
    confidenceRationale,
    laborData,
  } = params;

  // id → display name, so ids never leak into a prompt that speaks in names
  const byId = new Map(allRoles.map((r) => [r.id, r.position]));

  const mapBlock = allRoles.map((r) => formatRole(r, r.id === userRole.id, byId)).join("\n");

  const laborBlock = formatLabor(laborData);

  const biasBlock = biasFlags.length
    ? biasFlags
        .map((b) =>
          [
            `- ${b.type} (${b.severity}) on ${byId.get(b.position_affected) ?? b.position_affected}`,
            `    evidence: "${b.evidence}"`,
            `    why flagged: ${b.inference}`,
            `    case against the flag: ${b.alternative_reading}`,
            `    applied: ${b.adjustment}`,
          ].join("\n")
        )
        .join("\n")
    : "None flagged.";

  const userMessage = [
    "== USER SITUATION ==",
    situationText,
    "",
    "== ORGANIZATION ==",
    orgDescription,
    "",
    "== POWER MAP (all roles, adjusted) ==",
    mapBlock,
    "",
    "== THE USER'S ROLE ==",
    `${userRole.position} — index ${userRole.power_index.toFixed(1)}/10, "${userRole.power_profile}"`,
    "",
    "== BIAS FLAGS ==",
    biasBlock,
    `Overall map confidence: ${confidence}${confidenceRationale ? ` — ${confidenceRationale}` : ""}`,
    "",
    "== LABOR MARKET ==",
    // The reading guide travels with the data and disappears with it. Note this
    // tests the FORMATTED block, not the laborData object: an object full of
    // undefined fields is still truthy, and shipping a page of instructions for
    // reading figures that were not supplied is how a model starts inventing
    // them. Absent entirely is the normal case for unpaid organizations.
    laborBlock
      ? `${LABOR_MARKET_GUIDE}\n\n${laborBlock}`
      : "No labor-market data available — this organization is not paid employment, or the data could not be " +
        "retrieved. Reason from the power map alone and do not manufacture market claims. In particular, do not " +
        "assume exit is costly or cheap on economic grounds; if leaving carries a cost here, it is a social or " +
        "commitment cost, and you should say which.",
  ].join("\n");

  const response = await openai.responses.parse({
    model: MODELS.synthesize,
    input: [
      { role: "system", content: MODULE3_SYSTEM },
      { role: "user", content: userMessage },
    ],
    text: { format: zodTextFormat(SituationAnalysis, "situation_analysis") },
  });

  const out = requireParsed("analyzeSituation", response);
  checkBudget(out);

  // Citations come from the table, never from the model.
  return {
    ...out,
    concepts: out.concepts.map((c) => ({ ...c, ...FRAMEWORKS[c.framework] })),
  };
}

/* ── length-budget validation ────────────────────────────────── */

const countSentences = (s: string) => s.split(/[.!?]+(?:\s|$)/).filter((p) => p.trim()).length;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * The caps in the prompt are unenforceable at generation time. Logging every
 * violation is how you find out which ones the model actually ignores, rather
 * than assuming the prompt is being followed.
 */
function checkBudget(out: SituationAnalysisRaw) {
  const bad: string[] = [];
  const maxSent = (label: string, text: string, n: number) => {
    const c = countSentences(text);
    if (c > n) bad.push(`${label}: ${c} sentences (cap ${n})`);
  };
  const maxWords = (label: string, text: string, n: number) => {
    const c = countWords(text);
    if (c > n) bad.push(`${label}: ${c} words (cap ${n})`);
  };

  maxWords("situation_label", out.situation_label, 8);
  maxSent("structural_diagnosis", out.structural_diagnosis, 3);
  maxSent("prevalence.description", out.prevalence.description, 2);
  maxSent("prevalence.data_point", out.prevalence.data_point, 1);
  maxSent("power_position_note", out.power_position_note, 2);
  maxSent("evln_prediction.why", out.evln_prediction.why, 2);
  maxSent("evln_prediction.better_alternative", out.evln_prediction.better_alternative, 2);

  if (/\d/.test(out.prevalence.description)) {
    bad.push("prevalence.description contains a number (belongs in data_point)");
  }
  if (out.concepts.length > 3) bad.push(`concepts: ${out.concepts.length} returned (cap 3)`);
  if (out.concepts.length === 0) bad.push("concepts: none returned");

  out.concepts.forEach((c, i) => {
    maxSent(`concepts[${i}].how_it_applies`, c.how_it_applies, 2);
    maxSent(`concepts[${i}].what_most_people_do_wrong`, c.what_most_people_do_wrong, 1);
    maxWords(`concepts[${i}].what_most_people_do_wrong`, c.what_most_people_do_wrong, 20);
    maxSent(`concepts[${i}].recommended_action`, c.recommended_action, 2);
  });

  if (bad.length) console.warn(`analyzeSituation budget violations:\n  ${bad.join("\n  ")}`);
}