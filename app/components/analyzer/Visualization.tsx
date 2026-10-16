import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { PowerMap } from './PowerMap';
import { AdjustedRoleType } from '@/lib/analyzer/prompts';
import { useState } from 'react';
import RoleDetail from './RoleDetail';

export function Visualization({
  roles,
  onReset,
  userRoleId,
}: {
  roles: Partial<AdjustedRoleType>;
  onReset: () => void;
  userRoleId?: string;
}) {
  const { theme: t } = useTheme();
  const [click, setClick] = useState('');
  const adjusted = roles.adjusted_roles ?? [];
  // open on the user's own role until they tap another
  const clicked =
    adjusted.find((r) => r.id == click) ?? adjusted.find((r) => r.id === userRoleId) ?? adjusted[0];

  if (!clicked) {
    return (
      <Section heading="Power map" caption="No roles available.">
        <Text style={{ color: t.textMuted, fontFamily: t.font.sans }}>
          Run the analyzer to populate the map.
        </Text>
        <Button label="Start over" variant="secondary" onPress={onReset} />
      </Section>
    );
  }

  const fullRoles: AdjustedRoleType = {
    adjusted_roles: adjusted,
    bias_flags: roles.bias_flags ?? [],
    confidence: roles.confidence ?? 'medium',
    confidence_rationale: roles.confidence_rationale ?? '',
  };

  // exposures point at role ids; the detail card needs names
  const nameById = Object.fromEntries(adjusted.map((r) => [r.id, r.position]));

  return (
    <Section
      heading="Power map"
      caption="Vertical: informal/relational power. Horizontal: formal/structural power. Node size: power index. Arrows point from a role to the role most exposed to it."
    >
      <PowerMap roles={fullRoles} clicked={clicked.id} onClick={setClick} userRoleId={userRoleId} />

      <RoleDetail role={clicked} nameById={nameById} isUser={clicked.id === userRoleId} />

      <View style={{ marginTop: 8 }}>
        <Button label="Start over" variant="secondary" onPress={onReset} />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  subheading: { fontSize: 14, fontWeight: '600', marginTop: 4 },
});
