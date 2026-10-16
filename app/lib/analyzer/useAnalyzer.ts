import { useRef, useState } from 'react';
import { HARDCODED_SCORES, QUESTION_BANK, SAMPLE_ROLES } from './seed';
import { clamp, fallbackScore, uid } from './helpers';
import type { Answer, Question, Role, Scored, Stage, StepFailure, StepId } from './types';
import type { ScoreType, QuestionnaireType, AdjustedRoleType, SituationAnalysisType } from './prompts';
import { api, apiErrorMessage, ApiError, BLS, DataPoint, IndustryCodes, isRetryable, JoltsResponse, LaborData } from '../api';
import {
  saveSetup as persistSetup,
  saveRun as persistRun,
  type OrgSelf,
  type SavedSetup,
  type SavedRun,
} from '../storage';

/**
 * Drop the level series' data points before anything holds onto the response.
 *
 * The route returns ~19 years of monthly observations for 10 series. Levels are
 * only there so the server can compute vacancy yield, which it already did —
 * keeping them would push a saved run past a quarter-megabyte in AsyncStorage
 * for numbers nothing reads. The rate history stays: it is what gets charted.
 */
function trimJolts(res: JoltsResponse): JoltsResponse {
  return {
    ...res,
    industries: res.industries.map((ind) => ({
      ...ind,
      series: ind.series.filter((s) => s.kind === 'rate'),
    })),
  };
}

/**
 * A step that cannot run because the data it needs is wrong or missing.
 * Retrying it would fail identically, so the UI offers "go back" instead.
 */
class StepInputError extends Error {
  name = 'StepInputError';
}

