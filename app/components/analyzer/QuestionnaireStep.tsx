import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import type { Answer, Question, Scored, StepError } from '@/lib/analyzer/types';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { QuestionnaireType, ScoreType } from '@/lib/analyzer/prompts';
import { TextBox } from '../ui/TextBox';
import { Loading } from '../ui/Loading';
import { ErrorRetry } from '../ui/ErrorRetry';

export function QuestionnaireStep({
  scored,
  questions,
  answers,
  setAnswers,
  onSubmit,
  readOnly,
  error,
}: {
  scored: ScoreType[];
  questions: QuestionnaireType[] | undefined;
  answers: Record<string, string>;
  setAnswers: (a: Record<string, string>) => void;
  onSubmit: () => void;
  readOnly?: boolean;
  error?: StepError;
}) {
  const { theme: t } = useTheme();

  // targets are role IDS. Printing them raw shows the user "pos_04".
  const nameById = useMemo(
    () => Object.fromEntries(scored.map((s) => [s.id, s.position])),
    [scored],
  );
  const targetNames = (targets: string[]) =>
    targets.map((id) => nameById[id] ?? id).join(', ');

  // a failure here can come from generating the questions or, once they are
  // answered, from submitting them — keep the answers on screen in that case
  if (error && questions === undefined) {
    return (
      <Section heading="Clarify low-confidence roles" badge="LAYER 2B">
        <ErrorRetry error={error} title="Could not build the questionnaire" backLabel="Back to scoring" />
      </Section>
    );
  }

  if (questions === undefined) {
    return <Loading label="loading the questionnaire..." />
  }
  const allAnswered = questions.every((q) => answers[q.id]);
  if (questions.length === 0) {
    return (
      <Section heading="Questionnaire" caption="All roles scored with high confidence." badge="LAYER 2B">
        {!readOnly && <Button label="Continue →" variant="accent" onPress={onSubmit} />}
      </Section>
    );
  }

  return (
    <Section
      heading="Clarify low-confidence roles"
      caption="We generated targeted questions for roles where the model wasn't confident. Your answers refine the scoring."
      badge="LAYER 2B"
    >
      <View style={{ gap: 14 }}>
        {
          questions.map(q => (
            <View
              style={[
              styles.group,
              {
                backgroundColor: t.warningSoft,
                borderColor: t.warningBorder,
                borderRadius: t.radius.md,
              },
            ]}>
              <View style={{}}>
                <Text style={[styles.roleName, { color: t.text, fontFamily: t.font.sans }]}>{targetNames(q.targets)}</Text>
                <Text style={[styles.confTag, { color: t.warning, fontFamily: t.font.mono }]}>
                  {q.resolves.join(', ')}
                </Text>
              </View>
              <View key={q.id} style={{ gap: 8, marginVertical: 10 }}>
                <Text style={[styles.questionText, { color: t.text, fontFamily: t.font.sans }]}>
                  {q.question}
                </Text>
                {
                  q.answer_format == 'yes_no' ?
                    <View style={styles.choices}>
                      {(['yes', 'no', 'unsure'] as const).map((opt) => {
                        const selected = answers[q.id] === opt;
                        return (
                          <Pressable
                            key={opt}
                            disabled={readOnly}
                            onPress={() => setAnswers({ ...answers, [q.id]: opt })}
                            style={({ pressed }) => [
                              styles.choice,
                              {
                                backgroundColor: selected ? t.accent : t.surface,
                                borderColor: selected ? t.accent : t.border,
                                opacity: pressed ? 0.7 : 1,
                                borderRadius: t.radius.sm,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                {
                                  color: selected ? '#ffffff' : t.textMuted,
                                  fontFamily: t.font.sans,
                                },
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View> :
                    q.answer_format == 'open' ?
                    <TextBox placeholder='Write your answer...'
                      value={answers[q.id]}
                      onChangeText={(text) => setAnswers({...answers, [q.id]: text})}
                      style={{height: 180}}
                      editable={!readOnly}
                    /> :
                    <View style={styles.choices}>
                      {(q.options || []).map((opt) => {
                        const selected = answers[q.id] === opt;
                        return (
                          <Pressable
                            key={opt}
                            disabled={readOnly}
                            onPress={() => setAnswers({ ...answers, [q.id]: opt })}
                            style={({ pressed }) => [
                              styles.choice,
                              {
                                backgroundColor: selected ? t.accent : t.surface,
                                borderColor: selected ? t.accent : t.border,
                                opacity: pressed ? 0.7 : 1,
                                borderRadius: t.radius.sm,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.choiceText,
                                {
                                  color: selected ? '#ffffff' : t.textMuted,
                                  fontFamily: t.font.sans,
                                },
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                }
              </View>
              <View style={styles.groupHeader}>
                <Text style={[styles.roleName, { color: t.textFaint, fontFamily: t.font.sans, fontWeight: '300', fontSize: 10 }]}>{q.why_uncertain}</Text>
              </View>
            </View>
          ))
        }
      </View>
      {error && <ErrorRetry error={error} title="Could not build the questionnaire" backLabel="Back to scoring" />}
      {!readOnly && (
        <Button label="Submit answers →" variant="accent" onPress={onSubmit} disabled={!allAnswered} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, padding: 14 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleName: { fontSize: 14, fontWeight: '600' },
  confTag: { fontSize: 11, fontWeight: '600' },
  questionText: { fontSize: 14, lineHeight: 20 },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  choice: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  choiceText: { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
});
