import { StyleSheet, Text, View, TextInput, TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function TextLine({
  label,
  subLabel,
  value,
  onChangeText,
  placeholder,
  ...props
}: {
  label?: string;
  subLabel?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
} & TextInputProps) {
  const { theme: t } = useTheme();
  return (
    <View style={styles.box}>
      {label && <Text style={[styles.label, { color: t.text, fontFamily: t.font.serif }]}>
        {label}
      </Text> }
      {subLabel && (
        <Text style={[styles.subLabel, { color: t.textMuted, fontFamily: t.font.sans }]}>
          {subLabel}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: t.borderStrong,
            color: t.text,
            fontFamily: t.font.sans,
            backgroundColor: t.surfaceSubtle,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        multiline={false}
        returnKeyType="done"
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4, flex: 1 },
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
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 15,
  },
});