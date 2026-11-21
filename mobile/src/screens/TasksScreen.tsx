import React, { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/theme';
import { AppText, Badge, EmptyState, Loading, PageHeader, Screen } from '../components/ui';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { DateField, SelectField, TextAreaField, TextField, useForm } from '../components/fields';
import { useConfirm } from '../components/Confirm';
import { useToast } from '../components/Toast';
import { useProfile } from '../lib/useResource';
import { formatDate } from '../lib/format';
import { useTaskMutations, useTasks, useTeam } from '../lib/team';
import { isCollector } from '../lib/teamRules';
import { t } from '../i18n';

/*
 * Tasks. The farm manager hands them out (to one data collector or to everyone) with a date. A data collector sees the tasks that are theirs or
 * for everyone and marks them done, with a note.
 */
const today = () => new Date().toISOString().slice(0, 10);
const late = (r: any) => r.status === 'open' && r.due_date && r.due_date < today();

function AddTask({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { data: team } = useTeam();
  const { create } = useTaskMutations();
  const form = useForm({ title: '', assigned_to: '', due_date: '', priority: 'Normal', description: '' });
  const [err, setErr] = useState('');
  const people = (team?.data || []).filter((m: any) => m.status === 'active' && m.member_id);
  const save = async () => {
    if (form.values.title.trim().length < 2) { setErr(t('Say what needs doing.')); return; }
    try {
      await create.mutateAsync({ ...form.values, due_date: form.values.due_date || '' });
      toast(t('Task added'));
      onClose();
    } catch (e: any) { setErr(e?.message || t('Could not save')); }
  };
  return (
    <Sheet visible onClose={onClose} title={t('Add task')} footer={<Button title="Save task" icon="floppy-disk" loading={create.isPending} onPress={save} />}>
      {err ? <View style={{ borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, padding: 12, marginBottom: 12 }}><AppText style={{ fontSize: 13, color: colors.red }}>{err}</AppText></View> : null}
      <TextField label="What needs doing" required {...form.bind('title')} placeholder="e.g. Scout the south field for armyworm" />
      <SelectField label="For" {...form.bind('assigned_to')} placeholder="" options={[{ value: '', label: t('Everyone on the team') }, ...people.map((m: any) => ({ value: m.member_id, label: m.name || m.email }))]} />
      <DateField label="Due date" {...form.bind('due_date')} />
      <SelectField label="Priority" {...form.bind('priority')} placeholder="" options={['Low', 'Normal', 'High'].map((p) => ({ value: p, label: t(p) }))} />
      <TextAreaField label="Details" {...form.bind('description')} />
    </Sheet>
  );
}

export function TasksScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { profile } = useProfile();
  const collector = isCollector(profile);
  const [show, setShow] = useState<'open' | 'done'>('open');
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data, isLoading, isError, refetch } = useTasks(show);
  const { setStatus, remove } = useTaskMutations();

  const act = async (task: any, status: 'open' | 'done') => {
    try { await setStatus.mutateAsync({ id: task.id, status, completion_note: notes[task.id] }); toast(status === 'done' ? t('Marked done') : t('Opened again')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };
  const del = async (task: any) => {
    if (!(await confirm(t('Delete this task?'), { confirmLabel: 'Delete' }))) return;
    try { await remove.mutateAsync(task.id); toast(t('Deleted successfully')); } catch (e: any) { toast(e?.message || '', 'error'); }
  };

  return (
    <Screen>
      <PageHeader title={collector ? 'My tasks' : 'Tasks'} subtitle={collector ? 'The jobs your farm manager gave you, and the ones for everyone.' : 'Hand out work to your data collectors and see when it is done.'} />
      {!collector ? <><Button title="Add task" icon="plus" onPress={() => setAdding(true)} /><View style={{ height: 12 }} /></> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <Button title="Open" size="sm" kind={show === 'open' ? 'primary' : 'secondary'} onPress={() => setShow('open')} />
        <Button title="Done" size="sm" kind={show === 'done' ? 'primary' : 'secondary'} onPress={() => setShow('done')} />
      </View>
      {isLoading ? <Loading /> : isError ? <EmptyState icon="triangle-exclamation" title="Could not load your tasks" actionLabel="Retry" onAction={() => refetch()} /> : (data || []).length === 0 ? (
        <EmptyState icon="list-check" title={show === 'open' ? 'Nothing to do' : 'Nothing done yet'} description={collector ? (show === 'open' ? 'Your farm manager has not given you a task right now.' : 'Tasks you finish appear here.') : 'Create a task for one data collector or for everyone on the team.'} />
      ) : (
        <View style={{ gap: 12 }}>
          {(data || []).map((r: any) => (
            <View key={r.id} style={{ gap: 6, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: r.status === 'done' ? colors.primary : r.priority === 'High' || late(r) ? colors.red : colors.orange, backgroundColor: colors.card }}>
              <AppText weight="700" style={{ fontSize: 15 }}>{r.title}</AppText>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {r.priority === 'High' ? <Badge label={t('High')} tone="danger" /> : null}
                <Badge label={r.assigned_to ? (collector ? t('For you') : r.assigned_to_name || t('One person')) : t('For everyone')} tone="info" />
                {r.due_date ? <AppText style={{ fontSize: 12, color: late(r) ? colors.red : colors.textLight }}>{late(r) ? t('Late') : t('Due')} {formatDate(r.due_date)}</AppText> : null}
              </View>
              {r.description ? <AppText style={{ fontSize: 13, lineHeight: 19 }}>{r.description}</AppText> : null}
              {r.status === 'done' ? <AppText style={{ fontSize: 13 }}>{t('Done')}{r.done_by_name ? ` · ${r.done_by_name}` : ''}{r.completion_note ? `: ${r.completion_note}` : ''}</AppText> : null}
              {collector && r.status === 'open' ? (
                <View style={{ gap: 6 }}>
                  <TextField label="Note (optional)" value={notes[r.id] || ''} onChangeValue={(v: string) => setNotes((n) => ({ ...n, [r.id]: v }))} />
                  <View style={{ alignSelf: 'flex-start' }}><Button title="Mark done" icon="check" size="sm" loading={setStatus.isPending} onPress={() => act(r, 'done')} /></View>
                </View>
              ) : null}
              {collector && r.status === 'done' && r.done_by === profile?.user_id ? <View style={{ alignSelf: 'flex-start' }}><Button title="Open again" size="sm" kind="secondary" onPress={() => act(r, 'open')} /></View> : null}
              {!collector ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {r.status === 'open' ? <Button title="Mark done" icon="check" size="sm" kind="secondary" onPress={() => act(r, 'done')} /> : <Button title="Open again" size="sm" kind="secondary" onPress={() => act(r, 'open')} />}
                  <Button title="Delete" size="sm" kind="secondary" onPress={() => del(r)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {adding ? <AddTask onClose={() => setAdding(false)} /> : null}
    </Screen>
  );
}
