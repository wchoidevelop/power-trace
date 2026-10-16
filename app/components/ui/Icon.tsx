import Svg, { Circle, G, Line, Path, Polyline } from 'react-native-svg';

/**
 * Small line-art icon set, drawn from a shared 24×24 grid and stroked in a
 * caller-supplied tone. Used on the intro slides to give each power base and
 * each pipeline stage its own mark. Stroke-only (fill:none) so a single colour
 * reads on both themes; the target's centre is the one intentional fill.
 */
export type IconName =
  // French & Raven power bases
  | 'legitimate'
  | 'reward'
  | 'referent'
  | 'expert'
  | 'coercive'
  | 'informational'
  // pipeline stages
  | 'describe'
  | 'clarify'
  | 'audit'
  | 'diagnose';

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <G stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[name](color)}
      </G>
    </Svg>
  );
}

const GLYPHS: Record<IconName, (color: string) => React.ReactNode> = {
  // shield + check — authority granted by position
  legitimate: () => (
    <>
      <Path d="M12 2.5 L19.5 5.5 V11 C19.5 15.6 16.2 19 12 20.5 C7.8 19 4.5 15.6 4.5 11 V5.5 Z" />
      <Polyline points="9 11.6 11.2 13.7 15 9.3" />
    </>
  ),
  // medal — ability to grant recognition / benefit
  reward: () => (
    <>
      <Circle cx={12} cy={9.5} r={5} />
      <Polyline points="8.4 13.6 6.4 21 12 18.2 17.6 21 15.6 13.6" />
    </>
  ),
  // heart — identification, wanting to follow
  referent: () => (
    <Path d="M12 20 C12 20 3.5 14.6 3.5 8.7 C3.5 6 5.6 4.3 7.8 4.3 C9.6 4.3 11.2 5.5 12 6.8 C12.8 5.5 14.4 4.3 16.2 4.3 C18.4 4.3 20.5 6 20.5 8.7 C20.5 14.6 12 20 12 20 Z" />
  ),
  // lightbulb — irreplaceable knowledge / skill
  expert: () => (
    <>
      <Circle cx={12} cy={9} r={5.2} />
      <Line x1={9.4} y1={17} x2={14.6} y2={17} />
      <Line x1={10.2} y1={20} x2={13.8} y2={20} />
    </>
  ),
  // prohibition — ability to punish / exclude
  coercive: () => (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Line x1={6.3} y1={6.3} x2={17.7} y2={17.7} />
    </>
  ),
  // eye — control of what others know
  informational: () => (
    <>
      <Path d="M2.5 12 C4.6 7.5 8.2 5.5 12 5.5 C15.8 5.5 19.4 7.5 21.5 12 C19.4 16.5 15.8 18.5 12 18.5 C8.2 18.5 4.6 16.5 2.5 12 Z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  // pencil — describe your org
  describe: () => (
    <>
      <Path d="M3.2 20.8 L3.9 17 L15.5 5.4 C16.3 4.6 17.6 4.6 18.4 5.4 L18.6 5.6 C19.4 6.4 19.4 7.7 18.6 8.5 L7 20.1 L3.2 20.8 Z" />
      <Line x1={14.5} y1={6.4} x2={17.6} y2={9.5} />
    </>
  ),
  // sliders — score & clarify
  clarify: () => (
    <>
      <Line x1={4} y1={21} x2={4} y2={15} />
      <Line x1={4} y1={11} x2={4} y2={3} />
      <Line x1={12} y1={21} x2={12} y2={13} />
      <Line x1={12} y1={9} x2={12} y2={3} />
      <Line x1={20} y1={21} x2={20} y2={17} />
      <Line x1={20} y1={13} x2={20} y2={3} />
      <Line x1={1.6} y1={13} x2={6.4} y2={13} />
      <Line x1={9.6} y1={11} x2={14.4} y2={11} />
      <Line x1={17.6} y1={15} x2={22.4} y2={15} />
    </>
  ),
  // magnifier — bias audit
  audit: () => (
    <>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Line x1={15.4} y1={15.4} x2={21} y2={21} />
    </>
  ),
  // target — diagnose the situation
  diagnose: (color: string) => (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={4.2} />
      <Circle cx={12} cy={12} r={1.2} fill={color} stroke="none" />
    </>
  ),
};
