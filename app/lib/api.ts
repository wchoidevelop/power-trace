import { Platform } from "react-native";
import Constants from 'expo-constants';
import { Role } from "./analyzer/types";
import { z } from 'zod';
import { AdjustedRoleType, AdjustedRole, QuestionAnswer, Questionnaire, QuestionnaireType, ScoreType, SituationAnalysisType } from "./analyzer/prompts";
const API_PORT = 3000;

function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // In dev, Metro already detected the LAN IP and exposes it via hostUri.
  // Reuse that host with our API's port so physical devices reach the API
  // without needing a manually configured .env.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Fallback for older runtime shapes.
    (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig
      ?.debuggerHost;

  if (hostUri && Platform.OS !== 'web') {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      console.log(host, API_PORT)
      return `http://${host}:${API_PORT}`;
    }
  }

  // Simulators/emulators and web fall back to loopback. Android emulator
  // reaches the host machine via 10.0.2.2.
  if (Platform.OS === 'android') return `http://10.0.2.2:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}

const BASE_URL = resolveBaseUrl();

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export class ApiError extends Error {
  /**
   * `retryable` is the only thing the UI needs to decide whether offering a
   * retry button is honest. A 400 from a schema mismatch will fail identically
   * forever; a dropped connection or an upstream 503 will not.
   */
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public retryable = false,
    /** how many attempts were spent before giving up */
    public attempts = 1,
    /** server-requested wait, from Retry-After */
    public retryAfterMs?: number,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_RETRIES = 2;      // 3 attempts total
const RETRY_BASE_MS = 800;
const MAX_RETRY_WAIT_MS = 8_000;

/**
 * Per-endpoint policy. The two kinds of call here are not alike.
 *
 * MODEL — a reasoning call that runs for a minute or more. Aborting the fetch
 * does NOT cancel the work on the server, so an automatic retry does not
 * replace the first attempt, it runs a second one alongside it and bills for
 * both. Worse, the first attempt usually succeeds moments later. So: a long
 * ceiling, and zero automatic retries. Retrying is the user's call, through the
 * button on the failure card, and costs exactly one more call.
 *
 * DATA — BLS series pulls. Free, idempotent, seconds long. Auto-retry away.
 */
const MODEL_CALL = { timeoutMs: 300_000, retries: 0 } as const;
const DATA_CALL = { timeoutMs: 60_000, retries: 2 } as const;

/** 408 request timeout, 425 too early, 429 rate limit, and anything 5xx. */
function statusIsRetryable(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function backoffMs(attempt: number): number {
  const base = RETRY_BASE_MS * 2 ** (attempt - 1);
  return Math.min(base, MAX_RETRY_WAIT_MS) + Math.random() * 300; // jitter
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('retry-after');
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, MAX_RETRY_WAIT_MS);
  const at = Date.parse(raw);
  if (!Number.isNaN(at)) return Math.min(Math.max(at - Date.now(), 0), MAX_RETRY_WAIT_MS);
  return undefined;
}

/**
 * Pull something human out of an error response. The routes are not uniform:
 * some send `{error: {code, message}}`, some `{error: "text"}`, and the zod
 * guards send `{errors: <treeified>}`. Anything unrecognised falls back to the
 * status code so the UI never shows an empty message.
 */
async function readErrorBody(res: Response): Promise<{ code?: string; message?: string }> {
  let text: string;
  try {
    text = await res.text();
  } catch {
    return {};
  }
  if (!text) return {};

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    // an HTML error page (a dev-overlay or a proxy page) says nothing a user can
    // act on — let the status-based fallback speak instead
    if (/^\s*<(!doctype|html)/i.test(text)) return {};
    return { message: text.slice(0, 200) }; // a bare string, short enough to render
  }

  const err = body?.error;
  if (typeof err === 'string') return { message: err };
  if (err && typeof err === 'object') {
    return { code: err.code, message: err.message ?? err.detail };
  }
  if (body?.errors) {
    // zod tree: surface the first concrete complaint we can find
    const first = firstZodMessage(body.errors);
    return { code: 'invalid_request', message: first ?? 'The server rejected this request.' };
  }
  if (typeof body?.message === 'string') return { message: body.message };
  return {};
}

function firstZodMessage(node: any): string | undefined {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node.errors) && node.errors.length) return String(node.errors[0]);
  for (const child of Object.values(node.properties ?? node.items ?? node)) {
    const found = firstZodMessage(child);
    if (found) return found;
  }
  return undefined;
}

type RequestInitEx = RequestInit & {
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  /** retry attempts after the first try; 0 disables retrying */
  retries?: number;
  onRetry?: (attempt: number, err: ApiError) => void;
};

async function attempt<T>(url: string, init: RequestInitEx, timeoutMs: number): Promise<T> {
  const { query, headers, timeoutMs: _t, retries: _r, onRetry: _o, ...rest } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      // Giving up on the response does not stop the server working on it, so the
      // message must not imply the step was cancelled.
      throw new ApiError(
        0,
        'timeout',
        `No answer after ${Math.round(timeoutMs / 1000)}s. The step may still be finishing on the server — ` +
          `wait a moment before retrying, since retrying starts it over.`,
        true,
      );
    }
    throw new ApiError(0, 'network_unavailable', 'Could not reach the server. Check your connection.', true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const { code, message } = await readErrorBody(res);
    throw new ApiError(
      res.status,
      code ?? `http_${res.status}`,
      message,
      statusIsRetryable(res.status),
      1,
      parseRetryAfter(res),
    );
  }

  try {
    return (await res.json()) as T;
  } catch {
    // a 200 with an unreadable body is usually a truncated response — worth one more try
    throw new ApiError(res.status, 'bad_response', 'The server sent a response we could not read.', true);
  }
}

async function request<T>(path: string, init?: RequestInitEx): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, onRetry } = init ?? {};
  const url = new URL(path, BASE_URL);
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const href = url.toString();

  for (let tries = 1; ; tries++) {
    try {
      return await attempt<T>(href, init ?? {}, timeoutMs);
    } catch (err) {
      const e =
        err instanceof ApiError
          ? err
          : new ApiError(0, 'unknown', (err as Error)?.message ?? String(err));
      e.attempts = tries;
      if (!e.retryable || tries > retries) throw e;
      const wait = e.retryAfterMs ?? backoffMs(tries);
      console.warn(`[api] ${e.code} on ${path} (attempt ${tries}) — retrying in ${Math.round(wait)}ms`);
      onRetry?.(tries, e);
      await sleep(wait);
    }
  }
}

/** One sentence a user can act on. Never leaks a stack or a status code alone. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'network_unavailable':
        return 'Could not reach the server. Check your connection and try again.';
      case 'timeout':
        return err.message; // carries the elapsed budget and the retry caveat
      case 'rate_limited':
      case 'http_429':
        return 'The analysis service is rate limiting us. Wait a moment and try again.';
      case 'invalid_request':
        return err.message || 'The server rejected this request. Go back and check your inputs.';
      default:
        if (err.message && err.message !== err.code) return err.message;
        if (err.status >= 500) return 'The server hit an error running this step.';
        if (err.status >= 400) return `The server rejected this request (${err.status}).`;
        return 'Something went wrong on this step.';
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong on this step.';
}

/** Whether the UI should offer a retry. Non-API errors are assumed retryable. */
export function isRetryable(err: unknown): boolean {
  return err instanceof ApiError ? err.retryable : true;
}

export interface Footnote {
  code: string;
  text: string;
}

export interface DataPoint {
  year: string;
  period: string;
  periodName: string;
  latest?: string;
  value: string;
  footnotes: Footnote[];
}

interface GenderWageData {
  men: DataPoint[];
  women: DataPoint[];
  women_pct_of_men: DataPoint[];
}

interface UnionData {
    coverage: DataPoint[];
    union_wages: DataPoint[];
    nonunion_wages: DataPoint[];
}

interface CPS_LE {
  industry?: Record<string, Partial<GenderWageData>>;
  occupation?: Record<string, Partial<GenderWageData>>;
}

interface CPS_LU {
  industry?: Record<string, Partial<UnionData>>;
  occupation?: Record<string, Partial<UnionData>>;
}

// ── JOLTS (/api/JOLTS) ──────────────────────────────────────────────────────
// Every rate arrives already positioned against its own history. The bare rate
// is not comparable across industries, so the UI must never show it alone.

export type JOLTSSeriesType = 'hires' | 'job_openings' | 'total_separations' | 'quits' | 'layoffs'

export type MarketState =
  | 'tight' | 'frozen' | 'contracting' | 'reallocating' | 'balanced' | 'unknown';

export interface JoltsPoint {
  date: string;   // 'YYYY-MM'
  year: number;
  month: number;
  value: number;
  preliminary: boolean;
}

export interface JoltsScore {
  latest: number;
  date: string;
  preliminary: boolean;
  baselineMean: number;
  z: number | null;             // SDs from the 2015-19 mean
  percentile: number;           // rank against the full ~19y pull
  change3m: number | null;      // percentage points
  change12m: number | null;
}

export interface JoltsSeries {
  code: string;
  metric: JOLTSSeriesType;
  kind: 'rate' | 'level';
  data: JoltsPoint[];           // ascending by date
}

export interface JoltsIndustry {
  industry: string;
  asOf: string | null;
  preliminary: boolean;
  rates: Partial<Record<JOLTSSeriesType, JoltsScore | null>>;
  derived: {
    quitsToLayoffs: number | null;
    quitsShareOfSeparations: number | null;
    vacancyYield: number | null;
    netFlowRate: number | null;
  };
  classification: { state: MarketState; description: string };
  workerPowerIndex: number | null;
  series: JoltsSeries[];
}

export interface JoltsResponse {
  baseline: string;             // e.g. "2015-2019 mean"
  national: {
    vacanciesPerUnemployed: number | null;
    asOf: string | null;
    change12m: number | null;
    series: { date: string; value: number }[];
  };
  industries: JoltsIndustry[];
}

export const DescribedRoleSchema = z.object({
  ...AdjustedRole.shape.adjusted_roles.element.shape,
  description: z.string(),
});
export type DescribedRole = z.infer<typeof DescribedRoleSchema>;

export const DescribedAdjustedSchema = z.object({
  adjusted_roles: z.array(DescribedRoleSchema).min(1),
  bias_flags: AdjustedRole.shape.bias_flags,
  confidence: AdjustedRole.shape.confidence,
  // the analysis weighs each bias flag against why the map was rated this
  // confident, so it travels with them
  confidence_rationale: AdjustedRole.shape.confidence_rationale.optional(),
});
export type DescribedAdjusted = z.infer<typeof DescribedAdjustedSchema>;
const WageUnionCut = z.object({
  // from CPS LE
  women:            z.number().optional(),
  men:              z.number().optional(),
  women_pct_of_men: z.number().optional(),
  // from CPS LU
  coverage:         z.number().optional(),
  union_wages:      z.number().optional(),
  nonunion_wages:   z.number().optional(),
});

// Mirrors LaborDataSchema in server/lib/ai.ts — keep the two in step.
const FlowScore = z.object({
  latest:       z.number(),
  date:         z.string(),
  preliminary:  z.boolean().optional(),
  baselineMean: z.number().nullish(),
  z:            z.number().nullish(),
  percentile:   z.number().nullish(),
  change3m:     z.number().nullish(),
  change12m:    z.number().nullish(),
});

// from JOLTS — sector level only, no occupation breakdown
const SectorFlows = z.object({
  label:            z.string().optional(),
  asOf:             z.string().nullish(),
  preliminary:      z.boolean().optional(),
  baseline:         z.string().optional(),
  state:            z.enum(['tight', 'frozen', 'contracting', 'reallocating', 'balanced', 'unknown']).optional(),
  stateDescription: z.string().optional(),
  rates: z.object({
    quits:             FlowScore.nullish(),  // worker exit power → drives EVLN
    layoffs:           FlowScore.nullish(),  // employer power / precarity
    job_openings:      FlowScore.nullish(),  // market tightness
    hires:             FlowScore.nullish(),
    total_separations: FlowScore.nullish(),
  }).partial().optional(),
  derived: z.object({
    quitsToLayoffs:          z.number().nullish(),
    quitsShareOfSeparations: z.number().nullish(),
    vacancyYield:            z.number().nullish(),
    netFlowRate:             z.number().nullish(),
  }).partial().optional(),
  workerPowerIndex: z.number().nullish(),  // constructed composite, not a BLS statistic
});

const NationalContext = z.object({
  vacanciesPerUnemployed: z.number().nullish(),
  asOf:                   z.string().nullish(),
  change12m:              z.number().nullish(),
}).partial();

export const LaborDataSchema = z.object({
  labels: z.object({
    cps_le_industry:   z.string().optional(),
    cps_le_occupation: z.string().optional(),
    cps_lu_industry:   z.string().optional(),
    cps_lu_occupation: z.string().optional(),
    jolts_supersector: z.string().optional(),
  }),
  industry:   WageUnionCut.optional(),    // LE + LU, industry lens
  occupation: WageUnionCut.optional(),    // LE + LU, occupation lens
  sector:     SectorFlows.optional(),     // JOLTS
  national:   NationalContext.optional(), // V/U ratio, national only
});

export type LaborData = z.infer<typeof LaborDataSchema>

export interface IndustryCodes {
    "cps_industry": {"label": string | null; "code": string | null; "confidence": number},
    "cps_occupation_le": {"label": string | null; "code": string | null; "confidence": number},
    "cps_occupation_lu": {"label": string | null; "code": string | null; "confidence": number},
    "jolts": {"supersector": string | null; "code": string | null; "confidence": number},
    "organization_type": string;
    "reasoning": string;
    "warning": null | string
}

// /api/BLS is now only the CPS half — JOLTS comes from /api/JOLTS, which
// returns scored series rather than raw ones.
export interface BLS {
  le?: CPS_LE,
  lu?: CPS_LU
}

// ── Legal documents ─────────────────────────────────────────────────────────
// Privacy policy and terms live on the server so a correction reaches users
// without an app release. Shape mirrors server/lib/legal.ts.

export type LegalDocSlug = 'privacy' | 'terms';

export interface LegalDoc {
  slug: LegalDocSlug;
  title: string;
  effective: string;
  version: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
}

export interface LegalResponse {
  app: string;
  /** canonical public URLs, for opening a document in a browser */
  web: Record<LegalDocSlug, string>;
  docs: LegalDoc[];
}


export const api = {
    cps_le: (query: Record<string, string>) =>
        request<CPS_LE>(`/api/CPS`, {query, ...DATA_CALL}),
    cps_lu: (query: Record<string, string>) =>
        request<CPS_LU>(`/api/LU`, {query, ...DATA_CALL}),
    jolts: (query: Record<string, string>) =>
        request<JoltsResponse>(`/api/JOLTS`, {query, ...DATA_CALL}),
    bls: (query: Record<string, string>) =>
        request<BLS>(`/api/BLS`, {query, ...DATA_CALL}),
    scoring: (org: string, roles: Role[]) =>
        request<ScoreType[]>(`/api/scoring`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({org, roles}),
            ...MODEL_CALL,
        }),
    questionnaire: (org: string, roles: Role[], scoring: ScoreType[]) =>
        request<QuestionnaireType[]>(`/api/questionnaire`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({org, roles, scoring}),
            ...MODEL_CALL,
        }),
    // selfRoleId is the id of the user's own role — the server joins the whole
    // bias audit on it, so a prose description will not do
    adjust_scores: (org: string, selfRoleId: string, roles: Role[], scoring: ScoreType[], questionAnswers: QuestionAnswer[]) =>
        request<AdjustedRoleType>(`/api/adjust`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({org, roles, scoring, selfRoleId, questionAnswers}),
            ...MODEL_CALL,
        }),
    // embeddings + a nano classifier: cheap and quick, but still a model call,
    // so it gets the same no-auto-retry treatment
    classify_industry: (org: string, role: string) =>
        request<IndustryCodes>(`/api/industryData`, {method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({orgDescription: org, userRole: role}),
          ...MODEL_CALL,
        }),
    analyze_situation: (
        org: string,
        situationText: string,
        userRole: DescribedRole,
        roles: Partial<DescribedAdjusted>,
        // omitted for unpaid roles, and when the labor pull did not complete —
        // the server reasons from the power map alone rather than inventing
        // market claims
        laborData?: LaborData,
        ) =>
        request<SituationAnalysisType>(`/api/analyze-situation`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ org, situationText, userRole, roles, laborData }),
            ...MODEL_CALL,
        }),
    // omit `doc` for both documents. Short timeout: this is static text, and a
    // user waiting on a privacy policy should not wait a minute for it.
    legal: (doc?: LegalDocSlug) =>
        request<LegalResponse>(`/api/legal`, {
            query: doc ? { doc } : undefined,
            timeoutMs: 15_000,
            retries: 2,
        }),
}