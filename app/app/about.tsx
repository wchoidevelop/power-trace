import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Grid } from '@/components/ui/Grid';
import { InfoCard } from '@/components/ui/InfoCard';
import { Logo } from '@/components/ui/Logo';
import { CREATOR, SECTIONS, type AboutSection } from '@/constants/about';
import { DIMENSIONS, TINT } from '@/constants/dimensions';

// Sections fade up on mount, each one a beat behind the last.
const rise = (i: number) => FadeInDown.delay(60 * i).duration(420).springify().damping(18);

export default function AboutScreen() {
  const { theme: t } = useTheme();
  const router = useRouter();

  const links = CREATOR.links.filter((l) => !l.url.includes('TODO'));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          {({ pressed }) => (
            <Text
              style={[
                styles.backLink,
                { color: t.textMuted, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              ← Back
            </Text>
          )}
        </Pressable>
        <Logo size={28} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* creator */}
        <Animated.View entering={rise(0)}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: t.accent + TINT.wash,
                borderColor: t.accent + TINT.line,
                borderRadius: t.radius.lg,
              },
            ]}
          >
            <Text style={[styles.eyebrow, { color: t.accent, fontFamily: t.font.sans }]}>ABOUT</Text>
            <Text style={[styles.name, { color: t.text, fontFamily: t.font.sans }]}>
              {CREATOR.name}
            </Text>
            <Text style={[styles.affiliation, { color: t.accent, fontFamily: t.font.sans }]}>
              {CREATOR.affiliation}
            </Text>
            <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>
              {CREATOR.bio}
            </Text>

            {links.length > 0 && (
              <View style={styles.linkRow}>
                {links.map((l) => (
                  <Pressable key={l.label} onPress={() => Linking.openURL(l.url)} hitSlop={6}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.linkChip,
                          {
                            borderColor: t.accent + TINT.line,
                            backgroundColor: t.surface,
                            borderRadius: t.radius.pill,
                            opacity: pressed ? 0.6 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.linkText, { color: t.text, fontFamily: t.font.sans }]}>
                          {l.label}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {SECTIONS.map((s, i) => (
          <Animated.View key={s.key} entering={rise(i + 1)}>
            <SectionBlock section={s} />
          </Animated.View>
        ))}

        <Animated.View entering={rise(SECTIONS.length + 1)}>
          <Button
            label="Start an analysis →"
            variant="accent"
            fullWidth
            onPress={() => router.push('/analyze')}
          />
        </Animated.View>

        {/* Both documents live on the server; this screen only links to them. */}
        <Animated.View entering={rise(SECTIONS.length + 2)}>
          <View style={[styles.legalRow, { borderTopColor: t.border }]}>
            <Pressable onPress={() => router.push('/legal?doc=privacy')} hitSlop={8}>
              {({ pressed }) => (
                <Text
                  style={[
                    styles.legalLink,
                    { color: t.textMuted, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  Privacy Policy
                </Text>
              )}
            </Pressable>
            <Text style={[styles.legalLink, { color: t.textFaint, fontFamily: t.font.sans }]}>·</Text>
            <Pressable onPress={() => router.push('/legal?doc=terms')} hitSlop={8}>
              {({ pressed }) => (
                <Text
                  style={[
                    styles.legalLink,
                    { color: t.textMuted, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  Terms of Service
                </Text>
              )}
            </Pressable>
          </View>
          <Text style={[styles.legalNote, { color: t.textFaint, fontFamily: t.font.sans }]}>
            This tool is educational and is not legal, HR, or professional advice.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionBlock({ section }: { section: AboutSection }) {
  const { theme: t } = useTheme();

  return (
    <View style={styles.block}>
      <View style={styles.eyebrowRow}>
        <View style={[styles.eyebrowRule, { backgroundColor: section.tone }]} />
        <Text style={[styles.eyebrow, { color: section.tone, fontFamily: t.font.sans }]}>
          {section.eyebrow}
        </Text>
      </View>
      <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>{section.title}</Text>
      <Text style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}>{section.body}</Text>

      {/* the framework section shows the six bases themselves, each in its own hue */}
      {section.key === 'framework' && (
        <Grid minColumnWidth={200} style={styles.grid}>
          {DIMENSIONS.map((d) => (
            <InfoCard key={d.key} tone={d.tone} label={d.label} text={d.blurb} />
          ))}
        </Grid>
      )}

      {section.points && (
        <Grid minColumnWidth={230} style={styles.grid}>
          {section.points.map((p) => (
            <InfoCard key={p.label} tone={section.tone} label={p.label} text={p.text} badge={p.badge} />
          ))}
        </Grid>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backLink: { fontSize: 15, fontWeight: '600' },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, gap: 28 },
  block: { gap: 4 },
  grid: { marginTop: 12 },

  hero: { borderWidth: 1, padding: 18, gap: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '700' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowRule: { width: 16, height: 2, borderRadius: 1 },
  name: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  affiliation: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 23, marginTop: 6 },

  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  linkChip: { borderWidth: 1, paddingVertical: 7, paddingHorizontal: 14 },
  linkText: { fontSize: 13, fontWeight: '600' },

  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 18,
  },
  legalLink: { fontSize: 13, fontWeight: '600' },
  legalNote: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
