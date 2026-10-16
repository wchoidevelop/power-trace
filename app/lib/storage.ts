import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Role } from './analyzer/types';
import type {
  ScoreType,
  QuestionnaireType,
  AdjustedRoleType,
  SituationAnalysisType,
} from './analyzer/prompts';
import type { BLS, IndustryCodes, JoltsResponse } from './api';

const SETUPS_KEY = 'pd:setups';
const RUNS_KEY = 'pd:runs';

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export type OrgSelf = {
  org: string;
  role: string;
  self: string;
  /**
   * Whether this is paid employment. Drives the labor-market stage, which is
   * built on BLS wage and turnover data and means nothing for a volunteer role.
   *
   * Optional so runs saved before this existed still load; absent is read as
   * paid, which is what those runs assumed.
   */
  paid?: boolean;
};

// a reusable org + roles template (inputs only)
export type SavedSetup = {
  id: string;
  label: string;
  createdAt: number;
  orgSelfDescription: OrgSelf;
  roles: Role[];
};

// a full analysis run — everything needed to restore and review it read-only
export type RunSnapshot = {
  orgSelfDescription: OrgSelf;
  roles: Role[];
  scored: ScoreType[];
  questions?: QuestionnaireType[];
  answers: Record<string, string>;
  adjusted: Partial<AdjustedRoleType>;
  industryCodes?: IndustryCodes;
  BLSData: BLS;
  joltsData?: JoltsResponse;  // absent in runs saved before JOLTS moved routes
  situation: string;
  analysis: SituationAnalysisType | null;
};

export type SavedRun = {
  id: string;
  label: string;
  createdAt: number;
  snapshot: RunSnapshot;
};

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

// ---- setups ---------------------------------------------------------------

export async function listSetups(): Promise<SavedSetup[]> {
  const list = await readList<SavedSetup>(SETUPS_KEY);
  return list.sort((a, b) => b.createdAt - a.createdAt); // newest first
}

export async function saveSetup(
  data: Omit<SavedSetup, 'id' | 'createdAt' | 'label'> & { label?: string },
): Promise<SavedSetup> {
  const list = await readList<SavedSetup>(SETUPS_KEY);
  const createdAt = Date.now();
  const entry: SavedSetup = {
    id: uid(),
    createdAt,
    label: data.label?.trim() || defaultLabel(data.orgSelfDescription, createdAt),
    orgSelfDescription: data.orgSelfDescription,
    roles: data.roles,
  };
  await writeList(SETUPS_KEY, [entry, ...list]);
  return entry;
}

export async function deleteSetup(id: string): Promise<void> {
  const list = await readList<SavedSetup>(SETUPS_KEY);
  await writeList(SETUPS_KEY, list.filter((s) => s.id !== id));
}

// ---- runs -----------------------------------------------------------------

export async function listRuns(): Promise<SavedRun[]> {
  const list = await readList<SavedRun>(RUNS_KEY);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveRun(snapshot: RunSnapshot, label?: string): Promise<SavedRun> {
  const list = await readList<SavedRun>(RUNS_KEY);
  const createdAt = Date.now();
  const entry: SavedRun = {
    id: uid(),
    createdAt,
    label: label?.trim() || defaultLabel(snapshot.orgSelfDescription, createdAt),
    snapshot,
  };
  await writeList(RUNS_KEY, [entry, ...list]);
  return entry;
}

export async function deleteRun(id: string): Promise<void> {
  const list = await readList<SavedRun>(RUNS_KEY);
  await writeList(RUNS_KEY, list.filter((r) => r.id !== id));
}

// ---- helpers --------------------------------------------------------------

function defaultLabel(org: OrgSelf, when: number): string {
  const name = org.role?.trim() || org.org?.trim() || 'Untitled';
  const short = name.length > 32 ? name.slice(0, 32) + '…' : name;
  return `${short} · ${formatDate(when)}`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
