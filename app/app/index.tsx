import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Grid } from '@/components/ui/Grid';
import { InfoCard } from '@/components/ui/InfoCard';
import { Logo } from '@/components/ui/Logo';
import { SectorExample } from '@/components/ui/SectorExample';
import { SLIDES } from '@/constants/intro';
import { DIMENSIONS, TINT } from '@/constants/dimensions';

export default function IntroScreen() {
  const { theme: t } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);

  // one shared value drives every animation on this screen, so a swipe and a
  // button press travel the exact same path
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(i, SLIDES.length - 1));
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  // page width feeds every offset, so a web window resize would otherwise leave
  // the carousel parked between two slides
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: index * width, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const startAnalysis = () => router.push('/analyze');
  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.push('/about')} hitSlop={10}>
          {({ pressed }) => (
            <Text
              style={[
                styles.topLink,
                { color: t.textMuted, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              About
            </Text>
          )}
        </Pressable>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.scroll}
      >
        {SLIDES.map((slide, i) => (
          <Slide key={slide.key} slide={slide} index={i} x={x} width={width} active={i === index} />
        ))}
      </Animated.ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} index={i} x={x} width={width} tone={s.tone} />
          ))}
        </View>

        <View style={styles.actions}>
          {isLast ? (
            <>
              <Button label="Back" variant="ghost" onPress={() => goTo(index - 1)} />
              <View style={{ flex: 1 }}>
                <Button label="Start analysis →" variant="accent" fullWidth onPress={startAnalysis} />
              </View>
            </>
          ) : (
            <>
              <Button label="Skip" variant="ghost" onPress={startAnalysis} />
              <View style={{ flex: 1 }}>
                <Button label="Next" variant="primary" fullWidth onPress={() => goTo(index + 1)} />
              </View>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── one slide ───────────────────────────────────────────────────────────────

function Slide({
  slide,
  index,
  x,
  width,
  active,
}: {
  slide: (typeof SLIDES)[number];
  index: number;
  x: SharedValue<number>;
  width: number;
  /** true when this is the slide currently on screen — drives the entrance */
  active: boolean;
}) {
  const { theme: t } = useTheme();
  const hero = !!slide.spectrum;
  const points = slide.points ?? [];
  const example = slide.key === 'data'; // the data slide carries a mock readout

  // total number of staggered blocks, so the entrance always spans ~2.5s no
  // matter how many cards a slide has
  const count = (hero ? 2 : 0) + 1 + points.length + (example ? 1 : 0) + (slide.footnote ? 1 : 0);
  let order = 0;
  const step = (depth: number) => ({
    index,
    x,
    width,
    depth,
    order: order++,
    count,
    active,
  });

  // called at its JSX position so card `order` follows the text/spectrum above it
  const renderCards = () =>
    points.map((p) => (
      <ParallaxItem key={p.label} {...step(1)}>
        <InfoCard tone={p.tone ?? slide.tone} label={p.label} text={p.text} badge={p.badge} icon={p.icon} />
      </ParallaxItem>
    ));

  return (
    // a slide can outgrow a short phone, so each one scrolls vertically inside
    // the horizontal pager rather than clipping
    <ScrollView
      style={{ width }}
      contentContainerStyle={styles.slide}
      showsVerticalScrollIndicator={false}
    >
      {hero && (
        <ParallaxItem {...step(0)}>
          <SpinningLogo size={152} tone={slide.tone} />
        </ParallaxItem>
      )}

      <ParallaxItem {...step(0)}>
        <View style={hero ? styles.heroTextBlock : undefined}>
          <View style={[styles.eyebrowRow, hero && styles.eyebrowRowCenter]}>
            <View style={[styles.eyebrowRule, { backgroundColor: slide.tone }]} />
            <Text style={[styles.eyebrow, { color: slide.tone, fontFamily: t.font.sans }]}>
              {slide.eyebrow}
            </Text>
            {hero && <View style={[styles.eyebrowRule, { backgroundColor: slide.tone }]} />}
          </View>
          <Text style={[hero ? styles.titleHero : styles.title, { color: t.text, fontFamily: t.font.sans }]}>
            {slide.title}
          </Text>
          {slide.subtitle && <Text style={[hero ? styles.subtitleHero : styles.subtitle, { color: t.accent, fontFamily: t.font.sans }]}>
            {slide.subtitle}
          </Text>}
          <Text style={[hero ? styles.bodyHero : styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>
            {slide.body}
          </Text>
        </View>
      </ParallaxItem>

      {hero && (
        <ParallaxItem {...step(1)}>
          <Spectrum />
        </ParallaxItem>
      )}

      {/* framework → two even columns; method → single column; data → wide pair */}
      {points.length > 0 &&
        (slide.key === 'method' ? (
          <View style={[styles.grid, styles.column]}>{renderCards()}</View>
        ) : (
          <Grid minColumnWidth={slide.key === 'framework' ? 150 : 210} style={styles.grid}>
            {renderCards()}
          </Grid>
        ))}

      {example && (
        <ParallaxItem {...step(2)}>
          <SectorExample tone={slide.tone} />
        </ParallaxItem>
      )}

      {slide.footnote && (
        <ParallaxItem {...step(2)}>
          <Text style={[hero ? styles.footnoteHero : styles.footnote, { color: t.textFaint, fontFamily: t.font.sans }]}>
            {slide.footnote}
          </Text>
        </ParallaxItem>
      )}
    </ScrollView>
  );
}

/**
 * The mark, turning slowly. One revolution every 24 seconds — the shape has
 * three- and six-fold symmetry, so a fast spin just reads as a flicker, while a
 * slow one reads as something alive. Honours the OS reduce-motion setting.
 */
function SpinningLogo({ size, tone }: { size: number; tone: string }) {
  const turn = useSharedValue(0);

  useEffect(() => {
    turn.value = withRepeat(
      withTiming(1, { duration: 24000, easing: Easing.linear, reduceMotion: ReduceMotion.System }),
      -1,
      false,
    );
  }, [turn]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  return (
    <Animated.View style={[styles.heroLogo, style]}>
      <Logo size={size} color={tone} />
    </Animated.View>
  );
}

/** The six bases as a colour bar plus an even grid of tabs — introduces the
 *  palette the rest of the app uses. */
function Spectrum() {
  const { theme: t } = useTheme();
  return (
    <View style={styles.spectrumWrap}>
      <View style={styles.spectrum}>
        {DIMENSIONS.map((d) => (
          <View key={d.key} style={[styles.spectrumBar, { backgroundColor: d.tone }]} />
        ))}
      </View>
      <Grid minColumnWidth={140} gap={8} style={styles.spectrumGrid}>
        {DIMENSIONS.map((d) => (
          <View
            key={d.key}
            style={[
              styles.spectrumChip,
              { backgroundColor: d.tone + TINT.wash, borderColor: d.tone + TINT.line, borderRadius: t.radius.pill },
            ]}
          >
            <View style={[styles.spectrumDot, { backgroundColor: d.tone }]} />
            <Text style={[styles.spectrumText, { color: t.text, fontFamily: t.font.sans }]} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        ))}
      </Grid>
    </View>
  );
}

/**
 * Fades and drifts its children as the slide crosses the viewport. `depth` makes
 * items further down the slide travel further, which reads as a stagger without
 * needing any timers — the whole effect is driven by scroll position, so it
 * tracks a half-finished swipe as faithfully as a completed one.
 */
// spans the whole staggered entrance across ~2.5s regardless of item count:
// starts are spread over ENTER_WINDOW, each item takes ENTER_DUR
const ENTER_BASE = 80;
const ENTER_WINDOW = 1650;
const ENTER_DUR = 760;

function ParallaxItem({
  index,
  x,
  width,
  depth,
  order = 0,
  count = 1,
  active,
  children,
}: {
  index: number;
  x: SharedValue<number>;
  width: number;
  depth: number;
  /** position in the slide, top to bottom — used to stagger the entrance */
  order?: number;
  /** number of staggered items on the slide, so the spread fills ~2.5s */
  count?: number;
  /** replays the entrance each time the slide becomes the active page */
  active?: boolean;
  children: React.ReactNode;
}) {
  // the first block is pure parallax: it tracks the finger during a drag and is
  // never hidden, so the header of an incoming page moves in with the swipe. The
  // rest stay hidden and stagger in once the page settles.
  const lead = order === 0;

  // rises and fades each non-lead item in, staggered by `order`; replays on every
  // page change. Multiplied on top of the parallax so the two never fight.
  const enter = useSharedValue(lead ? 1 : 0);
  useEffect(() => {
    if (lead || !active) return;
    const stepMs = count > 1 ? ENTER_WINDOW / (count - 1) : 0;
    enter.value = 0;
    enter.value = withDelay(
      ENTER_BASE + order * stepMs,
      withTiming(1, { duration: ENTER_DUR, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [lead, active, enter, order, count]);

  // once a non-lead item is fully offscreen, snap it back to hidden so the next
  // time it re-enters it starts from 0 — this is what stops a revisited page from
  // flashing fully-loaded before its entrance replays. Resetting here (not when
  // merely inactive) leaves the exit animation intact.
  useAnimatedReaction(
    () => Math.abs((x.value - index * width) / width),
    (p, prev) => {
      if (lead) return;
      if (p > 0.9 && (prev === null || prev <= 0.9)) enter.value = 0;
    },
  );

  const style = useAnimatedStyle(() => {
    const pos = (x.value - index * width) / width; // -1 offscreen left … 0 centred … 1 offscreen right
    const drift = 28 + depth * 26;
    return {
      opacity: interpolate(Math.abs(pos), [0, 0.75], [1, 0], Extrapolation.CLAMP) * enter.value,
      transform: [
        { translateX: interpolate(pos, [-1, 0, 1], [drift, 0, -drift], Extrapolation.CLAMP) },
        { translateY: (1 - enter.value) * 20 },
        { scale: interpolate(Math.abs(pos), [0, 1], [1, 0.94], Extrapolation.CLAMP) },
      ],
    };
  });

  return <Animated.View style={style}>{children}</Animated.View>;
}

// ── page indicator ──────────────────────────────────────────────────────────

function Dot({
  index,
  x,
  width,
  tone,
}: {
  index: number;
  x: SharedValue<number>;
  width: number;
  tone: string;
}) {
  const style = useAnimatedStyle(() => {
    const pos = Math.abs((x.value - index * width) / width);
    return {
      width: interpolate(pos, [0, 1], [24, 6], Extrapolation.CLAMP),
      opacity: interpolate(pos, [0, 1], [1, 0.3], Extrapolation.CLAMP),
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: tone }, style]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  topLink: { fontSize: 14, fontWeight: '600' },

  heroLogo: { alignSelf: 'center', marginBottom: 26 },

  scroll: { flex: 1 },
  slide: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24, gap: 4, flexGrow: 1, justifyContent: 'center' },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowRowCenter: { justifyContent: 'center' },
  eyebrowRule: { width: 18, height: 2, borderRadius: 1 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8, marginTop: 8 },
  subtitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.8, marginTop: 8 },
  body: { fontSize: 15, lineHeight: 23, marginTop: 10 },

  // hero (first slide) — big, centered mark and title; quieter body
  heroTextBlock: { alignItems: 'center' },
  titleHero: { fontSize: 42, fontWeight: '800', letterSpacing: -1, textAlign: 'center', marginTop: 12 },
  subtitleHero: { fontSize: 20, fontWeight: '700', letterSpacing: -1, textAlign: 'center', marginTop: 12 },
  bodyHero: { fontSize: 14, lineHeight: 21, marginTop: 12, textAlign: 'center', maxWidth: 460 },
  footnoteHero: { fontSize: 12, lineHeight: 17, marginTop: 22, fontStyle: 'italic', textAlign: 'center' },

  grid: { marginTop: 18 },
  column: { gap: 10 },

  spectrumWrap: { marginTop: 28, gap: 14, alignSelf: 'stretch' },
  spectrum: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  spectrumBar: { flex: 1 },
  spectrumGrid: { marginTop: 2 },
  spectrumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 7,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  spectrumDot: { width: 7, height: 7, borderRadius: 3.5 },
  spectrumText: { fontSize: 12.5, fontWeight: '600' },

  footnote: { fontSize: 12, lineHeight: 17, marginTop: 18, fontStyle: 'italic' },

  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12, gap: 16 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 8 },
  dot: { height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
