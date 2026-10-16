import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { useAnalyzer } from '@/lib/analyzer/useAnalyzer';

import { Header } from '@/components/analyzer/Header';
import { LibraryModal } from '@/components/analyzer/LibraryModal';
import { SaveButton } from '@/components/ui/SaveButton';
import { OrgStep } from '@/components/analyzer/OrgStep';
import { RolesStep } from '@/components/analyzer/RolesStep';
import { ScoringStep } from '@/components/analyzer/ScoringStep';
import { QuestionnaireStep } from '@/components/analyzer/QuestionnaireStep';
import { AdjustingStep } from '@/components/analyzer/AdjustingStep';
import { BiasStep } from '@/components/analyzer/BiasStep';
import { LaborStep } from '@/components/analyzer/LaborStep';
import { SituationStep } from '@/components/analyzer/SituationStep';
import { AnalysisStep } from '@/components/analyzer/AnalysisStep';
import { Visualization } from '@/components/analyzer/Visualization';
import { SituationAnalysisView } from '@/components/analyzer/SituationAnalysisView';
import { AdjustedRoleType } from '@/lib/analyzer/prompts';
import type { StepError, StepId } from '@/lib/analyzer/types';

export default function PowerDynamicsScreen() {
  const { theme: t } = useTheme();
  const router = useRouter();
  const a = useAnalyzer();

  const [libraryOpen, setLibraryOpen] = useState(false);

  // the stage currently on screen: a past stage when reviewing, else the live one
  const view = a.viewStage ?? a.stage;
  const readOnly = a.viewStage != null;

  // hand a step its own failure (plus the two ways out) and nothing else.
  // Reviewing an earlier stage never shows a live failure.
  const errorFor = (step: StepId): StepError | undefined =>
    !readOnly && a.failure?.step === step
      ? { ...a.failure, onRetry: a.retryStep, onBack: a.backFromFailure }
      : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Header
            stage={view}
            liveStage={a.stage}
            onStepPress={a.goToStage}
            onReset={a.reset}
            onOpenLibrary={() => setLibraryOpen(true)}
            onBack={() => router.back()}
            omitStages={a.usesLaborData ? undefined : ['labor']}
          />

          {readOnly && (
            <Pressable
              onPress={a.returnToCurrent}
              style={({ pressed }) => [
                styles.banner,
                { backgroundColor: t.surfaceMuted, borderColor: t.border, borderRadius: t.radius.md, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.bannerText, { color: t.textMuted, fontFamily: t.font.sans }]}>
                Reviewing a completed step (read-only). Tap to return to the current step →
              </Text>
            </Pressable>
          )}

          {view === 'org' && (
            <OrgStep
              value={a.orgSelfDescription}
              onChange={(id, v) => a.setOrgSelfDescription(prev => ({...prev, [id]: v}))}
              onSetPaid={(paid) => a.setOrgSelfDescription(prev => ({...prev, paid}))}
              onNext={a.runOrgSelf}
              readOnly={readOnly}
            />
          )}
          {view === 'roles' && (
            <RolesStep
              roles={a.roles}
              addRole={a.addRole}
              updateRole={a.updateRole}
              removeRole={a.removeRole}
              onBack={() => a.setStage('org')}
              onNext={a.runScoring}
              onSaveSetup={() => a.saveSetup()}
              readOnly={readOnly}
            />
          )}
          {view === 'scoring' && (
            <ScoringStep
              scored={a.scored}
              onNext={a.runQuestionnaire}
              readOnly={readOnly}
              error={errorFor('scoring')}
            />
          )}
          {view === 'questionnaire' && (
            <QuestionnaireStep
              scored={a.scored}
              questions={a.questions}
              answers={a.answers}
              setAnswers={a.setAnswers}
              onSubmit={a.submitAnswers}
              readOnly={readOnly}
              error={errorFor('questionnaire')}
            />
          )}
          {view === 'adjusting' && <AdjustingStep error={errorFor('adjusting')} />}
          {view === 'bias' && (
            <BiasStep
              adjusted={a.adjusted as AdjustedRoleType}
              onNext={a.continueFromBias}
              readOnly={readOnly}
            />
          )}
          {view === 'labor' && (
            <LaborStep
              industryCodes={a.industryCodes}
              BLSData={a.BLSData}
              joltsData={a.joltsData}
              onNext={() => a.setStage('situation')}
              onSkip={a.skipLabor}
              notApplicable={a.laborNotApplicable}
              readOnly={readOnly}
              error={errorFor('labor')}
              busy={!readOnly && a.busyStep === 'labor'}
            />
          )}
          {view === 'situation' && (
            <SituationStep
              situation={a.situation}
              setSituation={a.setSituation}
              onAnalyze={a.runAnalysis}
              readOnly={readOnly}
              error={errorFor('analysis')}
            />
          )}
          {view === 'analysis' && <AnalysisStep error={errorFor('analysis')} />}
          {view === 'viz' && (
            <View style={{ gap: 24 }}>
              {a.analysis && <SituationAnalysisView analysis={a.analysis} />}
              {!readOnly && (
                <SaveButton label="Save results to Library" variant="accent" fullWidth onSave={() => a.saveRun()} />
              )}
              <Visualization
                roles={a.adjusted}
                onReset={a.reset}
                userRoleId={a.roles.find((r) => r.isUserRole)?.id}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <LibraryModal
        visible={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onLoadSetup={a.applySetup}
        onLoadRun={a.applyRun}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60, gap: 24 },
  banner: { borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  bannerText: { fontSize: 13, fontWeight: '500' },
});
