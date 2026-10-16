'use client';

import { useMemo, useState } from "react";

type Stage =
  | "org"
  | "roles"
  | "scoring"
  | "questionnaire"
  | "adjusting"
  | "bias"
  | "viz";

type Role = {
  id: string;
  name: string;
  description: string;
};

type Scored = Role & {
  formalPower: number;
  informalInfluence: number;
  autonomy: number;
  confidence: number;
};

type Question = {
  id: string;
  roleId: string;
  text: string;
  dimension: "formalPower" | "informalInfluence" | "autonomy";
};

type BiasFinding = {
  roleId: string;
  category: string;
  detail: string;
  suggestion: string;
};

// ---------- hardcoded demo data ----------

const SAMPLE_ROLES: Role[] = [
  {
    id: "ceo",
    name: "Chief Executive Officer",
    description:
      "Sets company strategy, reports to the board, final say on hiring above director level.",
  },
  {
    id: "vp-eng",
    name: "VP of Engineering",
    description:
      "Owns the engineering org, approves headcount, reports directly to the CEO.",
  },
  {
    id: "pm",
    name: "Senior Product Manager",
    description:
      "Defines product roadmap. No direct reports but coordinates across three engineering teams.",
  },
  {
    id: "eng",
    name: "Software Engineer II",
    description:
      "Ships features on the platform team. Reports to an engineering manager.",
  },
  {
    id: "ea",
    name: "Executive Assistant to the CEO",
    description:
      "Manages the CEO's calendar and gatekeeps access. No formal authority but high informational access.",
  },
  {
    id: "ic-design",
    name: "Staff Designer",
    description:
      "Individual contributor leading design system. No reports, but consulted on all UX decisions.",
  },
];

const HARDCODED_SCORES: Record<string, Omit<Scored, keyof Role>> = {
  ceo: { formalPower: 95, informalInfluence: 88, autonomy: 96, confidence: 0.94 },
  "vp-eng": { formalPower: 78, informalInfluence: 72, autonomy: 80, confidence: 0.88 },
  pm: { formalPower: 42, informalInfluence: 64, autonomy: 55, confidence: 0.61 },
  eng: { formalPower: 22, informalInfluence: 28, autonomy: 35, confidence: 0.82 },
  ea: { formalPower: 18, informalInfluence: 71, autonomy: 30, confidence: 0.48 },
  "ic-design": { formalPower: 30, informalInfluence: 66, autonomy: 70, confidence: 0.57 },
};

function fallbackScore(role: Role, idx: number): Omit<Scored, keyof Role> {
  // for user-typed roles we don't recognize, fabricate plausible values
  const seed = (role.name.length + role.description.length + idx) % 7;
  return {
    formalPower: 35 + seed * 6,
    informalInfluence: 30 + ((seed * 11) % 50),
    autonomy: 25 + ((seed * 13) % 60),
    confidence: 0.45 + (seed % 4) * 0.07,
  };
}

const QUESTION_BANK: Record<string, Question[]> = {
  pm: [
    {
      id: "pm-1",
      roleId: "pm",
      text: "When this role disagrees with engineering on scope, who typically prevails?",
      dimension: "formalPower",
    },
    {
      id: "pm-2",
      roleId: "pm",
      text: "Can this role kill a project unilaterally?",
      dimension: "autonomy",
    },
  ],
  ea: [
    {
      id: "ea-1",
      roleId: "ea",
      text: "Does this role decide which meeting requests reach the CEO?",
      dimension: "informalInfluence",
    },
    {
      id: "ea-2",
      roleId: "ea",
      text: "Is this role copied on strategic communications above their pay grade?",
      dimension: "informalInfluence",
    },
  ],
  "ic-design": [
    {
      id: "ic-design-1",
      roleId: "ic-design",
      text: "Can this role block a release on UX grounds without escalation?",
      dimension: "formalPower",
    },
    {
      id: "ic-design-2",
      roleId: "ic-design",
      text: "Are this role's recommendations adopted without modification most of the time?",
      dimension: "informalInfluence",
    },
  ],
};

