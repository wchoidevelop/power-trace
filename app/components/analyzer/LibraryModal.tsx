import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import {
  listSetups,
  listRuns,
  deleteSetup,
  deleteRun,
  formatDate,
  type SavedSetup,
  type SavedRun,
} from '@/lib/storage';

export function LibraryModal({
  visible,
  onClose,
  onLoadSetup,
  onLoadRun,
}: {
  visible: boolean;
  onClose: () => void;
  onLoadSetup: (s: SavedSetup) => void;
  onLoadRun: (r: SavedRun) => void;
}) {
  const { theme: t } = useTheme();
  const [setups, setSetups] = useState<SavedSetup[]>([]);
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [s, r] = await Promise.all([listSetups(), listRuns()]);
    setSetups(s);
    setRuns(r);
    setLoading(false);
  };

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  const removeSetup = async (id: string) => {
    await deleteSetup(id);
    setSetups((prev) => prev.filter((x) => x.id !== id));
  };
  const removeRun = async (id: string) => {
    await deleteRun(id);
    setRuns((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.backdrop, { backgroundColor: t.bg }]} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>Library</Text>
          <Button label="Close" variant="ghost" onPress={onClose} />
        </View>

        <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Section title="Past results" subtitle="Complete analysis runs you can reopen and review.">
            {runs.length === 0 ? (
              <Empty label={loading ? 'Loading…' : 'No saved results yet.'} />
            ) : (
              runs.map((r) => (
                <Card
                  key={r.id}
                  label={r.label}
                  date={formatDate(r.createdAt)}
                  subtitle={r.snapshot.orgSelfDescription.org}
                  onLoad={() => {
                    onLoadRun(r);
                    onClose();
                  }}
                  onDelete={() => removeRun(r.id)}
                />
              ))
            )}
          </Section>

          <Section title="Saved setups" subtitle="Org + roles templates you can load to start a new analysis.">
            {setups.length === 0 ? (
              <Empty label={loading ? 'Loading…' : 'No saved setups yet.'} />
            ) : (
              setups.map((s) => (
                <Card
                  key={s.id}
                  label={s.label}
                  date={formatDate(s.createdAt)}
                  subtitle={`${s.roles.length} role${s.roles.length === 1 ? '' : 's'} · ${s.orgSelfDescription.org}`}
                  onLoad={() => {
                    onLoadSetup(s);
                    onClose();
                  }}
                  onDelete={() => removeSetup(s.id)}
                />
              ))
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const { theme: t } = useTheme();
  return (
    <View style={{ gap: 8, marginBottom: 24 }}>
      <Text style={[styles.sectionTitle, { color: t.text, fontFamily: t.font.sans }]}>{title}</Text>
      <Text style={[styles.sectionSub, { color: t.textMuted, fontFamily: t.font.sans }]}>{subtitle}</Text>
      <View style={{ gap: 10, marginTop: 4 }}>{children}</View>
    </View>
  );
}

function Card({
  label,
  date,
  subtitle,
  onLoad,
  onDelete,
}: {
  label: string;
  date: string;
  subtitle?: string;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const { theme: t } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md }]}>
      <Text style={[styles.cardLabel, { color: t.text, fontFamily: t.font.sans }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.cardDate, { color: t.textFaint, fontFamily: t.font.mono }]}>{date}</Text>
      {subtitle ? (
        <Text style={[styles.cardSub, { color: t.textMuted, fontFamily: t.font.sans }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.cardBtns}>
        <Button label="Load" variant="accent" fullWidth={false} onPress={onLoad} />
        <Button label="Delete" variant="danger" fullWidth={false} onPress={onDelete} />
      </View>
    </View>
  );
}

function Empty({ label }: { label: string }) {
  const { theme: t } = useTheme();
  return (
    <Text style={[styles.empty, { color: t.textFaint, fontFamily: t.font.sans }]}>{label}</Text>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionSub: { fontSize: 13, lineHeight: 18 },
  card: { borderWidth: 1, padding: 14, gap: 4 },
  cardLabel: { fontSize: 15, fontWeight: '600' },
  cardDate: { fontSize: 11 },
  cardSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  empty: { fontSize: 13, fontStyle: 'italic' },
});
