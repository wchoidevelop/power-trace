import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  fullWidth?: boolean;
};

export function Button({ label, variant = 'primary', disabled, fullWidth, onPress, ...rest }: Props) {
  const { theme: t } = useTheme();

  const styles = (() => {
    switch (variant) {
      case 'accent':
        return { bg: t.accent, fg: '#ffffff', border: t.accent };
      case 'secondary':
        return { bg: 'transparent', fg: t.text, border: t.borderStrong };
      case 'danger': 
        return { bg: 'transparent', fg: t.danger, border: t.borderStrong };
      case 'ghost':
        return { bg: 'transparent', fg: t.textMuted, border: t.border };
      case 'primary':
      default:
        return { bg: t.text, fg: t.bg, border: t.text };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        baseStyles.btn,
        {
          backgroundColor: styles.bg,
          borderColor: styles.border,
          borderWidth: 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          borderRadius: t.radius.md,
        },
      ]}
      {...rest}
    >
      <Text style={[baseStyles.label, { color: styles.fg, fontFamily: t.font.sans }]}>{label}</Text>
    </Pressable>
  );
}

const baseStyles = StyleSheet.create({
  btn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '600' },
});
