import { StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import Svg, { Circle, G, Line, Polygon } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';
import { AdjustedRoleType } from '@/lib/analyzer/prompts';

const W = 320;
const H = 320;
const PAD = 36;
const ARROW = 7;
/** Clear space between two nodes — enough that an exposure arrow still fits. */
const NODE_GAP = ARROW + 6;
const LABEL_H = 14;
const LABEL_MAX_W = 120;

type Rect = { l: number; t: number; r: number; b: number };
type Placed = { id: string; x: number; y: number; radius: number };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

/**
 * Push overlapping nodes apart until none touch. Roles with similar sums land on
 * the same pixel, and a stacked node is an unreadable, untappable one. Each node
 * moves only as far as it has to; the caller draws a leader back to the true
 * position, so the nudge never misreports a score.
 */
function separate<T extends Placed>(nodes: T[]): T[] {
  const ps = nodes.map((n) => ({ ...n }));
  for (let iter = 0; iter < 80; iter++) {
    let overlapped = false;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const min = a.radius + b.radius + NODE_GAP;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        overlapped = true;
        if (d < 0.01) {
          // identical scores: fan out by golden angle so the result is deterministic
          dx = Math.cos(j * 2.39996);
          dy = Math.sin(j * 2.39996);
          d = 0;
        } else {
          dx /= d;
          dy /= d;
        }
        const push = (min - d) / 2;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
    for (const p of ps) {
      p.x = clamp(p.x, PAD, W - PAD);
      p.y = clamp(p.y, PAD, H - PAD);
    }
    if (!overlapped) break;
  }
  return ps;
}

/**
 * Put each label above or below its node, whichever collides less with labels
 * already placed and with other nodes. Top-down order keeps it deterministic.
 */
function placeLabels(nodes: (Placed & { text: string })[]) {
  const nodeRects = new Map<string, Rect>(
    nodes.map((n) => [n.id, { l: n.x - n.radius, t: n.y - n.radius, r: n.x + n.radius, b: n.y + n.radius }]),
  );
  const placed: Rect[] = [];
  const out = new Map<string, { left: number; top: number; width: number }>();

  for (const n of [...nodes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const width = Math.min(LABEL_MAX_W, n.text.length * 7 + 6);
    const left = clamp(n.x - width / 2, 2, W - 2 - width);
    const candidates = [n.y - n.radius - LABEL_H - 2, n.y + n.radius + 2].map((want) => {
      const top = clamp(want, 2, H - 2 - LABEL_H);
      const rect = { l: left, t: top, r: left + width, b: top + LABEL_H };
      let cost = Math.abs(top - want) * width;
      for (const p of placed) cost += overlapArea(rect, p) * 2;
      for (const [id, nr] of nodeRects) if (id !== n.id) cost += overlapArea(rect, nr);
      return { top, rect, cost };
    });
    // ties go to the first candidate, above the node
    const best = candidates[1].cost < candidates[0].cost ? candidates[1] : candidates[0];
    placed.push(best.rect);
    out.set(n.id, { left, top: best.top, width });
  }
  return out;
}

export function PowerMap({
  roles,
  clicked,
  onClick,
  userRoleId,
}: {
  roles: AdjustedRoleType;
  clicked: string;
  onClick: (id: string) => void;
  userRoleId?: string;
}) {
  const { theme: t } = useTheme();

  const project = (r: AdjustedRoleType['adjusted_roles'][0]) => {
    const x = PAD + ((r.scores.legitimate.score + r.scores.reward.score + r.scores.coercive.score) / 30) * (W - PAD * 2);
    const y = H - PAD - ((r.scores.expert.score + r.scores.informational.score + r.scores.referent.score) / 30) * (H - PAD * 2);
    // (trueX, trueY) is where the scores put the node; (x, y) is where it is drawn
    return { x, y, trueX: x, trueY: y, radius: 10 + (r.power_index / 10) * 14 };
  };

  const labelText = (r: { id: string; position: string }) =>
    r.id === userRoleId ? `${r.position} (you)` : r.position;

  const positioned = separate(roles.adjusted_roles.map((r) => ({ ...r, ...project(r) })));
  const byId = new Map(positioned.map((p) => [p.id, p]));
  const labels = placeLabels(positioned.map((p) => ({ ...p, text: labelText(p) })));

  // An exposure edge exists only when the source of exposure is another mapped
  // position. 'external' (a board, a client) and 'none' have no node to draw to,
  // and no exposure means no edge — never invent one.
  // Drawn holder → exposed: the arrow points at the role that can be hurt.
  const edges = positioned.flatMap((exposed) => {
    const holder = exposed.most_exposed_to.target_id ? byId.get(exposed.most_exposed_to.target_id) : undefined;
    if (!holder || holder.id === exposed.id) return [];

    const dx = exposed.x - holder.x;
    const dy = exposed.y - holder.y;
    const len = Math.hypot(dx, dy);
    // nodes overlapping or touching: there is no visible gap to draw an arrow in
    if (len <= holder.radius + exposed.radius + ARROW + 2) return [];

    const ux = dx / len;
    const uy = dy / len;
    const start = { x: holder.x + ux * (holder.radius + 2), y: holder.y + uy * (holder.radius + 2) };
    const tip = { x: exposed.x - ux * (exposed.radius + 2), y: exposed.y - uy * (exposed.radius + 2) };
    const base = { x: tip.x - ux * ARROW, y: tip.y - uy * ARROW };
    const px = -uy * (ARROW / 2);
    const py = ux * (ARROW / 2);
    return [{
      key: `${holder.id}>${exposed.id}`,
      start,
      base,
      head: `${tip.x},${tip.y} ${base.x + px},${base.y + py} ${base.x - px},${base.y - py}`,
    }];
  });

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: t.surface,
          borderColor: t.border,
          borderRadius: t.radius.md,
          width: W,
          height: H,
          alignSelf: 'center',
        },
      ]}
    >
      <View
        style={[styles.axisH, { left: PAD, right: PAD, bottom: PAD, backgroundColor: t.borderStrong }]}
      />
      <View
        style={[styles.axisV, { left: PAD, top: PAD, bottom: PAD, backgroundColor: t.borderStrong }]}
      />

      {[25, 50, 75].map((p) => {
        const x = PAD + ((W - PAD * 2) * p) / 100;
        const y = H - PAD - ((H - PAD * 2) * p) / 100;
        return (
          <View key={p}>
            <View
              style={[
                styles.gridV,
                { left: x, top: PAD, height: H - PAD * 2, backgroundColor: t.border },
              ]}
            />
            <View
              style={[
                styles.gridH,
                { top: y, left: PAD, width: W - PAD * 2, backgroundColor: t.border },
              ]}
            />
          </View>
        );
      })}

      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* leaders from each nudged node back to where its scores place it */}
        {positioned
          .filter((p) => Math.hypot(p.x - p.trueX, p.y - p.trueY) > 4)
          .map((p) => (
            <G key={`true-${p.id}`}>
              <Line
                x1={p.trueX}
                y1={p.trueY}
                x2={p.x}
                y2={p.y}
                stroke={t.textMuted}
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <Circle cx={p.trueX} cy={p.trueY} r={2} fill={t.textMuted} />
            </G>
          ))}
        {edges.map((e) => (
          <G key={e.key}>
            <Line
              x1={e.start.x}
              y1={e.start.y}
              x2={e.base.x}
              y2={e.base.y}
              stroke={t.borderStrong}
              strokeWidth={1.5}
            />
            <Polygon points={e.head} fill={t.borderStrong} />
          </G>
        ))}
      </Svg>

      <Text style={[styles.axisLabelH, { color: t.textMuted, fontFamily: t.font.sans }]}>
        Structural →
      </Text>
      <Text style={[styles.axisLabelV, { color: t.textMuted, fontFamily: t.font.sans }]}>
        Relational →
      </Text>
      {/* x is structural, y is relational: low-x/high-y is influence without a
          title, high-x/low-y is a title without influence */}
      <Text style={[styles.bottomLeft, { color: t.textMuted, fontFamily: t.font.sans }]}>
        exposed / periphery
      </Text>
      <Text style={[styles.bottomRight, { color: t.textMuted, fontFamily: t.font.sans }]}>
        hollow authority
      </Text>
      <Text style={[styles.topRight, { color: t.textMuted, fontFamily: t.font.sans }]}>
        high structural · high relational
      </Text>
      <Text style={[styles.topLeft, { color: t.textMuted, fontFamily: t.font.sans }]}>
        shadow power
      </Text>

      {positioned.map((p) => {
        const score = Math.round(Object.values(p.scores).reduce((acc, cur) => acc + cur.score,0) / Object.keys(p.scores).length);
        const selected = p.id === clicked;
        const isUser = p.id === userRoleId;
        const label = labels.get(p.id)!;
        return (
          <View key={p.id}>
            <TouchableHighlight
              style={{
                position: 'absolute',
                left: p.x - p.radius,
                top: p.y - p.radius,
                width: p.radius * 2,
                height: p.radius * 2,
                borderRadius: p.radius,
                backgroundColor: t.accent + 'CC',
                borderWidth: selected ? 3 : 1.5,
                borderColor: selected ? t.text : t.accentBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => onClick(p.id)}
            >
              <Text style={[styles.nodeScore, { fontFamily: t.font.mono }]}>{score}</Text>
            </TouchableHighlight>
            <Text
              style={[
                styles.nodeLabel,
                {
                  position: 'absolute',
                  left: label.left,
                  top: label.top,
                  width: label.width,
                  color: isUser ? t.accent : t.text,
                  fontFamily: t.font.sans,
                },
              ]}
              numberOfLines={1}
            >
              {labelText(p)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, position: 'relative', overflow: 'hidden' },
  axisH: { position: 'absolute', height: 1 },
  axisV: { position: 'absolute', width: 1 },
  gridH: { position: 'absolute', height: 1, opacity: 0.6 },
  gridV: { position: 'absolute', width: 1, opacity: 0.6 },
  axisLabelH: { position: 'absolute', bottom: 8, alignSelf: 'center', fontSize: 10, fontWeight: '500' },
  axisLabelV: {
    position: 'absolute',
    left: -10,
    top: '50%',
    fontSize: 10,
    fontWeight: '500',
    transform: [{ rotate: '-90deg' }],
  },
  topLeft: {
    position: 'absolute',
    top: 32,
    left: 10,
    fontSize: 10,
    fontWeight: '500'
  },
  topRight: {
    position: 'absolute',
    top: 32,
    right: 10,
    fontSize: 10,
    fontWeight: '500'
  },
  bottomRight: {
    position: 'absolute',
    bottom: 32,
    right: 10,
    fontSize: 10,
    fontWeight: '500'
  },
  bottomLeft: {
    position: 'absolute',
    bottom: 32,
    left: 10,
    fontSize: 10,
    fontWeight: '500'
  },
  nodeScore: { color: 'white', fontSize: 11, fontWeight: '700' },
  nodeLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
