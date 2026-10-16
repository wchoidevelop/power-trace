import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Props = ViewProps & {
  heading: string;
  caption?: string;
  badge?: string;
};

export function Section({ heading, caption, badge, children, style, ...rest }: Props) {
  const { theme: t } = useTheme();
  return (
    <View style={[styles.root, style]} {...rest}>
      {badge && (
        <Text
          style={[
            styles.badge,
            { color: t.accent, backgroundColor: t.accentSoft, fontFamily: t.font.sans },
          ]}
        >
          {badge}
        </Text>
      )}
      <Text style={[styles.heading, { color: t.text, fontFamily: t.font.sans }]}>{heading}</Text>
      {caption ? (
        <Text style={[styles.caption, { color: t.textMuted, fontFamily: t.font.sans }]}>
          {caption}
        </Text>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    letterSpacing: 1.1,
    fontWeight: '700',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  caption: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  body: { gap: 16, marginTop: 4 },
});
