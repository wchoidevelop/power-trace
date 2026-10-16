import { View, Text } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider'; // adjust path to your ThemeProvider
import { AdjustedRoleType, POWER_BASES } from '@/lib/analyzer/prompts';

/** The eight power_profile keys, as something readable. */
const PROFILE_LABELS: Record<string, string> = {
  positional: 'Positional — formal authority leads',
  resource_controller: 'Resource controller — controls what others get',
  enforcer: 'Enforcer — can impose costs',
  expert_authority: 'Expert authority — trusted judgment',
  social_hub: 'Social hub — others identify with them',
  gatekeeper: 'Gatekeeper — controls what reaches whom',
  figurehead: 'Figurehead — title without traction',
  diffuse: 'Diffuse — no single base stands out',
};

type Props = {
  role: AdjustedRoleType['adjusted_roles'][0];
  /** id → position name, so an internal exposure shows a name and not an id */
  nameById?: Record<string, string>;
  isUser?: boolean;
};

export default function RoleDetail({ role, nameById = {}, isUser = false }: Props) {
  const { theme } = useTheme();

  const exposure = role.most_exposed_to;
  const exposureName =
    exposure.kind === 'none'
      ? 'No single dominant exposure'
      : exposure.kind === 'internal' && exposure.target_id
        ? nameById[exposure.target_id] ?? exposure.label
        : `${exposure.label} (external)`;

  // only bases that actually moved during adjustment are worth the line
  const moved = role.deltas
    ? POWER_BASES.filter((b) => role.deltas![b] !== 0)
        .map((b) => `${b} ${role.deltas![b] > 0 ? '+' : '−'}${Math.abs(role.deltas![b])}`)
    : [];

  const Label = ({ children }: { children: string }) => (
    <Text
      style={{
        fontSize: 11,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: theme.textFaint,
        fontFamily: theme.font.sans,
        marginBottom: 2,
      }}>
      {children}
    </Text>
  );
 
  const Value = ({ children, mono }: { children: string; mono?: boolean }) => (
    <Text
      style={{
        fontSize: 14,
        color: theme.text,
        fontFamily: mono ? theme.font.mono : theme.font.sans,
        marginBottom: 12,
      }}>
      {children}
    </Text>
  );
 
  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      {/* title + (you) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '500',
            color: theme.text,
            fontFamily: theme.font.sans,
          }}>
          {role.position}
        </Text>
        {isUser && (
          <Text style={{ fontSize: 12, color: theme.accent, fontFamily: theme.font.sans }}>
            (you)
          </Text>
        )}
      </View>
 
      {/* profile subtitle */}
      <Text
        style={{
          fontSize: 13,
          color: theme.textMuted,
          fontFamily: theme.font.sans,
          marginBottom: 12,
        }}>
        {PROFILE_LABELS[role.power_profile] ?? role.power_profile}
      </Text>
 
      <Label>power index</Label>
      <Value mono>{`${role.power_index.toFixed(1)} / 10`}</Value>
 
      <Label>most exposed to</Label>
      <Value>{exposureName}</Value>
      {exposure.kind !== 'none' && exposure.basis ? (
        <Text
          style={{
            fontSize: 13,
            color: theme.textMuted,
            fontFamily: theme.font.sans,
            marginTop: -8,
            marginBottom: 12,
          }}>
          {exposure.basis}
        </Text>
      ) : null}

      {moved.length ? (
        <>
          <Label>moved from initial</Label>
          <Value mono>{moved.join(', ')}</Value>
        </>
      ) : null}
 
      {role.adjustment_notes ? (
        <>
          <Label>adjustment</Label>
          <Text
            style={{
              fontSize: 14,
              color: theme.text,
              fontFamily: theme.font.sans,
            }}>
            {role.adjustment_notes}
          </Text>
        </>
      ) : null}
    </View>
  );
}