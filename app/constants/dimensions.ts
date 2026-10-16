// French & Raven's six bases of social power — used to score each role.
// Order matches the display order in ScoreRow.
//
// `tone` gives each base its own hue. Hues are drawn from the accent palette in
// theme.ts so they feel native whichever accent is active, and they are used for
// borders, tints, and dots only — never for body text — so contrast stays the
// theme's job in both light and dark.

export type DimensionKey =
  | 'legitimate'
  | 'reward'
  | 'referent'
  | 'expert'
  | 'coercive'
  | 'informational';

export const DIMENSIONS: { key: DimensionKey; label: string; blurb: string; tone: string }[] = [
  { key: 'legitimate', label: 'Legitimate', blurb: 'Authority granted by a formal position or title.', tone: '#6366f1' },
  { key: 'reward', label: 'Reward', blurb: 'Ability to grant benefits, opportunities, or recognition.', tone: '#10b981' },
  { key: 'referent', label: 'Referent', blurb: 'Power from others wanting to follow or be associated with the person.', tone: '#8b5cf6' },
  { key: 'expert', label: 'Expert', blurb: 'Power from irreplaceable knowledge or skill.', tone: '#06b6d4' },
  { key: 'coercive', label: 'Coercive', blurb: 'Ability to punish, exclude, or impose costs.', tone: '#f43f5e' },
  { key: 'informational', label: 'Informational', blurb: 'Power from controlling what others know.', tone: '#f59e0b' },
];

export const DIMENSION_TONE: Record<DimensionKey, string> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, d.tone]),
) as Record<DimensionKey, string>;

/** Alpha suffixes for 8-digit hex, so a tone can tint a surface without a second palette. */
export const TINT = { wash: '14', soft: '22', line: '4d' } as const;
