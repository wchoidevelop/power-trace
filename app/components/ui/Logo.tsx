import { useId } from 'react';
import Svg, { Circle, Defs, G, Line, Mask, Polygon, Rect } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The graph-node mark: a central node branching to three outer nodes, inside a
 * hexagon frame.
 *
 * Ported from assets/graph_node_white.svg rather than loaded as an image, for
 * one reason — the source is hardcoded #ffffff and would be invisible on the
 * light theme. As a component it takes the colour from the theme instead.
 *
 * The mask punches transparent holes at each node centre so the disks read as
 * rings. Its id has to be unique per instance: on web every mounted Svg shares
 * one DOM id namespace, so two logos with the same id would both resolve to the
 * first one's mask.
 */
export function Logo({ size = 32, color }: { size?: number; color?: string }) {
  const { theme: t } = useTheme();
  const tint = color ?? t.accent;
  const maskId = `logoHoles-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 400 400">
      <Defs>
        <Mask id={maskId}>
          <Rect x="0" y="0" width="400" height="400" fill="#ffffff" />
          <Circle cx={200} cy={200} r={13} fill="#000000" />
          <Circle cx={200} cy={95} r={13} fill="#000000" />
          <Circle cx={290.9} cy={252.5} r={13} fill="#000000" />
          <Circle cx={109.1} cy={252.5} r={13} fill="#000000" />
        </Mask>
      </Defs>

      <G fill={tint} stroke={tint} mask={`url(#${maskId})`}>
        {/* branches: central node to each outer node */}
        <G strokeWidth={20} strokeLinecap="round">
          <Line x1={200} y1={200} x2={200} y2={95} />
          <Line x1={200} y1={200} x2={290.9} y2={252.5} />
          <Line x1={200} y1={200} x2={109.1} y2={252.5} />
        </G>

        {/* equilateral triangle connecting the outer nodes */}
        <G strokeWidth={16} strokeLinejoin="round" fill="none">
          <Polygon points="200,95 290.9,252.5 109.1,252.5" />
        </G>

        {/* node disks */}
        <G stroke="none">
          <Circle cx={200} cy={200} r={27} />
          <Circle cx={200} cy={95} r={27} />
          <Circle cx={290.9} cy={252.5} r={27} />
          <Circle cx={109.1} cy={252.5} r={27} />
        </G>
      </G>

      <Polygon
        points="200,30 347.2,115 347.2,285 200,370 52.8,285 52.8,115"
        fill="none"
        stroke={tint}
        strokeWidth={9}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