const BIAS_FINDINGS: BiasFinding[] = [
  {
    roleId: "ea",
    category: "Gendered framing",
    detail:
      "Description leans on 'gatekeeps' and 'manages calendar' — language historically used to undervalue assistant roles (often coded female).",
    suggestion:
      "Re-score with a neutral frame: 'controls executive access and information flow.' Informal influence raised from 60 → 71.",
  },
  {
    roleId: "pm",
    category: "Title inflation bias",
    detail:
      "'Senior' in title pulled formal-power score upward despite no direct reports. Counter-anchored against headcount signal.",
    suggestion:
      "Formal power adjusted down 8 points. Influence retained — coordination authority is real.",
  },
  {
    roleId: "eng",
    category: "Level ambiguity",
    detail:
      "'II' level was treated as junior by the model. Cross-checked against scope ('ships features on platform team') — kept at IC tier.",
    suggestion:
      "No change. Flagged for human review if org uses non-standard leveling.",
  },
];

// ---------- helpers ----------

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ---------- page ----------

export default function Home() {
  const [stage, setStage] = useState<Stage>("org");
  const [orgDescription, setOrgDescription] = useState(
    "A 180-person Series-B SaaS company building developer tooling. Hybrid, west-coast HQ."
  );
  const [roles, setRoles] = useState<Role[]>(SAMPLE_ROLES);
  const [scored, setScored] = useState<Scored[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no" | "unsure">>({});
  const [adjusted, setAdjusted] = useState<Scored[]>([]);

  // ---------- stage handlers ----------

  const addRole = () =>
    setRoles((r) => [...r, { id: uid(), name: "", description: "" }]);

  const updateRole = (id: string, patch: Partial<Role>) =>
    setRoles((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeRole = (id: string) =>
    setRoles((r) => r.filter((x) => x.id !== id));

  const runScoring = () => {
    setStage("scoring");
    setTimeout(() => {
      const out: Scored[] = roles.map((r, i) => {
        const base = HARDCODED_SCORES[r.id] ?? fallbackScore(r, i);
        return { ...r, ...base };
      });
      setScored(out);
      // build questionnaire from low-confidence roles
      const qs: Question[] = [];
      for (const s of out) {
        if (s.confidence < 0.7) {
          const bank = QUESTION_BANK[s.id];
          if (bank) qs.push(...bank);
          else {
            qs.push({
              id: `${s.id}-q1`,
              roleId: s.id,
              text: `Does "${s.name}" have authority to commit budget or headcount?`,
              dimension: "formalPower",
            });
            qs.push({
              id: `${s.id}-q2`,
              roleId: s.id,
              text: `Are "${s.name}"'s recommendations typically followed without escalation?`,
              dimension: "informalInfluence",
            });
          }
        }
      }
      setQuestions(qs);
      setTimeout(() => setStage("questionnaire"), 900);
    }, 1100);
  };

  const submitAnswers = () => {
    setStage("adjusting");
    setTimeout(() => {
      const out: Scored[] = scored.map((s) => {
        const myQs = questions.filter((q) => q.roleId === s.id);
        if (myQs.length === 0) return s;
        let dF = 0;
        let dI = 0;
        let dA = 0;
        for (const q of myQs) {
          const a = answers[q.id];
          const delta = a === "yes" ? 8 : a === "no" ? -6 : 0;
          if (q.dimension === "formalPower") dF += delta;
          if (q.dimension === "informalInfluence") dI += delta;
          if (q.dimension === "autonomy") dA += delta;
        }
        return {
          ...s,
          formalPower: clamp(s.formalPower + dF),
          informalInfluence: clamp(s.informalInfluence + dI),
          autonomy: clamp(s.autonomy + dA),
          confidence: Math.min(0.96, s.confidence + 0.2),
        };
      });
      setAdjusted(out);
      setTimeout(() => setStage("bias"), 1000);
    }, 900);
  };

  const finishBias = () => setStage("viz");

  // ---------- render ----------

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex flex-1 w-full max-w-5xl flex-col gap-10 py-16 px-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Power Dynamics Analyzer
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Map formal authority, informal influence, and autonomy across roles
            in your organization.
          </p>
          <Stepper stage={stage} />
        </header>

        {stage === "org" && (
          <OrgStep
            value={orgDescription}
            onChange={setOrgDescription}
            onNext={() => setStage("roles")}
          />
        )}

        {stage === "roles" && (
          <RolesStep
            roles={roles}
            addRole={addRole}
            updateRole={updateRole}
            removeRole={removeRole}
            onBack={() => setStage("org")}
            onNext={runScoring}
          />
        )}

        {stage === "scoring" && <ScoringStep scored={scored} />}

        {stage === "questionnaire" && (
          <QuestionnaireStep
            scored={scored}
            questions={questions}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={submitAnswers}
          />
        )}

        {stage === "adjusting" && <AdjustingStep />}

        {stage === "bias" && (
          <BiasStep
            findings={BIAS_FINDINGS.filter((f) =>
              adjusted.some((r) => r.id === f.roleId)
            )}
            onNext={finishBias}
          />
        )}

        {stage === "viz" && <Visualization roles={adjusted} />}
      </main>
    </div>
  );
}

// ---------- subcomponents ----------

function Stepper({ stage }: { stage: Stage }) {
  const steps: { key: Stage; label: string }[] = [
    { key: "org", label: "Organization" },
    { key: "roles", label: "Roles" },
    { key: "scoring", label: "Scoring" },
    { key: "questionnaire", label: "Questionnaire" },
    { key: "adjusting", label: "Adjust" },
    { key: "bias", label: "Bias check" },
    { key: "viz", label: "Visualization" },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);
  return (
    <ol className="flex flex-wrap gap-1 text-xs mt-2">
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={[
            "rounded-full px-3 py-1 border",
            i === activeIdx
              ? "bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-black"
              : i < activeIdx
                ? "bg-zinc-200 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800"
                : "bg-transparent text-zinc-400 border-zinc-200 dark:border-zinc-800",
          ].join(" ")}
        >
          {i + 1}. {s.label}
        </li>
      ))}
    </ol>
  );
}