export function useAnalyzer() {
  const [stage, setStage] = useState<Stage>('org');
  // when set, the UI shows an already-completed stage in read-only mode without
  // touching the live pipeline `stage` or re-running any AI analysis.
  const [viewStage, setViewStage] = useState<Stage | null>(null);
  const [orgSelfDescription, setOrgSelfDescription] = useState<OrgSelf>({
    org: 'A 180-person Series-B SaaS company building developer tooling. Hybrid, west-coast HQ.',
    role: 'Software Developer I',
    self: 'Entry level software developer creating the frontend for our tooling, React, Zod, I go on meeting every Monday to learn what our team is doing from my manager',
    paid: true,
  });
  const [roles, setRoles] = useState<Role[]>(SAMPLE_ROLES);
  const [scored, setScored] = useState<ScoreType[]>([]);
  const [questions, setQuestions] = useState<QuestionnaireType[] | undefined>(undefined);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [adjusted, setAdjusted] = useState<Partial<AdjustedRoleType>>({});
  const [BLSData, setBLSData] = useState<BLS>({});
  const [joltsData, setJoltsData] = useState<JoltsResponse>();
  const [industryCodes, setIndustryCodes] = useState<IndustryCodes>();
  const [situation, setSituation] = useState<string>('');
  const [analysis, setAnalysis] = useState<SituationAnalysisType | null>(null);
  /**
   * The classifier ran and found no federal classification that fits this
   * organization. Distinct from "the labor step failed": there is simply no
   * such data for an unpaid club, and the analysis proceeds without it.
   */
  const [laborNotApplicable, setLaborNotApplicable] = useState(false);

  // ── failure handling ──────────────────────────────────────────────────────
  // Every step that touches the API runs through `runStep`, which records what
  // to re-run so a failure is a retry away rather than a dead end.
  const [busyStep, setBusyStep] = useState<StepId | null>(null);
  const [failure, setFailure] = useState<StepFailure | null>(null);
  const retryRef = useRef<(() => Promise<void>) | null>(null);
  const busyRef = useRef(false); // synchronous guard — state lags a double tap

  // Results already paid for, kept so a retry resumes instead of restarting.
  // The labor step makes three calls; a JOLTS failure should not buy the
  // industry classification a second time.
  const laborCache = useRef<{ codes?: IndustryCodes; bls?: BLS; jolts?: JoltsResponse }>({});
  const clearLaborCache = () => { laborCache.current = {}; };

  const runStep = async (step: StepId, fn: () => Promise<void>) => {
    if (busyRef.current) return; // a step is already in flight
    retryRef.current = () => runStep(step, fn);
    busyRef.current = true;
    setBusyStep(step);
    setFailure(null);
    try {
      await fn();
    } catch (err) {
      console.error(`[${step}] failed`, err);
      setFailure({
        step,
        message: apiErrorMessage(err),
        code: err instanceof ApiError ? err.code : err instanceof StepInputError ? 'bad_input' : 'unexpected',
        retryable: err instanceof StepInputError ? false : isRetryable(err),
        attempts: err instanceof ApiError ? err.attempts : 1,
      });
    } finally {
      busyRef.current = false;
      setBusyStep(null);
    }
  };

  const retryStep = () => { void retryRef.current?.(); };
  const clearFailure = () => setFailure(null);

  // the last stage the user can actually change something on, per step
  const BACK_TO: Record<StepId, Stage> = {
    scoring: 'roles',
    questionnaire: 'scoring',
    adjusting: 'questionnaire',
    labor: 'bias',
    analysis: 'situation',
  };

  // give up on the failed step and return to the last editable stage
  const backFromFailure = () => {
    if (!failure) return;
    if (failure.step === 'labor') clearLaborCache();
    setStage(BACK_TO[failure.step]);
    setViewStage(null);
    setFailure(null);
  };

  const addRole = () => setRoles((r) => [...r, { id: uid(), name: '', description: '', isUserRole: false }]);
  const updateRole = (id: string, patch: Partial<Role>) =>
    setRoles((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeRole = (id: string) => setRoles((r) => r.filter((x) => x.isUserRole || x.id !== id));

  const runOrgSelf = async () => {
    setRoles(prev => [{ id: uid(), name: orgSelfDescription.role, description: orgSelfDescription.self, isUserRole: true }, ...prev])
    setStage('roles');
  }

  const runScoring = () =>
    runStep('scoring', async () => {
      setStage('scoring');
      setScored([]); // clear a stale result so the loading guard fires on retry
      const scores = await api.scoring(orgSelfDescription.org, roles);
      setScored(scores);
    });

  const runQuestionnaire = () =>
    runStep('questionnaire', async () => {
      setStage('questionnaire');
      setQuestions(undefined); // clear stale questions so the loading guard fires
      const qs = await api.questionnaire(orgSelfDescription.org, roles, scored);
      setQuestions(qs);
    });

  const submitAnswers = () =>
    runStep('adjusting', async () => {
      const selfRoleId = roles.find((r) => r.isUserRole)?.id;
      if (!selfRoleId) throw new StepInputError('No role is flagged as yours. Go back and mark which role you hold.');

      setStage('adjusting');
      const qa = (questions ?? []).map(q => ({...q, answer: answers[q.id]}))
      const adj = await api.adjust_scores(orgSelfDescription.org, selfRoleId, roles, scored, qa)
      setAdjusted(adj)
      setStage('bias')
    });

  /**
   * Whether the labor-market stage applies at all.
   *
   * BLS CPS and JOLTS measure paid employment — wages, union coverage, quits,
   * layoffs. For a school club, a church, or a volunteer organization none of
   * that exists, and the classifier would answer anyway: it would force-fit a
   * code like "Educational services" and return real figures describing *paid
   * staff* in that sector. Those would then reach the EVLN prediction, where
   * they argue about how costly exit is — the one question a volunteer's answer
   * differs on most. Skipping is more accurate than approximating here.
   *
   * Runs saved before this flag existed have it undefined, and were workplaces.
   */
  const usesLaborData = orgSelfDescription.paid !== false;

  // where "Next" goes from the bias step, which is the stage the skip bypasses
  const continueFromBias = () =>
    usesLaborData ? runBLS() : Promise.resolve(setStage('situation'));

  /** Abandon the labor stage and analyze without it — the analysis handles absence. */
  const skipLabor = () => {
    setFailure(null);
    setStage('situation');
  };

  const runBLS = () =>
    runStep('labor', async () => {
      setStage('labor');
      const cache = laborCache.current;

      const codes = cache.codes ?? await api.classify_industry(orgSelfDescription.org, orgSelfDescription.self);
      cache.codes = codes;
      setIndustryCodes(codes);

      // /api/BLS covers the CPS half only. JOLTS moved to its own route because it
      // returns rates already positioned against their own 19-year history, which
      // is the only form in which a JOLTS rate means anything.
      let query: Record<string,string | null> = {};
      query.industry = codes.cps_industry.code;
      query.le_occupation = codes.cps_occupation_le.code;
      query.lu_occupation = codes.cps_occupation_lu.code;
      const cleanquery = Object.fromEntries(
        Object.entries(query).filter(([, v]) => v !== null && v !== '')
      );
      const joltsCode = codes.jolts.code ?? codes.jolts.supersector;

      /**
       * The classifier returns nulls when nothing in the published federal
       * classifications fits — a school club, a volunteer group, an unpaid role
       * of any kind. That is a correct answer, not a failure.
       *
       * Asking BLS for no series is what actually broke here: an empty query is
       * rejected with "provide at least one of…", surfacing a 400 that looked
       * like the labor step had failed when in truth there was nothing to fetch.
       */
      const wantsCps = Object.keys(cleanquery).length > 0;
      if (!wantsCps && !joltsCode) {
        setBLSData({});
        setJoltsData(undefined);
        setLaborNotApplicable(true);
        return;
      }
      setLaborNotApplicable(false);

      // Each leg caches itself on success, so if one of the two fails the retry
      // only re-runs the leg that actually failed. A leg with no codes to ask
      // about is skipped rather than sent empty.
      const blsCall = cache.bls
        ? Promise.resolve(cache.bls)
        : wantsCps
          ? api.bls(cleanquery as Record<string,string>).then((r) => (cache.bls = r))
          : Promise.resolve({} as BLS);
      const joltsCall = cache.jolts
        ? Promise.resolve(cache.jolts)
        : joltsCode
          ? api.jolts({ industry: joltsCode }).then((r) => (cache.jolts = trimJolts(r)))
          : Promise.resolve(undefined);

      const [bls, jolts] = await Promise.all([blsCall, joltsCall]);
      setBLSData(bls);
      setJoltsData(jolts);
    });

  // pick the latest datapoint from a BLS series and coerce to number
  function latest(series?: DataPoint[]): number | undefined {
    if (!series?.length) return undefined;
    const d = series.find((x) => x.latest) ?? series[0]; // BLS sets latest only on newest
    const n = Number(d.value);
    return Number.isFinite(n) ? n : undefined;
  }

  const runAnalysis = () => runStep('analysis', async () => {
    // 1. join descriptions onto adjusted roles
    const descmap: Record<string, string> = {};
    roles.forEach((r) => (descmap[r.id] = r.description));
    const describedRoles = (adjusted.adjusted_roles ?? []).map((a) => ({
      ...a,
      description: descmap[a.id] ?? "",
    }));
    const described = { ...adjusted, adjusted_roles: describedRoles };

    // 2. resolve the CODES used to index BLS data (not labels)
    const indCode   = industryCodes?.cps_industry?.code ?? undefined;
    const leOccCode = industryCodes?.cps_occupation_le?.code ?? undefined;
    const luOccCode = industryCodes?.cps_occupation_lu?.code ?? undefined;

    const leInd = indCode   ? BLSData.le?.industry?.[indCode]     : undefined;
    const luInd = indCode   ? BLSData.lu?.industry?.[indCode]     : undefined;
    const leOcc = leOccCode ? BLSData.le?.occupation?.[leOccCode] : undefined;
    const luOcc = luOccCode ? BLSData.lu?.occupation?.[luOccCode] : undefined;

    // one industry is requested, so the sector block is the only entry
    const sector = joltsData?.industries?.[0];

    // 3. build LaborData — labels from .label, values from .code-indexed series.
    // Left undefined when the labor stage did not apply or did not complete: the
    // analysis prompt has a path for absent market data and reasons from the
    // power map alone, which is the honest answer for an unpaid role.
    const laborData: LaborData | undefined =
      !usesLaborData || !industryCodes || laborNotApplicable ? undefined : {
      labels: {
        cps_le_industry:   industryCodes?.cps_industry?.label     ?? undefined,
        cps_le_occupation: industryCodes?.cps_occupation_le?.label ?? undefined,
        cps_lu_industry:   industryCodes?.cps_industry?.label     ?? undefined,
        cps_lu_occupation: industryCodes?.cps_occupation_lu?.label ?? undefined,
        jolts_supersector: industryCodes?.jolts?.supersector       ?? undefined,
      },
      industry: {
        women:            latest(leInd?.women),
        men:              latest(leInd?.men),
        women_pct_of_men: latest(leInd?.women_pct_of_men),
        coverage:         latest(luInd?.coverage),
        union_wages:      latest(luInd?.union_wages),
        nonunion_wages:   latest(luInd?.nonunion_wages),
      },
      occupation: {
        women:            latest(leOcc?.women),
        men:              latest(leOcc?.men),
        women_pct_of_men: latest(leOcc?.women_pct_of_men),
        coverage:         latest(luOcc?.coverage),
        union_wages:      latest(luOcc?.union_wages),
        nonunion_wages:   latest(luOcc?.nonunion_wages),
      },
      sector: sector && {
        label:            industryCodes?.jolts?.supersector ?? undefined,
        asOf:             sector.asOf,
        preliminary:      sector.preliminary,
        baseline:         joltsData?.baseline,
        state:            sector.classification?.state,
        stateDescription: sector.classification?.description,
        // pass the whole score object, not the bare rate — the z-score and the
        // percentile are what make the number readable at all
        rates: {
          quits:             sector.rates.quits,
          layoffs:           sector.rates.layoffs,
          job_openings:      sector.rates.job_openings,
          hires:             sector.rates.hires,
          total_separations: sector.rates.total_separations,
        },
        derived:          sector.derived,
        workerPowerIndex: sector.workerPowerIndex,
      },
      national: joltsData?.national && {
        vacanciesPerUnemployed: joltsData.national.vacanciesPerUnemployed,
        asOf:                   joltsData.national.asOf,
        change12m:              joltsData.national.change12m,
      },
    };

    // 4. resolve the user's role explicitly — not [0]
    const userId = roles.find((r) => r.isUserRole)?.id;
    if (!userId) throw new StepInputError("No role is flagged as yours. Go back and mark which role you hold.");
    const userRole = described.adjusted_roles.find((r) => r.id === userId);
    if (!userRole) throw new StepInputError("Your role is missing from the adjusted power map. Re-run the scoring steps.");

    setStage('analysis');
    const result = await api.analyze_situation(orgSelfDescription.org, situation, userRole, described, laborData);
    setAnalysis(result);
    setStage('viz');
  });

  // navigate to an already-completed stage for read-only review; passing the
  // live stage (or null) returns to the live pipeline. Never triggers AI.
  const goToStage = (s: Stage | null) => setViewStage(s === null || s === stage ? null : s);
  const returnToCurrent = () => setViewStage(null);

  // persist just the inputs (org + roles) as a reusable template
  const saveSetup = (label?: string) =>
    persistSetup({ orgSelfDescription, roles, label });

  // persist the entire current run so it can be reloaded and reviewed later
  const saveRun = (label?: string) =>
    persistRun(
      {
        orgSelfDescription,
        roles,
        scored,
        questions,
        answers,
        adjusted,
        industryCodes,
        BLSData,
        joltsData,
        situation,
        analysis,
      },
      label,
    );

  // load a saved org/roles template: restore inputs, clear downstream results,
  // and drop the user on the roles step ready to (re-)run — no AI is triggered.
  const applySetup = (s: SavedSetup) => {
    setOrgSelfDescription(s.orgSelfDescription);
    setRoles(s.roles);
    setScored([]);
    setQuestions(undefined);
    setAnswers({});
    setAdjusted({});
    setBLSData({});
    setJoltsData(undefined);
    setIndustryCodes(undefined);
    setSituation('');
    setAnalysis(null);
    setViewStage(null);
    setFailure(null);
    setLaborNotApplicable(false);
    clearLaborCache();
    setStage('roles');
  };

  // load a full saved run: restore every field and land on the map for review.
  // Existing read-only stage navigation lets the user walk back through it.
  const applyRun = (r: SavedRun) => {
    const s = r.snapshot;
    setOrgSelfDescription(s.orgSelfDescription);
    setRoles(s.roles);
    setScored(s.scored);
    setQuestions(s.questions);
    setAnswers(s.answers);
    setAdjusted(s.adjusted);
    setIndustryCodes(s.industryCodes);
    setBLSData(s.BLSData);
    setJoltsData(s.joltsData);
    setSituation(s.situation);
    setAnalysis(s.analysis);
    setViewStage(null);
    setFailure(null);
    // a restored run's labor data is already final — seed the cache so a later
    // re-run of the step does not re-buy calls we already have answers for.
    // An empty BLS object means the run never got that far: leave it unset.
    const restoredBls = s.BLSData?.le || s.BLSData?.lu ? s.BLSData : undefined;
    laborCache.current = { codes: s.industryCodes, bls: restoredBls, jolts: s.joltsData };
    setStage('viz');
  };

  const reset = () => {
    setStage('org');
    setViewStage(null);
    setFailure(null);
    setLaborNotApplicable(false);
    clearLaborCache();
    setRoles(SAMPLE_ROLES);
    setScored([]);
    setQuestions(undefined);
    setAnswers({});
    setAdjusted({});
    setBLSData({});
    setJoltsData(undefined);
    setIndustryCodes(undefined);
    setSituation('');
    setAnalysis(null);
  };

  return {
    stage,
    setStage,
    viewStage,
    goToStage,
    returnToCurrent,
    saveSetup,
    saveRun,
    applySetup,
    applyRun,
    orgSelfDescription,
    setOrgSelfDescription,
    roles,
    addRole,
    updateRole,
    removeRole,
    scored,
    questions,
    answers,
    setAnswers,
    adjusted,
    BLSData,
    joltsData,
    industryCodes,
    situation,
    setSituation,
    analysis,
    runScoring,
    submitAnswers,
    reset,
    runQuestionnaire,
    runBLS,
    runOrgSelf,
    runAnalysis,
    // labor stage applicability
    usesLaborData,
    laborNotApplicable,
    continueFromBias,
    skipLabor,
    // failure handling
    busyStep,
    failure,
    retryStep,
    clearFailure,
    backFromFailure,
  };
}
