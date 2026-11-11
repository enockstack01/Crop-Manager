import React, { useContext, useEffect, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { ActivityIndicator, Image, View } from 'react-native';
import { mediaUrl } from '../../env';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/theme';
import { AppText, Badge } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { useOfflineState } from '../../lib/offline';
import { aiStatus } from '../../lib/ai';
import { t } from '../../i18n';

export function AiDisclaimer() {
  const { colors } = useTheme();
  return (
    <AppText style={{ fontSize: 12, lineHeight: 18, color: colors.textLight, marginTop: 16 }}>
      {t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.')}
    </AppText>
  );
}

/**
 * Whether the online AI assistant can be used right now. Three honest states instead of one vague error:
 *  - no internet: says so and opens the offline tools (scan a plant, ask the offline assistant), which need no internet
 *  - internet but the check failed: says the assistant could not be reached, with a button to try again (and the offline tools)
 *  - assistant switched off on the server: asks the administrator to switch it on
 * `tools` is false inside a sheet that already shows the offline result itself.
 */
export function AiStatusBar({ tools = true }: { tools?: boolean }) {
  const { colors } = useTheme();
  const nav = useContext(NavigationContext) as any;
  const { online } = useOfflineState();
  const [s, setS] = useState<any>(null);
  const [tries, setTries] = useState(0);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!online) { setS(null); return undefined; }
    let live = true;
    setChecking(true);
    // one quiet second try: the first request after the phone reconnects often fails while the connection settles
    const ask = () => aiStatus().catch(() => new Promise<any>((r) => setTimeout(r, 2000)).then(() => aiStatus()));
    ask()
      .then((d) => live && setS(d))
      .catch(() => live && setS({ enabled: false, error: true }))
      .finally(() => live && setChecking(false));
    return () => { live = false; };
  }, [online, tries]);

  const toolsButton = tools && nav?.navigate ? (
    <Button title="Open the offline tools" icon="leaf" kind="secondary" size="sm" onPress={() => nav.navigate('offline-tools')} />
  ) : null;

  if (!online) {
    return (
      <View style={{ gap: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.orange, borderRadius: radius.lg, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="cloud-off-outline" size={14} color={colors.orange} />
          <AppText weight="700" style={{ fontSize: 13, flex: 1 }}>{t('You are offline')}</AppText>
        </View>
        <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('The online AI assistant needs internet. On this phone you can still scan a plant and ask the offline assistant, with no internet.')}</AppText>
        {toolsButton ? <View style={{ alignSelf: 'flex-start' }}>{toolsButton}</View> : null}
      </View>
    );
  }

  if (!s) return null;
  const failed = !!s.error;
  const off = !s.enabled;
  const hourLeft = s.hourly_remaining != null && s.remaining != null && s.hourly_remaining < s.remaining;
  if (!off && s.remaining == null) return null;

  if (failed) {
    return (
      <View style={{ gap: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.orange, borderRadius: radius.lg, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="plug-circle-xmark" size={14} color={colors.orange} />
          <AppText weight="700" style={{ fontSize: 13, flex: 1 }}>{t('Could not reach the AI assistant')}</AppText>
        </View>
        <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Your connection may be weak, or the service is busy. Try again in a moment. The offline tools work without internet.')}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button title="Try again" icon="refresh" size="sm" loading={checking} onPress={() => setTries((n) => n + 1)} />
          {toolsButton}
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 12,
      borderWidth: 1, borderColor: off ? colors.orange : colors.border, borderRadius: radius.pill, marginBottom: 12 }}>
      <Icon name={off ? 'plug-circle-xmark' : 'bolt'} size={12} color={off ? colors.orange : colors.primary} />
      <AppText style={{ fontSize: 12, color: colors.textLight, flexShrink: 1 }}>
        {off
          ? t('The AI assistant is not set up yet. Your administrator needs to switch it on.')
          : hourLeft ? t('{{count}} AI requests left this hour', { count: s.hourly_remaining }) : t('{{count}} AI requests left today', { count: s.remaining })}
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
export function DiagnosisReport({ report: r, photos = [] }: { report: any; photos?: string[] }) {
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
      {photos.length ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {photos.slice(0, 3).map((u) => (
            <Image key={u} source={{ uri: mediaUrl(u) }} style={{ width: 90, height: 90, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} resizeMode="cover" />
          ))}
        </View>
      ) : null}
      <Section icon="camera" title="What is happening" text={r.overview} />
      <Section icon="leaf" title="Affected part" text={r.affected_part} />
      {r.visible_signs?.length ? <Section icon="eye" title="What the photo shows" text={r.visible_signs.join(' · ')} /> : null}
      <Section icon="magnifying-glass" title="Cause" text={r.cause} />
      <Section icon="hand-holding-medical" title="Treatment" text={r.treatment} />
      <Section icon="prescription-bottle-medical" title="Medication" text={r.medication} />
      <Section icon="clipboard-list" title="How to give it" text={r.how_to_give} />
      <Section icon="shield-halved" title="Prevention" text={r.prevention} />
      {r.other_possibilities?.length ? <Section icon="list" title="Other possibilities" text={r.other_possibilities.join(' · ')} /> : null}
      <Section icon="link" title="Your farm" text={r.farm_link} />
      <Section icon="user-doctor" title="When to get expert help" text={r.when_to_get_help} />
      {r.follow_up_days ? (
        <AppText style={{ fontSize: 13, color: colors.textLight }}>{t('Check the crop again in {{count}} days.', { count: r.follow_up_days })}</AppText>
      ) : null}
    </View>
  );
}

/**
 * What the crop-disease model found in the photo: the three most likely matches with confidence bars and the
 * plant part, a retake-photo notice when the match is not certain, or a note that only the assistant read the photo.
 * `detection` is the block the server returns with a diagnosis; `hasPhoto` says whether a photo was sent.
 */
export function DetectionCard({ detection: d, hasPhoto = true }: { detection?: any; hasPhoto?: boolean }) {
  const { colors } = useTheme();
  if (!d) return null;
  if (d.source !== 'classifier' && d.source !== 'offline') {
    return hasPhoto ? (
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Icon name="circle-info" size={13} color={colors.textLight} />
        <AppText style={{ flex: 1, fontSize: 12.5, color: colors.textLight }}>{t('Only the AI assistant read this photo. The CropHealth model could not be reached.')}</AppText>
      </View>
    ) : null;
  }
  const unsure = !d.confident || d.unrecognised;
  return (
    <View style={{ marginTop: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Badge label={d.source === 'offline' ? t('Detected on this phone') : t('Detected by the CropHealth model')} tone="info" />
        <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('Most likely matches')}</AppText>
      </View>
      {d.predictions.slice(0, 3).map((p: any) => {
        const pct = Math.round(p.confidence * 100);
        return (
          <View key={p.label} accessible accessibilityLabel={`${p.healthy ? t('Healthy plant') : p.disease}, ${p.crop}, ${pct}%`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <AppText style={{ flex: 1, fontSize: 14 }}>{p.healthy ? `${p.crop}: ${t('Healthy plant')}` : `${p.crop}: ${p.disease}`}</AppText>
              <AppText weight="700" style={{ fontSize: 14 }}>{pct}%</AppText>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
              <View style={{ height: 8, borderRadius: 4, width: `${Math.max(2, pct)}%`, backgroundColor: colors.primary }} />
            </View>
            {p.part ? <AppText variant="caption" style={{ marginTop: 4 }}>{`${t('Plant part')}: ${p.part}`}</AppText> : null}
          </View>
        );
      })}
      {unsure ? (
        <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: colors.orange, borderRadius: radius.md, padding: 12 }}>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>
            <AppText weight="700" style={{ fontSize: 13 }}>{d.unrecognised ? t('This photo does not look like a plant the model knows.') : t('The match is not certain.')}</AppText>
            {` ${t('Retake the photo: one plant, the leaf in focus, in daylight. If the problem continues, ask an extension officer.')}`}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * An answer worked out on the phone because the server could not be reached: a banner that says it is less accurate,
 * the three matches, and general advice for that type of problem. There is no AI report offline.
 * `waiting` is true while the phone is still trying the server, whose full report would replace this.
 */
export function OfflineResult({ result, waiting = false, scan = false }: { result: any; waiting?: boolean; scan?: boolean }) {
  const { colors } = useTheme();
  const a = result.advice;
  return (
    <View style={{ marginTop: 16 }}>
      <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.orange }}>
        <Icon name="cloud-off-outline" size={16} color={colors.orange} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{scan ? t('Scan on this phone, lower accuracy') : t('Offline result, lower accuracy')}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 19 }}>{scan ? t('Worked out on your phone with no internet. It is less accurate than the full check and lists findings only, with no written report.') : t('This result was worked out on your phone. It is less accurate than the full check and has no AI report.')}</AppText>
          {waiting ? <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Still waiting for the AI assistant. If it answers, its report replaces this result.')}</AppText> : null}
        </View>
      </View>
      <DetectionCard detection={result} />
      {a ? (
        <View style={{ marginTop: 12, gap: 10, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }}>
          <AppText weight="700" style={{ fontSize: 14 }}>{a.about}</AppText>
          <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('What to do')}</AppText>
          {a.act.map((x: string) => <AppText key={x} style={{ fontSize: 13, lineHeight: 19 }}>{`\u2022 ${x}`}</AppText>)}
          <AppText weight="700" style={{ fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('How to prevent it')}</AppText>
          {a.prevent.map((x: string) => <AppText key={x} style={{ fontSize: 13, lineHeight: 19 }}>{`\u2022 ${x}`}</AppText>)}
          <AppText variant="caption">{t('General guidance for this type of problem. It is not specific to your crop and has not been reviewed by an agronomist.')}</AppText>
        </View>
      ) : null}
      <AppText style={{ marginTop: 12, fontSize: 13, lineHeight: 19 }}>{result.officer}</AppText>
    </View>
  );
}