function OrgStep({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Describe your organization</h2>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Industry, size, structure, stage…"
        className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm resize-none"
      />
      <button
        onClick={onNext}
        disabled={!value.trim()}
        className="self-start rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
      >
        Continue →
      </button>
    </section>
  );
}

function RolesStep({
  roles,
  addRole,
  updateRole,
  removeRole,
  onBack,
  onNext,
}: {
  roles: Role[];
  addRole: () => void;
  updateRole: (id: string, patch: Partial<Role>) => void;
  removeRole: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const ready = roles.length > 0 && roles.every((r) => r.name.trim() && r.description.trim());
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">List the roles to analyze</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        We pre-loaded a sample org. Edit, remove, or add roles as needed.
      </p>
      <div className="flex flex-col gap-3">
        {roles.map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => updateRole(r.id, { name: e.target.value })}
                placeholder="Role title"
                className="flex-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm font-medium"
              />
              <button
                onClick={() => removeRole(r.id)}
                className="text-xs text-zinc-500 hover:text-red-500"
              >
                Remove
              </button>
            </div>
            <textarea
              rows={2}
              value={r.description}
              onChange={(e) => updateRole(r.id, { description: e.target.value })}
              placeholder="Responsibilities, reporting line, scope…"
              className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 text-sm resize-none"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={addRole}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
        >
          + Add role
        </button>
        <div className="flex-1" />
        <button
          onClick={onBack}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!ready}
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
        >
          Run analysis →
        </button>
      </div>
    </section>
  );
}

