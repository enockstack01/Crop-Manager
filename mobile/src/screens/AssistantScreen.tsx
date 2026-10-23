import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { ff, radius } from '../theme/theme';
import { AppText, Badge, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { TextField, TextAreaField } from '../components/fields';
import { useToast } from '../components/Toast';
import { useResourceMutations } from '../lib/useResource';
import { formatCurrency } from '../lib/format';
import { aiAdvice, aiChat, aiInsights, aiParseRecord, aiSeasonSummary } from '../lib/ai';
import { AiDisclaimer, AiStatusBar, ErrorNote, Note, Thinking } from '../features/ai/AiBits';
import { DiagnoseSheet } from '../features/ai/DiagnoseSheet';
import { t } from '../i18n';

const TABS = [
  { id: 'ask', icon: 'comments', label: 'Ask' },
  { id: 'insights', icon: 'lightbulb', label: 'Farm insights' },
  { id: 'plans', icon: 'list-check', label: 'Plans and advice' },
  { id: 'summary', icon: 'file-signature', label: 'Season summary' },
  { id: 'record', icon: 'pen-to-square', label: 'Quick record' },
  { id: 'photo', icon: 'camera', label: 'Check a plant' },
] as const;

/** Runs an AI call and keeps its loading, error and result state. */
function useAi<A extends any[]>(fn: (...a: A) => Promise<any>) {
  const [state, setState] = useState<{ busy: boolean; error: string; data: any }>({ busy: false, error: '', data: null });
  const run = async (...args: A) => {
    setState({ busy: true, error: '', data: null });
    try {
      setState({ busy: false, error: '', data: await fn(...args) });
    } catch (e: any) {
      setState({ busy: false, error: e?.message || t('The AI assistant could not answer.'), data: null });
    }
  };
  return [state, run] as const;
}

const Head = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  return <AppText weight="700" style={{ fontSize: 16, color: colors.primaryDark, marginTop: 16, marginBottom: 8 }}>{children}</AppText>;
};
const Lead = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  return <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight, marginBottom: 12 }}>{children}</AppText>;
};

/* ---------------------------------------------------------------- ask */
const EXAMPLES = [
  'Which of my crops needs attention this week?',
  'How can I lower my costs next season?',
  'When should I harvest and sell to get a better price?',
];

function Ask() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (q?: string) => {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError('');
    try {
      const { reply } = await aiChat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e?.message || t('The AI assistant could not answer.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 10 }}>
      {!messages.length ? (
        <View style={{ gap: 8 }}>
          <Lead>{t('Ask about your crops, pests, inputs, money or harvest. The assistant reads your farm records to answer.')}</Lead>
          {EXAMPLES.map((ex) => (
            <Button key={ex} title={ex} kind="secondary" size="sm" onPress={() => send(t(ex))} />
          ))}
        </View>
      ) : null}
      {messages.map((m, i) => (
        <View
          key={i}
          style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', padding: 12, borderRadius: 14,
            backgroundColor: m.role === 'user' ? colors.primaryDark : colors.card,
            borderWidth: m.role === 'user' ? 0 : 1, borderColor: colors.border,
          }}
        >
          <AppText style={{ fontSize: 14, lineHeight: 21, color: m.role === 'user' ? '#FFFFFF' : colors.text }}>{m.content}</AppText>
        </View>
      ))}
      {busy ? <Thinking /> : null}
      <ErrorNote message={error} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={1000}
          placeholder={t('Type your question')}
          placeholderTextColor={colors.placeholder}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
            backgroundColor: colors.input, color: colors.text, fontFamily: ff('400'), fontSize: 14 }}
        />
        <Button title="Send" icon="paper-plane" disabled={busy || !text.trim()} onPress={() => send()} />
      </View>
      {messages.length ? <Button title="New chat" kind="ghost" size="sm" onPress={() => { setMessages([]); setError(''); }} /> : null}
    </View>
  );
}

/* ----------------------------------------------------------- insights */
const PRIORITY: Record<string, 'danger' | 'warning' | 'neutral'> = { High: 'danger', Medium: 'warning', Low: 'neutral' };
const MODULE_ROUTE: Record<string, string> = {
  'crop-scouting-records': 'scouting', 'inventory-items': 'inventory', 'harvest-records': 'harvest',
  'fertilizer-applications': 'fertilizers', 'irrigation-records': 'irrigation',
};

