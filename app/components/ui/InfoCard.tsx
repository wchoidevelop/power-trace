import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { TINT } from '@/constants/dimensions';
import { Icon, type IconName } from './Icon';

/**
 * A tinted card carrying one labelled idea.
 *
 * The tone colours the wash, the rule, and the badge — never the body copy.
 * Six saturated hues at readable contrast on both themes is not a fight worth
 * having, so the text stays on the theme's own foreground colours and the
 * colour does its work behind and beside it.
 */
export function InfoCard({
  tone,
  label,
  text,
  badge,
  icon,
}: {
  tone: string;
  label: string;
  text?: string;
  /** short marker shown in a tinted chip — a step number, usually */
  badge?: string;
  /** line icon shown in the tinted lead square; takes priority over badge */
  icon?: string;
}) {
  const { theme: t } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone + TINT.wash,
          borderColor: tone + TINT.line,
          borderRadius: t.radius.md,
        },
      ]}
    >
      <View style={[styles.rule, { backgroundColor: tone, borderTopLeftRadius: t.radius.md, borderBottomLeftRadius: t.radius.md }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          {icon ? (
            <View style={[styles.visual, { backgroundColor: tone + TINT.soft, borderRadius: t.radius.sm }]}>
              <Icon name={icon as IconName} color={tone} size={18} />
            </View>
          ) : badge ? (
            <View style={[styles.visual, { backgroundColor: tone + TINT.soft, borderRadius: t.radius.sm }]}>
              <Text style={[styles.badgeText, { color: tone, fontFamily: t.font.mono }]}>{badge}</Text>
            </View>
          ) : (
            <View style={[styles.dot, { backgroundColor: tone }]} />
          )}
          <Text style={[styles.label, { color: t.text, fontFamily: t.font.sans }]}>{label}</Text>
        </View>
        {text ? (
          <Text style={[styles.text, { color: t.textMuted, fontFamily: t.font.sans }]}>{text}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, flexDirection: 'row', overflow: 'hidden', minHeight: 64, flex: 1 },
  rule: { width: 3 },
  body: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  visual: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  text: { fontSize: 12.5, lineHeight: 18 },
});
