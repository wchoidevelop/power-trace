import { Platform } from 'react-native';

export type Mode = 'light' | 'dark';
export type ModePref = 'system' | 'light' | 'dark';

export type AccentKey = 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet' | 'cyan';

export const ACCENTS: Record<
  AccentKey,
  { name: string; base: string; border: string; softLight: string; softDark: string }
> = {
  indigo: { name: 'Indigo', base: '#6366f1', border: '#4f46e5', softLight: '#eef2ff', softDark: '#312e81' },
  emerald: { name: 'Emerald', base: '#10b981', border: '#059669', softLight: '#d1fae5', softDark: '#064e3b' },
  rose: { name: 'Rose', base: '#f43f5e', border: '#e11d48', softLight: '#ffe4e6', softDark: '#881337' },
  amber: { name: 'Amber', base: '#f59e0b', border: '#d97706', softLight: '#fef3c7', softDark: '#451a03' },
  violet: { name: 'Violet', base: '#8b5cf6', border: '#7c3aed', softLight: '#ede9fe', softDark: '#4c1d95' },
  cyan: { name: 'Cyan', base: '#06b6d4', border: '#0891b2', softLight: '#cffafe', softDark: '#164e63' },
};

export const ACCENT_ORDER: AccentKey[] = ['indigo', 'emerald', 'violet', 'rose', 'amber', 'cyan'];

export type Theme = {
  mode: Mode;
  bg: string;
  surface: string;
  surfaceSubtle: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  success: string;
  danger: string;
  radius: { sm: number; md: number; lg: number; pill: number };
  font: {
    sans: string;
    serif: string;
    mono: string;
  };
};

export function buildTheme(mode: Mode, accent: AccentKey): Theme {
  const dark = mode === 'dark';
  const a = ACCENTS[accent];
  return {
    mode,
    bg: dark ? '#0a0a0c' : '#f7f7f8',
    surface: dark ? '#141418' : '#ffffff',
    surfaceMuted: dark ? '#1c1c22' : '#f1f1f3',
    surfaceSubtle: dark ? 'rgba(20,20,24,0.5)' : 'rgba(241,241,243,0.05)',
    border: dark ? '#26262d' : '#e5e5ea',
    borderStrong: dark ? '#3a3a44' : '#d4d4d8',
    text: dark ? '#f4f4f5' : '#0a0a0c',
    textMuted: dark ? '#a1a1aa' : '#71717a',
    textFaint: dark ? '#71717a' : '#a1a1aa',
    accent: a.base,
    accentSoft: dark ? a.softDark : a.softLight,
    accentBorder: a.border,
    warning: '#f59e0b',
    warningSoft: dark ? '#451a03' : '#fef3c7',
    warningBorder: dark ? '#92400e' : '#fcd34d',
    success: '#10b981',
    danger: '#ef4444',
    radius: { sm: 8, md: 12, lg: 16, pill: 999 },
    font: {
      sans: Platform.select({
        ios: 'system-ui',
        android: 'normal',
        web: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        default: 'normal',
      })!,
      serif: Platform.select({
        ios: 'Georgia',
        android: 'serif',
        web: "Georgia, 'Times New Roman', serif",
        default: 'serif',
      })!,
      mono: Platform.select({
        ios: 'Menlo',
        android: 'monospace',
        web: "SFMono-Regular, Menlo, Consolas, monospace",
        default: 'monospace',
      })!,
    },
  };
}
