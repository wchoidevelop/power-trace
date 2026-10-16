import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { theme: t } = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, borderRadius: t.radius.md }]}>
      <Pressable onPress={toggle} style={styles.header} hitSlop={8}>
        <Text style={[styles.title, { color: t.text, fontFamily: t.font.sans }]}>{title}</Text>
        <Text style={[styles.chevron, { color: t.textMuted }]}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '600' },
  chevron: { fontSize: 14, fontWeight: '700' },
  body: { marginTop: 10, gap: 10 },
});
