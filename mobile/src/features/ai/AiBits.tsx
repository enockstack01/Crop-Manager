import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Badge } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { aiStatus } from '../../lib/ai';
import { t } from '../../i18n';

export function AiDisclaimer() {
  const { colors } = useTheme();
  return (
    <AppText style={{ fontSize: 12, lineHeight: 18, color: colors.textLight, marginTop: 16 }}>
      {t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by Anthropic.')}
    </AppText>
  );
}

export function AiStatusBar() {
  const { colors } = useTheme();
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    let live = true;
    aiStatus().then((d) => live && setS(d)).catch(() => live && setS({ enabled: false, error: true }));
    return () => { live = false; };
  }, []);
  if (!s) return null;
  const off = !s.enabled;
  if (!off && s.remaining == null) return null;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12,
      borderWidth: 1, borderColor: off ? colors.orange : colors.border, borderRadius: radius.pill, marginBottom: 12 }}>
      <Icon name={off ? 'plug-circle-xmark' : 'bolt'} size={12} color={off ? colors.orange : colors.primary} />
      <AppText style={{ fontSize: 12, color: colors.textLight, flexShrink: 1 }}>
        {off
          ? (s.error ? t('Could not check the AI assistant.') : t('The AI assistant is not set up yet. Your administrator needs to add the Anthropic API key.'))
          : t('{{count}} AI requests left today', { count: s.remaining })}
      </AppText>
    </View>
  );
}

export function Thinking({ label = 'Thinking…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
      <ActivityIndicator color={colors.primary} />
      <AppText style={{ fontSize: 13, color: colors.textLight }}>{t(label)}</AppText>
    </View>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginTop: 12 }}>
      <AppText style={{ fontSize: 13, color: colors.red }}>{message}</AppText>
    </View>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.orange, borderRadius: radius.md, padding: 12, marginTop: 12 }}>
      <AppText style={{ fontSize: 13, lineHeight: 19 }}>{children}</AppText>
    </View>
  );
}

const SEV: Record<string, 'success' | 'warning' | 'danger'> = { Low: 'success', Medium: 'warning', High: 'danger', Critical: 'danger' };

function Section({ icon, title, text }: { icon: string; title: string; text?: string }) {
  const { colors } = useTheme();
  if (!text) return null;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={12} color="#FFFFFF" />
        </View>
        <AppText weight="700" style={{ fontSize: 13, color: colors.primaryDark }}>{t(title)}</AppText>
      </View>
      <AppText style={{ fontSize: 13, lineHeight: 20 }}>{text}</AppText>
    </View>
  );
}

/** Diagnosis-to-treatment report: cause, treatment, medication, how to give it. */
export function DiagnosisReport({ report: r }: { report: any }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 12, marginTop: 16 }}>
      <AppText weight="700" style={{ fontSize: 18, color: colors.primaryDark }}>{r.title}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Badge label={r.problem_type} tone="info" />
        <Badge label={`${t('Severity')}: ${t(r.severity)}`} tone={SEV[r.severity] || 'neutral'} />
        <Badge label={`${t('Confidence')}: ${t(r.confidence)}`} tone="neutral" />
      </View>
      {r.need_better_photo ? (
        <Note>
          <AppText weight="700" style={{ fontSize: 13 }}>{t('The photo or notes are not enough for a sure answer.')}</AppText> {r.photo_tips}
        </Note>
      ) : null}
      <Section icon="magnifying-glass" title="Cause" text={r.cause} />
      <Section icon="hand-holding-medical" title="Treatment" text={r.treatment} />
      <Section icon="prescription-bottle-medical" title="Medication" text={r.medication} />
      <Section icon="clipboard-list" title="How to give it" text={r.how_to_give} />
      <Section icon="shield-halved" title="Prevention" text={r.prevention} />
      {r.other_possibilities?.length ? <Section icon="list" title="Other possibilities" text={r.other_possibilities.join(' · ')} /> : null}
      <Section icon="user-doctor" title="When to get expert help" text={r.when_to_get_help} />
      {r.follow_up_days ? (
        <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Check the crop again in {{count}} days.', { count: r.follow_up_days })}</AppText>
      ) : null}
    </View>
  );
}
