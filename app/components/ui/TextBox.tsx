import { StyleSheet, Text, View, TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function TextBox({
  label,
  lines,
  placeholder,
  subLabel,
  value,
  onChangeText,
  ...props
}: {
  label?: string;
  placeholder?: string;
  lines?: number;
  subLabel?: string;
  value: string;
  onChangeText: (text: string) => void;
} & TextInputProps) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.box}>
      {label && <Text style={[styles.label, { color: t.text, fontFamily: t.font.serif }]}>
        {label}
      </Text>}
      {subLabel && (
        <Text style={[styles.subLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          {subLabel}
        </Text>
      )}
      <TextInput
        style={[
          styles.textBox,
          {
            borderColor: t.border,
            color: t.text,
            fontFamily: t.font.sans,
            backgroundColor: t.surfaceSubtle, // use theme surface instead of hardcoded black
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        numberOfLines={lines}
        multiline={!!lines && lines > 1}
        placeholderTextColor={t.textMuted}
        placeholder={placeholder}
        textAlignVertical={lines && lines > 1 ? 'top' : 'center'}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '400',
    marginBottom: 2,
  },
  textBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
  },
});