function Insights({ go }: { go: (route: string) => void }) {
  const { colors } = useTheme();
  const [{ busy, error, data }, run] = useAi(aiInsights);
  const r = data?.insights;
  return (
    <View>
      <Lead>{t('A review of your whole farm: crops, pests and disease, stock, money and harvests, with the next best actions.')}</Lead>
      <Button title={r ? 'Refresh insights' : 'Review my farm'} icon="wand-magic-sparkles" loading={busy} onPress={() => run()} />
      {busy ? <Thinking label="Reading your records…" /> : null}
      <ErrorNote message={error} />
      {r ? (
        <View style={{ gap: 10 }}>
          <Head>{r.headline}</Head>
          {r.items.map((it: any, i: number) => (
            <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14, gap: 8, backgroundColor: colors.card }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge label={it.priority} tone={PRIORITY[it.priority] || 'neutral'} />
                <AppText style={{ fontSize: 11, color: colors.textLight }}>{t(it.area)}</AppText>
              </View>
              <AppText weight="700" style={{ fontSize: 14, color: colors.primaryDark }}>{it.title}</AppText>
              <AppText style={{ fontSize: 13, lineHeight: 20 }}>{it.detail}</AppText>
              {it.module && it.module !== 'dashboard' ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <Button title="Open" size="sm" kind="secondary" onPress={() => go(MODULE_ROUTE[it.module] || it.module)} />
                </View>
              ) : null}
            </View>
          ))}
          {r.missing_records?.length ? (
            <AppText style={{ fontSize: 12, color: colors.textLight }}>{t('Add these records for better advice')}: {r.missing_records.join(' · ')}</AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------- plans */
const TOPICS = [
  { id: 'inputs', label: 'Inputs to buy' },
  { id: 'planting', label: 'Planting plan' },
  { id: 'fertiliser', label: 'Fertiliser plan' },
  { id: 'irrigation', label: 'Water and irrigation' },
  { id: 'protection', label: 'Pests, disease and weeds' },
  { id: 'harvest', label: 'Harvest and storage' },
];

function Plans() {
  const { colors } = useTheme();
  const [topic, setTopic] = useState('inputs');
  const [question, setQuestion] = useState('');
  const [{ busy, error, data }, run] = useAi(aiAdvice);
  const a = data?.advice;
  return (
    <View>
      <AppText weight="600" style={{ fontSize: 13, marginBottom: 8 }}>{t('What do you need a plan for?')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {TOPICS.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => setTopic(x.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: topic === x.id }}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1,
              borderColor: topic === x.id ? colors.primaryDark : colors.border, backgroundColor: topic === x.id ? colors.primaryDark : colors.card }}
          >
            <AppText weight="600" style={{ fontSize: 12, color: topic === x.id ? '#FFFFFF' : colors.text }}>{t(x.label)}</AppText>
          </Pressable>
        ))}
      </View>
      <TextField label="Anything specific? (optional)" value={question} onChangeValue={setQuestion} />
      <Button title="Make my plan" icon="wand-magic-sparkles" loading={busy} onPress={() => run(topic, question)} />
      {busy ? <Thinking label="Planning…" /> : null}
      <ErrorNote message={error} />
      {a ? (
        <View style={{ gap: 10 }}>
          <Head>{a.headline}</Head>
          {a.steps.map((s: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <AppText weight="700" style={{ fontSize: 12, color: '#FFFFFF' }}>{i + 1}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={{ fontSize: 13, lineHeight: 20 }}><AppText weight="700" style={{ fontSize: 13 }}>{s.action}</AppText> · {s.when}</AppText>
                {s.detail ? <AppText style={{ fontSize: 13, lineHeight: 20, color: colors.textLight }}>{s.detail}</AppText> : null}
              </View>
            </View>
          ))}
          {a.shopping_list?.length ? (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
              {a.shopping_list.map((x: any, i: number) => (
                <View key={i} style={{ padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <AppText weight="600" style={{ fontSize: 13 }}>{x.item}</AppText>
                  <AppText style={{ fontSize: 12, color: colors.textLight }}>{x.quantity}{x.have_in_stock ? ` · ${t('In stock')}: ${x.have_in_stock}` : ''}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          {a.watch_outs?.length ? <Note><AppText weight="700" style={{ fontSize: 13 }}>{t('Watch out')}:</AppText> {a.watch_outs.join(' · ')}</Note> : null}
          {a.based_on ? <AppText style={{ fontSize: 12, color: colors.textLight }}>{a.based_on}</AppText> : null}
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------ summary */
function Summary() {
  const { colors } = useTheme();
  const [scope, setScope] = useState('');
  const [{ busy, error, data }, run] = useAi(aiSeasonSummary);
  const s = data?.summary;
  const Block = ({ title, text }: { title: string; text: string }) => (
    <View style={{ gap: 4 }}>
      <AppText weight="700" style={{ fontSize: 14, color: colors.primaryDark }}>{t(title)}</AppText>
      <AppText style={{ fontSize: 13, lineHeight: 20 }}>{text}</AppText>
    </View>
  );
  return (
    <View>
      <Lead>{t('A clear summary of production, income, costs and risks that you can share with a bank or lender.')}</Lead>
      <TextField label="What should it cover? (optional)" value={scope} onChangeValue={setScope} placeholder="For example: maize, season A 2026" />
      <Button title="Write my summary" icon="wand-magic-sparkles" loading={busy} onPress={() => run(scope)} />
      {busy ? <Thinking label="Writing…" /> : null}
      <ErrorNote message={error} />
      {s ? (
        <View style={{ gap: 12, marginTop: 16 }}>
          <AppText weight="700" style={{ fontSize: 18, color: colors.primaryDark }}>{s.title}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 20 }}>{s.overview}</AppText>
          {s.highlights?.map((h: string, i: number) => <AppText key={i} style={{ fontSize: 13, lineHeight: 20 }}>• {h}</AppText>)}
          <Block title="Production" text={s.production} />
          <Block title="Finances" text={s.finances} />
          <Block title="Risks and how they were handled" text={s.risks_and_controls} />
          <Block title="Outlook" text={s.outlook} />
          <Block title="Quality of records" text={s.record_quality} />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------- quick record */
const TARGET: Record<string, string> = { expenses: 'Expense', sales: 'Sale', 'harvest-records': 'Harvest record' };

function QuickRecord() {
  const { colors } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [{ busy, error, data }, run] = useAi(aiParseRecord);
  const resource = data?.resource && data.resource !== 'none' ? data.resource : 'expenses';
  const { create } = useResourceMutations(resource);
  const rec = data?.record;
  const blocked = !rec || data.missing.length > 0 || saved;

  const save = async () => {
    try {
      await create.mutateAsync(rec);
      setSaved(true);
      toast(t('Record saved'));
    } catch (e: any) {
      toast(e?.message || t('Failed to save'), 'error');
    }
  };

  return (
    <View>
      <Lead>{t('Type what happened the way you would say it, and the assistant fills in the record for you to check.')}</Lead>
      <TextAreaField
        value={text}
        onChangeValue={(v) => { setText(v); setSaved(false); }}
        placeholder="For example: Bought 5 bags of fertilizer for 90,000 from Agro Shop yesterday"
      />
      <Button title="Understand" icon="wand-magic-sparkles" loading={busy} disabled={!text.trim()} onPress={() => run(text)} />
      {busy ? <Thinking label="Reading…" /> : null}
      <ErrorNote message={error} />
      {data ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Head>{data.summary}</Head>
          {rec ? (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' }}>
              <Row k={t('Record')} v={t(TARGET[data.resource])} first />
              {Object.entries(rec).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <Row
                  key={k}
                  k={t(k.replace(/_/g, ' '))}
                  v={k === 'crop_id' ? data.crop_name : k === 'farm_id' ? data.farm_name : k === 'amount' || k === 'unit_price' ? formatCurrency(v as number, (rec as any).currency) : String(v)}
                />
              ))}
            </View>
          ) : null}
          {data.missing.length ? (
            <Note><AppText weight="700" style={{ fontSize: 13 }}>{t('Still needed')}:</AppText> {data.missing.map((m: string) => t(m)).join(' · ')}. {t('Add it to your message and try again.')}</Note>
          ) : null}
          {rec ? <Button title={saved ? 'Saved' : 'Save record'} icon="check" disabled={blocked} loading={create.isPending} onPress={save} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Row({ k, v, first }: { k: string; v: string; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 10, borderTopWidth: first ? 0 : 1, borderTopColor: colors.border }}>
      <AppText style={{ fontSize: 12, color: colors.textLight, textTransform: 'capitalize' }}>{k}</AppText>
      <AppText weight="600" style={{ fontSize: 13, flexShrink: 1, textAlign: 'right' }}>{v}</AppText>
    </View>
  );
}

/* ------------------------------------------------------------ check a plant */
function PlantCheck() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<null | 'camera' | 'files'>(null);
  return (
    <View style={{ gap: 12 }}>
      <AppText style={{ fontSize: 13, lineHeight: 19, color: colors.textLight }}>{t('Take a photo of the sick leaf, stem or fruit. The assistant finds the infected part, names the problem and tells you how to treat it.')}</AppText>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button title="Take a photo" icon="camera" onPress={() => setMode('camera')} />
        <Button title="Choose photos" kind="secondary" icon="image" onPress={() => setMode('files')} />
      </View>
      {mode ? <DiagnoseSheet key={mode} visible onClose={() => setMode(null)} input={{}} autoCamera={mode === 'camera'} /> : null}
    </View>
  );
}

/* --------------------------------------------------------------- page */
export function AssistantScreen({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ask');
  const scroll = useRef<ScrollView>(null);
  return (
    <Screen>
      <PageHeader title="AI Assistant" subtitle="Advice from your own farm records, in your language." />
      <AiStatusBar />
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
        {TABS.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => setTab(x.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === x.id }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1,
              borderColor: tab === x.id ? colors.primaryDark : colors.border, backgroundColor: tab === x.id ? colors.primaryDark : colors.card }}
          >
            <Icon name={x.icon} size={12} color={tab === x.id ? '#FFFFFF' : colors.textLight} />
            <AppText weight="600" style={{ fontSize: 12, color: tab === x.id ? '#FFFFFF' : colors.text }}>{t(x.label)}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        {tab === 'ask' ? <Ask /> : null}
        {tab === 'insights' ? <Insights go={(r) => navigation.navigate(r)} /> : null}
        {tab === 'plans' ? <Plans /> : null}
        {tab === 'summary' ? <Summary /> : null}
        {tab === 'record' ? <QuickRecord /> : null}
        {tab === 'photo' ? <PlantCheck /> : null}
      </View>
      <AiDisclaimer />
    </Screen>
  );
}
