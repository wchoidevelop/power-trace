import type { BiasFinding, Question, Role, Scored } from './types';

export const SAMPLE_ROLES: Role[] = [
  {
    id: 'ceo',
    name: 'Chief Executive Officer',
    description:
      'Sets company strategy, reports to the board, final say on hiring above director level.',
  },
  {
    id: 'vp-eng',
    name: 'VP of Engineering',
    description:
      'Owns the engineering org, approves headcount, reports directly to the CEO.',
  },
  {
    id: 'pm',
    name: 'Senior Product Manager',
    description:
      'Defines product roadmap. No direct reports but coordinates across three engineering teams.',
  },
  {
    id: 'eng',
    name: 'Software Engineer II',
    description:
      'Ships features on the platform team. Reports to an engineering manager.',
  },
  {
    id: 'ea',
    name: 'Executive Assistant to the CEO',
    description:
      "Manages the CEO's calendar and gatekeeps access. No formal authority but high informational access.",
  },
  {
    id: 'ic-design',
    name: 'Staff Designer',
    description:
      'Individual contributor leading design system. No reports, but consulted on all UX decisions.',
  },
];

export const HARDCODED_SCORES: Record<string, Omit<Scored, keyof Role>> = {
  ceo: { formalPower: 95, informalInfluence: 88, autonomy: 96, confidence: 0.94 },
  'vp-eng': { formalPower: 78, informalInfluence: 72, autonomy: 80, confidence: 0.88 },
  pm: { formalPower: 42, informalInfluence: 64, autonomy: 55, confidence: 0.61 },
  eng: { formalPower: 22, informalInfluence: 28, autonomy: 35, confidence: 0.82 },
  ea: { formalPower: 18, informalInfluence: 71, autonomy: 30, confidence: 0.48 },
  'ic-design': { formalPower: 30, informalInfluence: 66, autonomy: 70, confidence: 0.57 },
};

export const QUESTION_BANK: Record<string, Question[]> = {
  pm: [
    {
      id: 'pm-1',
      roleId: 'pm',
      text: 'When this role disagrees with engineering on scope, who typically prevails?',
      dimension: 'formalPower',
    },
    {
      id: 'pm-2',
      roleId: 'pm',
      text: 'Can this role kill a project unilaterally?',
      dimension: 'autonomy',
    },
  ],
  ea: [
    {
      id: 'ea-1',
      roleId: 'ea',
      text: 'Does this role decide which meeting requests reach the CEO?',
      dimension: 'informalInfluence',
    },
    {
      id: 'ea-2',
      roleId: 'ea',
      text: 'Is this role copied on strategic communications above their pay grade?',
      dimension: 'informalInfluence',
    },
  ],
  'ic-design': [
    {
      id: 'ic-design-1',
      roleId: 'ic-design',
      text: 'Can this role block a release on UX grounds without escalation?',
      dimension: 'formalPower',
    },
    {
      id: 'ic-design-2',
      roleId: 'ic-design',
      text: "Are this role's recommendations adopted without modification most of the time?",
      dimension: 'informalInfluence',
    },
  ],
};

export const KNOWN_EDGES: [string, string][] = [
  ['ceo', 'vp-eng'],
  ['ceo', 'ea'],
  ['vp-eng', 'pm'],
  ['vp-eng', 'eng'],
  ['pm', 'ic-design'],
  ['pm', 'eng'],
  ['ic-design', 'eng'],
];

export const BIAS_FINDINGS: BiasFinding[] = [
  {
    roleId: 'ea',
    category: 'Gendered framing',
    detail:
      "Description leans on 'gatekeeps' and 'manages calendar' — language historically used to undervalue assistant roles (often coded female).",
    suggestion:
      "Re-score with a neutral frame: 'controls executive access and information flow.' Informal influence raised from 60 → 71.",
  },
  {
    roleId: 'pm',
    category: 'Title inflation bias',
    detail:
      "'Senior' in title pulled formal-power score upward despite no direct reports. Counter-anchored against headcount signal.",
    suggestion:
      'Formal power adjusted down 8 points. Influence retained — coordination authority is real.',
  },
  {
    roleId: 'eng',
    category: 'Level ambiguity',
    detail:
      "'II' level was treated as junior by the model. Cross-checked against scope ('ships features on platform team') — kept at IC tier.",
    suggestion: 'No change. Flagged for human review if org uses non-standard leveling.',
  },
];
