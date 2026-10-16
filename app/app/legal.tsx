import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { Logo } from '@/components/ui/Logo';
import { Loading } from '@/components/ui/Loading';
import { ErrorRetry } from '@/components/ui/ErrorRetry';
import { api, apiErrorMessage, isRetryable, type LegalDoc, type LegalDocSlug, type LegalResponse } from '@/lib/api';

const TABS: { slug: LegalDocSlug; label: string }[] = [
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'terms', label: 'Terms' },
];

/**
 * Privacy policy and terms, fetched from the server rather than bundled, so the
 * text a user reads is the current one and not whatever shipped with their build.
 * Both documents arrive in a single request, which makes switching tabs instant.
 */
export default function LegalScreen() {
  const { theme: t } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ doc?: string }>();

  const initial: LegalDocSlug = params.doc === 'terms' ? 'terms' : 'privacy';
  const [active, setActive] = useState<LegalDocSlug>(initial);
  const [data, setData] = useState<LegalResponse | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.legal());
    } catch (err) {
      setError({ message: apiErrorMessage(err), retryable: isRetryable(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doc: LegalDoc | undefined = data?.docs.find((d) => d.slug === active);
  const webUrl = data?.web?.[active];

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

      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const on = tab.slug === active;
          return (
            <Pressable key={tab.slug} onPress={() => setActive(tab.slug)} hitSlop={6}>
              {({ pressed }) => (
                <View
                  style={[
                    styles.tab,
                    {
                      backgroundColor: on ? t.accent : t.surface,
                      borderColor: on ? t.accent : t.border,
                      borderRadius: t.radius.pill,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: on ? '#ffffff' : t.textMuted, fontFamily: t.font.sans },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {loading && <Loading label="Loading" />}

        {error && !loading && (
          <ErrorRetry
            error={{ ...error, onRetry: () => void load() }}
            title="Could not load this document"
          />
        )}

        {doc && !loading && (
          <>
            <View>
              <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>
                {doc.title}
              </Text>
              <Text style={[styles.meta, { color: t.textFaint, fontFamily: t.font.mono }]}>
                Effective {doc.effective} · v{doc.version}
              </Text>
            </View>

            <View
              style={[
                styles.summary,
                { borderColor: t.accentBorder, backgroundColor: t.accentSoft, borderRadius: t.radius.md },
              ]}
            >
              <Text style={[styles.summaryText, { color: t.text, fontFamily: t.font.sans }]}>
                {doc.summary}
              </Text>
            </View>

            {doc.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={[styles.heading, { color: t.text, fontFamily: t.font.sans }]}>
                  {section.heading}
                </Text>
                {section.body.map((paragraph, i) => (
                  <Text
                    key={i}
                    style={[styles.body, { color: t.textMuted, fontFamily: t.font.sans }]}
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}

            {/* the hosted copy is canonical — useful for sharing or printing */}
            {webUrl && !webUrl.includes('TODO') && (
              <Pressable onPress={() => Linking.openURL(webUrl)} hitSlop={6}>
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.webLink,
                      { color: t.accent, fontFamily: t.font.sans, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    Open this page on the web ↗
                  </Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  tab: { borderWidth: 1, paddingVertical: 7, paddingHorizontal: 16 },
  tabText: { fontSize: 13, fontWeight: '600' },

  scroll: { paddingHorizontal: 20, paddingBottom: 60, gap: 20 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  meta: { fontSize: 11, marginTop: 4 },

  summary: { borderWidth: 1, padding: 14 },
  summaryText: { fontSize: 14, lineHeight: 21 },

  section: { gap: 6 },
  heading: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 14.5, lineHeight: 22 },

  webLink: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
