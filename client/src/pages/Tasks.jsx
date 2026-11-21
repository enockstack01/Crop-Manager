import { useState } from 'react';
import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { FarmFieldRow } from '../components/relationFields.jsx';
import { EmptyState, Loading, PageHeader, StatusBadge } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useProfile } from '../components/profile.jsx';
import { formatDate } from '../lib/format.js';
import { useList } from '../lib/useResource.js';
import { useTaskDone, useTeam } from '../lib/team.js';
import { t } from '../i18n/index.js';

/*
 * Tasks. The farm manager hands them out (to one data collector or to everyone) with a date and, if useful, a field. A data collector sees the
 * tasks that are theirs or for everyone and marks them done, with a note.
 */
const PRIORITIES = ['Low', 'Normal', 'High'];
const INITIAL = { title: '', description: '', due_date: '', priority: 'Normal', assigned_to: '', farm_id: '', field_id: '', status: 'open' };

function TaskForm(props) {
  const { data: team } = useTeam();
  const people = (team?.data || []).filter((m) => m.status === 'active' && m.member_id);
  return (
    <ResourceForm {...props} resource="tasks" title="Task" initial={INITIAL} toPayload={(v) => ({ ...v, due_date: v.due_date || '', farm_id: v.farm_id || null, field_id: v.field_id || null })}>
      {(form) => (
        <>
          <TextField label="What needs doing" required {...form.bind('title')} placeholder="e.g. Scout the south field for armyworm" />
          <FormRow>
            <SelectField label="For" {...form.bind('assigned_to')} placeholder="" options={[{ value: '', label: t('Everyone on the team') }, ...people.map((m) => ({ value: m.member_id, label: m.name || m.email }))]} />
            <DateField label="Due date" {...form.bind('due_date')} />
          </FormRow>
          <FormRow>
            <SelectField label="Priority" {...form.bind('priority')} placeholder="" options={PRIORITIES.map((p) => ({ value: p, label: t(p) }))} />
            <SelectField label="Status" {...form.bind('status')} placeholder="" options={[{ value: 'open', label: t('Open') }, { value: 'done', label: t('Done') }]} />
          </FormRow>
          <FarmFieldRow {...form} />
          <TextArea label="Details" {...form.bind('description')} />
        </>
      )}
    </ResourceForm>
  );
}

const lateOf = (r) => r.status === 'open' && r.due_date && r.due_date < new Date().toISOString().slice(0, 10);

function ManagerTasks() {
  return (
    <CrudPage
      resource="tasks"
      title="Tasks"
      subtitle="Hand out work to your data collectors and see when it is done."
      addLabel="Add task"
      searchPlaceholder="Search tasks..."
      emptyIcon="fa-list-check"
      emptyTitle="No tasks yet"
      emptyDescription="Create a task for one data collector or for everyone on the team."
      FormComponent={TaskForm}
      defaultSort={{ sort: 'due_date', order: 'asc' }}
      filters={[{ key: 'status', placeholder: 'All', options: ['open', 'done'] }]}
      columns={[
        { key: 'title', label: 'Task', sortable: true, render: (r) => <strong>{r.title}</strong> },
        { key: 'assigned_to_name', label: 'For', render: (r) => r.assigned_to_name || t('Everyone') },
        { key: 'due_date', label: 'Due', sortable: true, render: (r) => (r.due_date ? <span className={lateOf(r) ? 'text-danger' : ''}>{formatDate(r.due_date)}</span> : '—') },
        { key: 'priority', label: 'Priority', render: (r) => <span className={`badge badge-${r.priority === 'High' ? 'danger' : r.priority === 'Low' ? 'secondary' : 'info'}`}>{t(r.priority)}</span> },
        { key: 'status', label: 'Status', render: (r) => (r.status === 'done' ? <span className="badge badge-success">{t('Done')}{r.done_by_name ? ` · ${r.done_by_name}` : ''}</span> : <StatusBadge status={lateOf(r) ? 'Overdue' : 'Open'} />) },
      ]}
      viewFields={(r) => [
        ['Task', r.title], ['For', r.assigned_to_name || t('Everyone')], ['Due', r.due_date ? formatDate(r.due_date) : '—'], ['Priority', r.priority], ['Status', r.status],
        ['Completed by', r.done_by_name || '—'], ['Completion note', r.completion_note || '—', true], ['Details', r.description || '—', true],
      ]}
    />
  );
}

function CollectorTasks() {
  const toast = useToast();
  const { profile } = useProfile();
  const [show, setShow] = useState('open');
  const [note, setNote] = useState({});
  const { data, isLoading, isError, refetch } = useList('tasks', { status: show, perPage: 100 });
  const done = useTaskDone();
  const act = async (task, status) => {
    try { await done.mutateAsync({ id: task.id, status, completion_note: note[task.id] }); toast(status === 'done' ? t('Marked done') : t('Opened again')); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <>
      <PageHeader title="My tasks" subtitle="The jobs your farm manager gave you, and the ones for everyone." />
      <div className="gh-toolbar">
        <select className="form-control" value={show} onChange={(e) => setShow(e.target.value)} aria-label={t('Show')}>
          <option value="open">{t('Open')}</option><option value="done">{t('Done')}</option>
        </select>
      </div>
      {isLoading ? <Loading /> : isError ? <EmptyState icon="fa-exclamation-triangle" title="Could not load your tasks" actionLabel="Retry" onAction={refetch} /> : (data?.data || []).length === 0 ? (
        <EmptyState icon="fa-list-check" title={show === 'open' ? 'Nothing to do' : 'Nothing done yet'} description={show === 'open' ? 'Your farm manager has not given you a task right now.' : 'Tasks you finish appear here.'} />
      ) : data.data.map((r) => (
        <div key={r.id} className={`gh-alert gh-alert-${r.priority === 'High' ? 'high' : 'medium'}`}>
          <div className="gh-alert-head">
            <strong>{r.title}</strong>
            {r.priority === 'High' && <span className="badge badge-danger">{t('High')}</span>}
            {r.assigned_to === '' && <span className="badge badge-info">{t('For everyone')}</span>}
            {r.due_date && <span className={`org-muted ${lateOf(r) ? 'text-danger' : ''}`} style={{ marginLeft: 'auto' }}>{lateOf(r) ? t('Late') : t('Due')}: {formatDate(r.due_date)}</span>}
          </div>
          {r.description && <p style={{ margin: '6px 0' }}>{r.description}</p>}
          {r.status === 'open' ? (
            <div className="gh-alert-form">
              <input className="form-control" placeholder={t('Note (optional)')} value={note[r.id] || ''} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} maxLength={500} aria-label={t('Note')} />
              <button type="button" className="btn btn-primary btn-sm" disabled={done.isPending} onClick={() => act(r, 'done')}><i className="fas fa-check" /> {t('Mark done')}</button>
            </div>
          ) : (
            <div className="gh-alert-ack"><i className="fas fa-check" /> {t('Done')}{r.completion_note ? `: ${r.completion_note}` : ''}
              {r.done_by === profile?.user_id ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(r, 'open')}>{t('Open again')}</button> : null}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

export default function Tasks() {
  const { profile } = useProfile();
  return profile?.user_type === 'collector' ? <CollectorTasks /> : <ManagerTasks />;
}
