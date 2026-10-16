import type { Role, Scored } from './types';

export const uid = () => Math.random().toString(36).slice(2, 9);

export const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function fallbackScore(role: Role, idx: number): Omit<Scored, keyof Role> {
  const seed = (role.name.length + role.description.length + idx) % 7;
  return {
    formalPower: 35 + seed * 6,
    informalInfluence: 30 + ((seed * 11) % 50),
    autonomy: 25 + ((seed * 13) % 60),
    confidence: 0.45 + (seed % 4) * 0.07,
  };
}

export function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) sum += Math.abs(sorted[i] - sorted[j]);
  return sum / (2 * n * n * mean);
}
