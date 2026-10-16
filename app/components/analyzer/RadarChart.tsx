import { useMemo } from 'react';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider'; // adjust path to your ThemeProvider
import { AdjustedRoleType } from '@/lib/analyzer/prompts';
 
// ── types ──────────────────────────────────────────────
 
type Props = {
  scores: AdjustedRoleType['adjusted_roles'][0];
  /** 0-10 scale max. Default 10. */
  max?: number;
  size?: number;
  /** stroke + fill of the data polygon. Defaults to theme accent. */
  color?: string;
  /** optional second polygon (e.g. pre-adjustment scores) to overlay */
  compare?: AdjustedRoleType['adjusted_roles'][0];
  compareColor?: string;
  showLabels?: boolean;
};
 
const AXES: { key: keyof Props['scores']['scores']; label: string }[] = [
  { key: 'legitimate', label: 'Legitimate' },
  { key: 'reward', label: 'Reward' },
  { key: 'coercive', label: 'Coercive' },
  { key: 'expert', label: 'Expert' },
  { key: 'referent', label: 'Referent' },
  { key: 'informational', label: 'Informational' },
];
 
// ── component ──────────────────────────────────────────
 
export default function PowerRadar({
  scores,
  max = 10,
  size = 220,
  color,
  compare,
  compareColor,
  showLabels = true,
}: Props) {
  const { theme } = useTheme();
 
  const dataColor = color ?? theme.accent;
  const cmpColor = compareColor ?? theme.textFaint;
 
  const c = size / 2;
  const R = size * 0.35; // leave room for labels
  const n = AXES.length;
 
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
 
  const point = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(max, value)) / max) * R;
    const a = angleFor(i);
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
 
  const toPolygon = (s: Props['scores']) =>
    AXES.map((ax, i) => {
      const p = point(i, s['scores'][ax.key].score);
      return `${p.x},${p.y}`;
    }).join(' ');
 
  const rings = useMemo(
    () =>
      [0.25, 0.5, 0.75, 1].map((f) =>
        AXES.map((_, i) => {
          const p = point(i, max * f);
          return `${p.x},${p.y}`;
        }).join(' '),
      ),
    [max, size],
  );
 
  const dataPoly = toPolygon(scores);
  const comparePoly = compare ? toPolygon(compare) : null;
 
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* grid rings */}
      {rings.map((pts, i) => (
        <Polygon key={`ring-${i}`} points={pts} fill="none" stroke={theme.border} />
      ))}
 
      {/* axis spokes */}
      {AXES.map((_, i) => {
        const end = point(i, max);
        return (
          <Line key={`spoke-${i}`} x1={c} y1={c} x2={end.x} y2={end.y} stroke={theme.border} />
        );
      })}
 
      {/* comparison polygon (under main) */}
      {comparePoly && (
        <Polygon
          points={comparePoly}
          fill={cmpColor}
          fillOpacity={0.12}
          stroke={cmpColor}
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      )}
 
      {/* main data polygon */}
      <Polygon
        points={dataPoly}
        fill={dataColor}
        fillOpacity={0.22}
        stroke={dataColor}
        strokeWidth={1.5}
      />
 
      {/* vertex dots */}
      {AXES.map((ax, i) => {
        const p = point(i, scores['scores'][ax.key].score);
        return <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.5} fill={dataColor} />;
      })}
 
      {/* axis labels */}
      {showLabels &&
        AXES.map((ax, i) => {
          const p = point(i, max * 1.18);
          return (
            <SvgText
              key={`lbl-${i}`}
              x={p.x}
              y={p.y}
              fill={theme.textMuted}
              fontSize={9}
              textAnchor="middle"
              alignmentBaseline="middle"
            >
              {ax.label}
            </SvgText>
          );
        })}
    </Svg>
  );
}
 