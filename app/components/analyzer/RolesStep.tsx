import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Role } from '@/lib/analyzer/types';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { TextLine } from '../ui/TextLine';
import { TextBox } from '../ui/TextBox';
import { SaveButton } from '../ui/SaveButton';

export function RolesStep({
  roles,
  addRole,
  updateRole,
  removeRole,
  onBack,
  onNext,
  onSaveSetup,
  readOnly,
}: {
  roles: Role[];
  addRole: () => void;
  updateRole: (id: string, p: Partial<Role>) => void;
  removeRole: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSaveSetup: () => Promise<unknown>;
  readOnly?: boolean;
}) {
  const { theme: t } = useTheme();
  const ready = roles.length > 0 && roles.every((r) => r.name.trim() && r.description.trim());

  return (
    <Section
      heading="List the roles to analyze"
      caption="We pre-loaded a sample org. Edit, remove, or add roles as needed."
    >
      <View style={{ gap: 12 }}>
        {roles.map((r) => (
          <View
            key={r.id}
            style={[
              styles.card,
              { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md },
            ]}
          >
            <View style={styles.header}>
              <TextLine placeholder='Role Title' value={r.name} onChangeText={(v) => updateRole(r.id, { name: v })} editable={!readOnly}/>
              {!r.isUserRole && !readOnly && (
                <Button label='Remove' variant='danger' fullWidth={false} onPress={() => removeRole(r.id)} />
              )}
            </View>
            <TextBox
              value={r.description}
              onChangeText={(v) => updateRole(r.id, { description: v })}
              placeholder="Responsibilities, reporting line, scope…"
              lines={10}
              editable={!readOnly}
              />
          </View>
        ))}
      </View>

      {!readOnly && (
        <Pressable
          onPress={addRole}
          style={({ pressed }) => [
            styles.addBtn,
            {
              borderColor: t.borderStrong,
              opacity: pressed ? 0.6 : 1,
              borderRadius: t.radius.sm,
            },
          ]}
        >
          <Text style={[styles.addText, { color: t.text, fontFamily: t.font.sans }]}>
            ＋  Add role
          </Text>
        </Pressable>
      )}

      {!readOnly && (
        <View style={styles.btnRow}>
          <Button label="Back" variant="secondary" onPress={onBack} />
          <View style={{ flex: 1 }} />
          <SaveButton label="Save setup" onSave={onSaveSetup} disabled={!ready} />
          <Button label="Run analysis →" variant="accent" onPress={onNext} disabled={!ready} />
        </View>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 14, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  removeText: { fontSize: 12, fontWeight: '500' },
  descInput: {
    minHeight: 64,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  addBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '500' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
});
