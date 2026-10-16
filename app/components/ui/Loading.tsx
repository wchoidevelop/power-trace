import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function Loading({ label }: { label: string }) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.row}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
      <Text style={[styles.label, { color: t.textMuted, fontFamily: t.font.sans }]}>{label}…</Text>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const { theme: t } = useTheme();
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity]);

  return <Animated.View style={[styles.dot, { backgroundColor: t.textMuted, opacity }]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  label: { fontSize: 13, marginLeft: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