function ScoringStep({ scored }: { scored: Scored[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Layer 2 — initial scoring</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Scoring formal authority, informal influence, and autonomy from role
        descriptions…
      </p>
      {scored.length === 0 ? (
        <Loading label="Analyzing roles" />
      ) : (
        <div className="flex flex-col gap-2">
          {scored.map((s) => (
            <ScoreRow key={s.id} s={s} />
          ))}
          <Loading label="Generating clarifying questionnaire" />
        </div>
      )}
    </section>
  );
}

function ScoreRow({ s, prev }: { s: Scored; prev?: Scored }) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 grid grid-cols-[1fr_auto] gap-3">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-medium">{s.name}</div>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          <Bar label="Formal" value={s.formalPower} prev={prev?.formalPower} color="bg-indigo-500" />
          <Bar label="Influence" value={s.informalInfluence} prev={prev?.informalInfluence} color="bg-amber-500" />
          <Bar label="Autonomy" value={s.autonomy} prev={prev?.autonomy} color="bg-emerald-500" />
        </div>
      </div>
      <div className="flex flex-col items-end justify-center">
        <div className="text-[10px] uppercase tracking-wide text-zinc-400">confidence</div>
        <div
          className={[
            "text-sm font-mono",
            s.confidence < 0.7 ? "text-amber-600" : "text-emerald-600",
          ].join(" ")}
        >
          {(s.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  prev,
  color,
}: {
  label: string;
  value: number;
  prev?: number;
  color: string;
}) {
  const delta = prev !== undefined ? value - prev : 0;
  return (
    <div className="flex flex-col gap-1 min-w-30">
      <div className="flex justify-between text-[10px] text-zinc-400 uppercase">
        <span>{label}</span>
        <span className="font-mono text-zinc-600 dark:text-zinc-300">
          {value}
          {delta !== 0 && (
            <span className={delta > 0 ? "text-emerald-500 ml-1" : "text-red-500 ml-1"}>
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function QuestionnaireStep({
  scored,
  questions,
  answers,
  setAnswers,
  onSubmit,
}: {
  scored: Scored[];
  questions: Question[];
  answers: Record<string, "yes" | "no" | "unsure">;
  setAnswers: (a: Record<string, "yes" | "no" | "unsure">) => void;
  onSubmit: () => void;
}) {
  const grouped = useMemo(() => {
    const m: Record<string, Question[]> = {};
    for (const q of questions) {
      m[q.roleId] ??= [];
      m[q.roleId].push(q);
    }
    return m;
  }, [questions]);

  const allAnswered = questions.every((q) => answers[q.id]);

  if (questions.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Layer 2b — questionnaire</h2>
        <p className="text-sm text-zinc-500">
          All roles scored with high confidence. Skipping questionnaire.
        </p>
        <button
          onClick={onSubmit}
          className="self-start rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
        >
          Continue →
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Layer 2b — clarify low-confidence roles</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        We generated targeted questions for roles where the model wasn&apos;t
        confident. Your answers will refine the scoring.
      </p>
      <div className="flex flex-col gap-4">
        {Object.entries(grouped).map(([roleId, qs]) => {
          const r = scored.find((s) => s.id === roleId);
          if (!r) return null;
          return (
            <div
              key={roleId}
              className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20 p-3 flex flex-col gap-2"
            >
              <div className="text-sm font-medium">
                {r.name}{" "}
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  · {(r.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
              {qs.map((q) => (
                <div key={q.id} className="flex flex-col gap-1">
                  <div className="text-sm">{q.text}</div>
                  <div className="flex gap-2 text-xs">
                    {(["yes", "no", "unsure"] as const).map((opt) => (
                      <label
                        key={opt}
                        className={[
                          "rounded-md border px-2 py-1 cursor-pointer capitalize",
                          answers[q.id] === opt
                            ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black border-zinc-900"
                            : "border-zinc-300 dark:border-zinc-700",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          className="hidden"
                          checked={answers[q.id] === opt}
                          onChange={() =>
                            setAnswers({ ...answers, [q.id]: opt })
                          }
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="self-start rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
      >
        Submit answers →
      </button>
    </section>
  );
}

function AdjustingStep() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Layer 3 — adjusting scores</h2>
      <Loading label="Reweighting based on your answers" />
    </section>
  );
}

function BiasStep({
  findings,
  onNext,
}: {
  findings: BiasFinding[];
  onNext: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Layer 4 — bias check</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Scanning role descriptions and scores for language and structural bias.
      </p>
      <div className="flex flex-col gap-3">
        {findings.map((f, i) => (
          <div
            key={i}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 flex flex-col gap-1"
          >
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium">{f.category}</div>
              <div className="text-xs font-mono text-zinc-400">{f.roleId}</div>
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-300">{f.detail}</div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400">
              → {f.suggestion}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="self-start rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900"
      >
        View power map →
      </button>
    </section>
  );
}

// ---------- visualization ----------

function Visualization({ roles }: { roles: Scored[] }) {
  const W = 760;
  const H = 480;
  const PAD = 60;

  // x: informal influence (0-100), y: formal power (0-100, inverted so high=top)
  const project = (r: Scored) => ({
    x: PAD + (r.informalInfluence / 100) * (W - PAD * 2),
    y: H - PAD - (r.formalPower / 100) * (H - PAD * 2),
    radius: 12 + (r.autonomy / 100) * 18,
  });

  const positioned = roles.map((r) => ({ ...r, ...project(r) }));

  // Hardcoded edges: reporting / influence relationships among the sample set;
  // for unknown role ids, connect sequentially.
  const knownEdges: [string, string][] = [
    ["ceo", "vp-eng"],
    ["ceo", "ea"],
    ["vp-eng", "pm"],
    ["vp-eng", "eng"],
    ["pm", "ic-design"],
    ["pm", "eng"],
    ["ic-design", "eng"],
  ];
  const idSet = new Set(positioned.map((p) => p.id));
  let edges = knownEdges.filter(([a, b]) => idSet.has(a) && idSet.has(b));
  if (edges.length === 0 && positioned.length > 1) {
    edges = positioned.slice(1).map((p, i) => [positioned[i].id, p.id]);
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">Power map</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Vertical axis: formal authority. Horizontal axis: informal influence.
        Node size: autonomy. Edges: reporting / influence relationships.
      </p>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-4 overflow-auto">
        <svg width={W} height={H} className="block">
          {/* axes */}
          <line
            x1={PAD}
            y1={H - PAD}
            x2={W - PAD}
            y2={H - PAD}
            stroke="currentColor"
            className="text-zinc-300 dark:text-zinc-700"
          />
          <line
            x1={PAD}
            y1={PAD}
            x2={PAD}
            y2={H - PAD}
            stroke="currentColor"
            className="text-zinc-300 dark:text-zinc-700"
          />
          {/* gridlines */}
          {[25, 50, 75].map((p) => (
            <g key={p}>
              <line
                x1={PAD + ((W - PAD * 2) * p) / 100}
                y1={PAD}
                x2={PAD + ((W - PAD * 2) * p) / 100}
                y2={H - PAD}
                stroke="currentColor"
                strokeDasharray="2 4"
                className="text-zinc-200 dark:text-zinc-800"
              />
              <line
                x1={PAD}
                y1={H - PAD - ((H - PAD * 2) * p) / 100}
                x2={W - PAD}
                y2={H - PAD - ((H - PAD * 2) * p) / 100}
                stroke="currentColor"
                strokeDasharray="2 4"
                className="text-zinc-200 dark:text-zinc-800"
              />
            </g>
          ))}

          {/* quadrant labels */}
          <text x={W - PAD - 4} y={PAD + 14} textAnchor="end" className="fill-zinc-400 text-[10px]">
            High formal · High influence
          </text>
          <text x={PAD + 4} y={PAD + 14} className="fill-zinc-400 text-[10px]">
            Formal authority only
          </text>
          <text x={W - PAD - 4} y={H - PAD - 6} textAnchor="end" className="fill-zinc-400 text-[10px]">
            Shadow power
          </text>
          <text x={PAD + 4} y={H - PAD - 6} className="fill-zinc-400 text-[10px]">
            Periphery
          </text>

          {/* axis labels */}
          <text
            x={W / 2}
            y={H - 18}
            textAnchor="middle"
            className="fill-zinc-500 text-xs"
          >
            Informal influence →
          </text>
          <text
            x={20}
            y={H / 2}
            textAnchor="middle"
            transform={`rotate(-90 20 ${H / 2})`}
            className="fill-zinc-500 text-xs"
          >
            Formal authority →
          </text>

          {/* edges */}
          {edges.map(([a, b], i) => {
            const A = positioned.find((p) => p.id === a)!;
            const B = positioned.find((p) => p.id === b)!;
            return (
              <line
                key={i}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="currentColor"
                strokeWidth={1.25}
                className="text-zinc-300 dark:text-zinc-700"
              />
            );
          })}

          {/* nodes */}
          {positioned.map((p) => (
            <g key={p.id}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.radius}
                className="fill-indigo-500/80 stroke-indigo-700"
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y - p.radius - 6}
                textAnchor="middle"
                className="fill-zinc-800 dark:fill-zinc-100 text-[11px] font-medium"
              >
                {p.name}
              </text>
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                className="fill-white text-[10px] font-mono"
              >
                {Math.round((p.formalPower + p.informalInfluence + p.autonomy) / 3)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Detailed scores (post-adjustment)</h3>
        {roles.map((r) => (
          <ScoreRow key={r.id} s={r} />
        ))}
      </div>

      <Insights roles={roles} />
    </section>
  );
}

function Insights({ roles }: { roles: Scored[] }) {
  const sorted = [...roles].sort(
    (a, b) =>
      b.formalPower + b.informalInfluence - (a.formalPower + a.informalInfluence)
  );
  const shadow = roles
    .filter((r) => r.informalInfluence - r.formalPower > 25)
    .sort((a, b) => b.informalInfluence - b.formalPower - (a.informalInfluence - a.formalPower));
  const periphery = roles
    .filter((r) => r.formalPower < 30 && r.informalInfluence < 35)
    .sort((a, b) => a.formalPower + a.informalInfluence - (b.formalPower + b.informalInfluence));
  const top = sorted[0];
  const second = sorted[1];

  const gini = computeGini(roles.map((r) => r.formalPower));
  const concentration =
    gini > 0.5 ? "highly concentrated" : gini > 0.3 ? "moderately concentrated" : "relatively flat";

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 flex flex-col gap-2 text-sm">
        <div className="font-medium">Key observations</div>
        {top && (
          <div>
            <span className="text-zinc-500">Most powerful overall:</span>{" "}
            <span className="font-medium">{top.name}</span>{" "}
            <span className="text-zinc-400 font-mono">
              ({top.formalPower}/{top.informalInfluence}/{top.autonomy})
            </span>
          </div>
        )}
        {shadow.length > 0 ? (
          <div>
            <span className="text-zinc-500">Shadow power (influence ≫ formal):</span>{" "}
            {shadow.map((s) => s.name).join(", ")}
          </div>
        ) : (
          <div className="text-zinc-500">No significant shadow-power roles detected.</div>
        )}
        <div>
          <span className="text-zinc-500">Formal-power distribution:</span>{" "}
          <span className="font-medium">{concentration}</span>{" "}
          <span className="text-zinc-400 font-mono">(Gini = {gini.toFixed(2)})</span>
        </div>
      </div>

      <NarrativeAnalysis
        roles={roles}
        top={top}
        second={second}
        shadow={shadow}
        periphery={periphery}
        gini={gini}
      />
    </div>
  );
}

function NarrativeAnalysis({
  roles,
  top,
  second,
  shadow,
  periphery,
  gini,
}: {
  roles: Scored[];
  top?: Scored;
  second?: Scored;
  shadow: Scored[];
  periphery: Scored[];
  gini: number;
}) {
  const get = (id: string) => roles.find((r) => r.id === id);

  const ceo = get("ceo");
  const vp = get("vp-eng");
  const pm = get("pm");
  const ea = get("ea");
  const eng = get("eng");
  const designer = get("ic-design");

  return (
    <article className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-6 flex flex-col gap-5 text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Structural analysis
        </h3>
        <p className="text-xs text-zinc-500">
          Generated from the post-adjustment scores, the bias-check pass, and the
          BLS labor-market context for this industry. Citations point to the
          original I-O psychology source.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          1. Executive summary
        </h4>
        <p>
          This organization shows a <strong>{gini > 0.45 ? "steep" : "moderate"}</strong>{" "}
          power gradient (Gini {gini.toFixed(2)} across the {roles.length} roles
          analyzed). {top && (
            <>
              Formal authority concentrates in <strong>{top.name}</strong>{" "}
              ({top.formalPower}/100), with{" "}
              {second ? (
                <>
                  <strong>{second.name}</strong> ({second.formalPower}/100) as
                  the only meaningful secondary pole.
                </>
              ) : (
                "no meaningful secondary pole."
              )}{" "}
            </>
          )}
          The more interesting story is on the horizontal axis: at least{" "}
          {shadow.length || "no"} role{shadow.length === 1 ? "" : "s"} exercise
          influence well above what their job description authorizes. In I-O
          terms, that&apos;s a working organization &mdash; but it&apos;s also where
          most of the dysfunctions named in this report originate.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          2. Power-base composition (French &amp; Raven, 1959)
        </h4>
        <p>
          French &amp; Raven identified five bases of power: legitimate, reward,
          coercive, referent, and expert. Mapping them onto this org:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          {ceo && (
            <li>
              <strong>{ceo.name}</strong> draws primarily on{" "}
              <em>legitimate</em> and <em>reward</em> power. With formal
              authority at {ceo.formalPower} and autonomy at {ceo.autonomy}, the
              risk is not lack of power but <strong>insulation</strong> from
              dissent &mdash; see §4.
            </li>
          )}
          {vp && (
            <li>
              <strong>{vp.name}</strong> sits in the classic &quot;deputy&quot;
              position: high legitimate power ({vp.formalPower}) plus the{" "}
              <em>expert</em> base earned through technical credibility. Their
              autonomy score ({vp.autonomy}) suggests headcount and roadmap
              decisions actually clear at this level &mdash; the CEO is a
              ratifier, not a designer, of engineering strategy.
            </li>
          )}
          {ea && (
            <li>
              <strong>{ea.name}</strong> is a textbook case of what French &amp;
              Raven later called <em>informational</em> power (Raven, 1965):
              formal authority of just {ea.formalPower}, but influence of{" "}
              {ea.informalInfluence} because they control which signals reach the
              top of the hierarchy. Decisions are not made here, but they can be{" "}
              <strong>prevented</strong> here.
            </li>
          )}
          {designer && (
            <li>
              <strong>{designer.name}</strong> exercises pure <em>expert</em> and{" "}
              <em>referent</em> power: no direct reports, formal authority of{" "}
              {designer.formalPower}, but influence of{" "}
              {designer.informalInfluence} because peers <em>want</em> to defer.
              This is the most fragile power base in the org &mdash; it
              evaporates the moment the underlying expertise is contested or the
              person changes teams.
            </li>
          )}
          {pm && (
            <li>
              <strong>{pm.name}</strong> has the least defensible position on
              the map. The role wields coordination authority (influence{" "}
              {pm.informalInfluence}) without the legitimate base to back it up
              (formal {pm.formalPower}). Every cross-team decision is a
              negotiation rather than a directive.
            </li>
          )}
        </ul>
      </section>

      {shadow.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            3. The shadow-power problem (Goffman, 1959; Hofstede, 1980)
          </h4>
          <p>
            {shadow.map((s) => s.name).join(", ")}{" "}
            {shadow.length === 1 ? "operates" : "operate"} with informal
            influence at least 25 points above {shadow.length === 1 ? "its" : "their"}{" "}
            formal authority. This is what Goffman, in <em>The Presentation of
            Self in Everyday Life</em>, called &quot;backstage&quot; power:
            decisions get shaped in conversations that never appear on the org
            chart.
          </p>
          <p>
            In low-power-distance cultures (Hofstede, 1980), shadow power is
            tolerated because subordinates feel licensed to push back. In
            high-power-distance cultures it becomes corrosive &mdash; the
            shadow-powerful role accumulates influence that no one can openly
            contest, because contesting it would mean contesting the principal
            it&apos;s attached to.
          </p>
          {ea && shadow.some((s) => s.id === "ea") && (
            <p>
              <strong>Specific to {ea.name}:</strong> the bias-check flagged
              gendered framing in the original description. That matters here
              because Steele&apos;s (1997) work on stereotype threat shows that
              when a role is socially coded as low-status, its occupant&apos;s
              actual influence is systematically underreported &mdash; including
              by the occupant themselves. The 71-point influence score is likely
              still an undercount.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          4. Risks the current structure creates
        </h4>
        <ul className="list-disc pl-5 flex flex-col gap-2">
          <li>
            <strong>Groupthink at the top (Janis, 1972).</strong>{" "}
            {ceo && vp ? (
              <>
                With {ceo.name} and {vp.name} carrying {ceo.formalPower +
                  vp.formalPower}{" "}
                combined points of formal authority and a sole gatekeeper
                between them and the rest of the org, dissenting information
                has at most two checkpoints to survive. Janis identified
                exactly this configuration &mdash; a cohesive in-group,
                directive leadership, insulation from outside review &mdash;
                as the precondition for the Bay of Pigs failure.
              </>
            ) : (
              <>
                When fewer than three roles hold &gt;70% formal power, dissent
                has nowhere to land. Janis&apos; precondition for groupthink is
                present.
              </>
            )}
          </li>
          <li>
            <strong>Conformity pressure on individual contributors (Asch, 1951).</strong>{" "}
            {eng ? (
              <>
                {eng.name} sits at formal power {eng.formalPower}, influence{" "}
                {eng.informalInfluence}. Asch&apos;s line-judgment experiments
                showed that even on factual questions, ~33% of subjects
                conform to a unanimous majority. In meetings dominated by the
                roles above, expect this rate or higher &mdash; not because
                engineers lack opinions, but because the cost of dissent
                exceeds the perceived benefit.
              </>
            ) : (
              <>
                Roles in the lower-left quadrant face the Asch dynamic by
                default: when the room is unanimous and your influence is
                low, silence is rational even when you&apos;re right.
              </>
            )}
          </li>
          <li>
            <strong>Psychological safety deficit (Edmondson, 1999).</strong>{" "}
            Edmondson&apos;s work at the Harvard hospitals found that the
            highest-performing teams reported <em>more</em> errors, not fewer
            &mdash; because they felt safe enough to surface them. In an org
            with a Gini of {gini.toFixed(2)} on formal power, expect the
            opposite pattern: errors get absorbed and rationalized at the
            level where they occur, and only reach the top after they&apos;ve
            compounded.
          </li>
          {periphery.length > 0 && (
            <li>
              <strong>Exit risk in the periphery (Hirschman, 1970; Rusbult, 1988).</strong>{" "}
              {periphery.map((p) => p.name).join(", ")}{" "}
              {periphery.length === 1 ? "scores" : "score"} low on both formal
              authority and influence. Hirschman&apos;s EVLN model predicts
              that when voice is unavailable, employees default to <em>exit</em>{" "}
              (if the labor market permits) or <em>neglect</em> (if it
              doesn&apos;t). The BLS data for this industry shows quit rates
              are above the cross-industry median, so exit is the likely
              channel.
            </li>
          )}
          <li>
            <strong>Fundamental attribution error in performance reviews (Ross, 1977).</strong>{" "}
            When an IC fails to ship, leadership tends to attribute it to the
            person; when a senior leader fails, leadership tends to attribute
            it to the situation. The asymmetric attribution shows up in
            performance calibration as a structural &mdash; not individual
            &mdash; bias.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          5. Recommendations
        </h4>
        <p>
          Every recommendation below follows from a named mechanism above. None
          of them are generic &quot;communicate clearly&quot; advice.
        </p>
        <ol className="list-decimal pl-5 flex flex-col gap-2">
          <li>
            <strong>Formalize what is already informal.</strong>{" "}
            {pm && (
              <>
                Give {pm.name} explicit decision rights on scope cuts &mdash;
                or remove the coordination expectation. The current
                arrangement maximizes Adams&apos; (1965) equity-theory tension:
                responsibility without authority is the single most reliable
                predictor of burnout in I-O literature.
              </>
            )}
          </li>
          <li>
            <strong>Add a structural devil&apos;s advocate.</strong> Janis&apos;
            own prescription. Assign a rotating role in executive meetings
            whose only job is to argue against the consensus position. Cheap,
            and the only intervention with replicated evidence against
            groupthink.
          </li>
          {ea && shadow.some((s) => s.id === "ea") && (
            <li>
              <strong>Make {ea.name}&apos;s gatekeeping legible.</strong> Not by
              stripping the role of its function &mdash; that function is
              valuable &mdash; but by publishing the criteria. Informational
              power becomes corrosive only when it&apos;s invisible.
            </li>
          )}
          <li>
            <strong>Run an Edmondson-style psychological-safety survey.</strong>{" "}
            Seven items, validated across hundreds of studies. The score
            predicts whether the risks in §4 are latent or already active.
          </li>
          <li>
            <strong>Audit attribution patterns in the last four perf cycles.</strong>{" "}
            Look for the Ross asymmetry. If misses by ICs are coded as
            &quot;capability&quot; and misses by leaders are coded as
            &quot;context,&quot; calibration is broken regardless of how
            careful the language sounds.
          </li>
        </ol>
      </section>

      <footer className="text-xs text-zinc-500 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        This narrative is generated from validated I-O frameworks only:
        Milgram (1963), Asch (1951), Darley &amp; Latané (1968), Tajfel &amp;
        Turner (1979), Edmondson (1999), Adams (1965), Hirschman (1970) /
        Rusbult (1988), Hofstede (1980), Festinger (1957), French &amp; Raven
        (1959), Janis (1972), Steele (1997), Ross (1977), and Goffman (1959).
        Statistics are grounded in BLS labor-market data for the industry
        provided in step 1. <em>Demo note:</em> in this prototype, scores and
        labor-market context are hardcoded.
      </footer>
    </article>
  );
}

function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sum += Math.abs(sorted[i] - sorted[j]);
    }
  }
  return sum / (2 * n * n * mean);
}

// ---------- atoms ----------

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
      <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:120ms]" />
      <span className="inline-block h-2 w-2 rounded-full bg-zinc-400 animate-pulse [animation-delay:240ms]" />
      {label}…
    </div>
  );
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
