import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { TextBox } from '../ui/TextBox';

const KINDS = [
  { paid: true, label: 'Paid job', hint: 'Employment — includes labor-market data' },
  { paid: false, label: 'Unpaid', hint: 'Club, church, volunteer group, online community' },
];

export function OrgStep({
  value,
  onChange,
  onSetPaid,
  onNext,
  readOnly,
}: {
  value: {org: string; role: string; self: string; paid?: boolean};
  onChange: (id: string, v: string) => void;
  onSetPaid: (paid: boolean) => void;
  onNext: () => void;
  readOnly?: boolean;
}) {
  const { theme: t } = useTheme();
  const paid = value.paid !== false;

  return (
    <Section heading="Describe your organization and your role" caption="Industry, size, structure, stage.">
      {/* The power map works on any organization. The labor-market stage does
          not — it is built on federal employment statistics, which say nothing
          about an unpaid role. */}
      <View style={{ gap: 8 }}>
        <Text style={[styles.label, { color: t.textMuted, fontFamily: t.font.sans }]}>
          Is this paid work?
        </Text>
        <View style={styles.kinds}>
          {KINDS.map((k) => {
            const on = k.paid === paid;
            return (
              <Pressable
                key={k.label}
                disabled={readOnly}
                onPress={() => onSetPaid(k.paid)}
                style={{ flex: 1 }}
              >
                {({ pressed }) => (
                  <View
                    style={[
                      styles.kind,
                      {
                        backgroundColor: on ? t.accentSoft : t.surface,
                        borderColor: on ? t.accent : t.border,
                        borderRadius: t.radius.md,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindLabel,
                        { color: on ? t.accent : t.text, fontFamily: t.font.sans },
                      ]}
                    >
                      {k.label}
                    </Text>
                    <Text style={[styles.kindHint, { color: t.textFaint, fontFamily: t.font.sans }]}>
                      {k.hint}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextInput
        multiline
        editable={!readOnly}
        value={value.org}
        onChangeText={(text) => onChange('org', text)}
        placeholder="A 180-person Series-B SaaS company…"
        placeholderTextColor={t.textFaint}
        style={[
          styles.textarea,
          {
            color: t.text,
            backgroundColor: t.surface,
            borderColor: t.border,
            borderRadius: t.radius.md,
            fontFamily: t.font.sans,
          },
        ]}
      />
      <TextBox label="Role title"
        value={value.role}
        onChangeText={(text) => onChange('role', text)}
        placeholder="Software Developer I"
        lines={1}
        editable={!readOnly}
      />
      <TextBox label="What you do" subLabel="Describe in detail what your role does day-to-day."
        value={value.self}
        onChangeText={(text) => onChange('self', text)}
        placeholder="Entry level software dev focusing on frontend, using js..."
        lines={4}
        editable={!readOnly}
      />
      {!readOnly && (
        <Button label="Continue" variant="accent" onPress={onNext} disabled={!(value.org.trim() && value.role.trim() && value.self.trim())} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600' },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  kindLabel: { fontSize: 14, fontWeight: '700' },
  kindHint: { fontSize: 11, lineHeight: 15 },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
});
