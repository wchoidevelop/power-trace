// Slides for the introduction carousel. Edit the copy here, not in index.tsx.

import { DIMENSIONS } from './dimensions';

export type IntroSlide = {
  key: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  body: string;
  /** drives the eyebrow, the page dot, and the tint on this slide's cards */
  tone: string;
  points?: { label: string; text: string; tone?: string; badge?: string; icon?: string }[];
  footnote?: string;
  /** hero only — renders the six power bases as a colour spectrum */
  spectrum?: boolean;
};

export const SLIDES: IntroSlide[] = [
  {
    key: 'hero',
    eyebrow: 'POWER DYNAMICS',
    title: 'Power Trace',
    subtitle: 'Mapping the invisible forces of influence',
    tone: '#6366f1',
    body:
      'Workplace conflict usually gets explained as a personality problem. More often it is a ' +
      'structural one — who holds which kind of leverage, and who has to route through whom.',
    spectrum: true,
    footnote: 'French & Raven (1959), against live U.S. Bureau of Labor Statistics data.',
  },
  {
    key: 'framework',
    eyebrow: 'THE FRAMEWORK',
    title: 'Six bases of power',
    tone: '#8b5cf6',
    body:
      'Power is not one quantity. The person with no title who controls what leadership hears is ' +
      'not powerless.',
    points: DIMENSIONS.map((d) => ({ label: d.label, text: d.blurb, tone: d.tone, icon: d.key })),
  },
  {
    key: 'method',
    eyebrow: 'THE METHOD',
    title: 'Built in stages',
    tone: '#06b6d4',
    body: 'Each stage narrows the uncertainty left by the last, and the map is audited before it is used.',
    points: [
      { icon: 'describe', label: 'Describe', text: 'Your org, its roles, your position.' },
      { icon: 'clarify', label: 'Score & clarify', text: 'Six dimensions per role, then questions that resolve the uncertain ones.' },
      { icon: 'audit', label: 'Audit', text: 'A bias pass corrects for the fact that you wrote every input.' },
      { icon: 'diagnose', label: 'Diagnose', text: 'Your situation, read against the finished map.' },
    ],
  },
  {
    key: 'data',
    eyebrow: 'THE DATA',
    title: 'Is leaving actually an option?',
    tone: '#10b981',
    body:
      'That is a labor-market fact, not a feeling. Sector flows come from BLS JOLTS, placed ' +
      'against their own history rather than shown raw.',
    points: [
      { label: 'Positioned, not raw', text: 'A 1.9% quits rate is high in one industry and low in another. You get where it sits in its own.' },
      { label: 'Read together', text: 'Low hires with low layoffs is a frozen market — a different trap than a shrinking one.' },
    ],
    footnote: 'The worker power index is a composite constructed for this app, not a BLS statistic.',
  },
];
