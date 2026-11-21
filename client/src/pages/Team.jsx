import { useState } from 'react';
import { DataTable, EmptyState, Loading, PageHeader } from '../components/ui.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, TextField } from '../components/form.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { ago, MEMBER_STATUS, useMember, useTeam, useTeamMutations } from '../lib/team.js';
import { t } from '../i18n/index.js';

/*
 * The Team page: the farm manager's data collectors. Add one (name, email, optional phone: they get an email to set a password), follow each
 * one's entries this week and last activity, cancel a waiting invitation or remove a collector. Removing someone ends their access; the
 * entries they already made stay in the farm's records.
 */
const when = (iso) => {
  const a = ago(iso);
  return a ? t(a.key, { n: a.n, date: a.date ? formatDate(a.date) : '' }) : t('Never');
};

function Badge({ status }) {
  const m = MEMBER_STATUS[status] || MEMBER_STATUS.active;
  return <span className={`badge badge-${m.tone}`}>{t(m.label)}</span>;
}

function AddForm({ onClose }) {
  const toast = useToast();
  const { invite } = useTeamMutations();
  const [v, setV] = useState({ name: '', email: '', phone: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const m = await invite.mutateAsync(v);
      toast(m.status === 'active' ? t('{{name}} was added to your team.', { name: m.name }) : m.email_sent ? t('Invitation sent to {{email}}.', { email: m.email }) : m.email_test_mode ? t('Invitation saved (no email is sent in test mode).') : t('Invitation saved, but the email could not be sent: {{why}}. Send it again later.', { why: m.email_error || t('unknown error') }), m.email_error ? 'info' : 'success');
      onClose();
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal open onClose={onClose} title={t('Add data collector')}>
      <form onSubmit={submit}>
        <p className="ai-lead" style={{ marginTop: 0 }}>{t('The collector gets an email invitation to set a password. When they sign in, the invitation becomes their account and links them to your farm. An administrator approves the account like every account on the platform.')}</p>
        {err && <div className="alert-item alert-danger" style={{ marginBottom: 12 }}><i className="fas fa-exclamation-circle" /><div className="alert-content">{err}</div></div>}
        <TextField label="Name" required value={v.name} onChange={set('name')} placeholder="e.g. Alice Uwase" />
        <FormRow>
          <TextField label="Email address" required type="email" value={v.email} onChange={set('email')} placeholder="alice@example.com" />
          <TextField label="Phone number (optional)" value={v.phone} onChange={set('phone')} placeholder="+250 788 000 000" />
        </FormRow>
        <div className="modal-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={invite.isPending}><i className="fas fa-paper-plane" /> {t('Send invitation')}</button>
        </div>
      </form>
    </Modal>
  );
}

function MemberDetail({ id, onClose }) {
  const { data, isLoading } = useMember(id);
  return (
    <Modal open onClose={onClose} title={data?.name || t('Data collector')} size="modal-lg">
      {isLoading || !data ? <Loading /> : (
        <>
          <p className="org-muted" style={{ marginTop: 0 }}>{data.email}{data.phone ? ` · ${data.phone}` : ''} · {t('last activity')}: {when(data.last_activity)}</p>
          <div className="org-tiles" style={{ marginBottom: 12 }}>
            <div className="org-tile"><span className="org-tile-label">{t('Entries this week')}</span><span className="org-tile-value">{formatNumber(data.week_entries)}</span></div>
            <div className="org-tile"><span className="org-tile-label">{t('Status')}</span><span className="org-tile-value" style={{ fontSize: 16 }}><Badge status={data.status} /></span></div>
          </div>
          <h4 style={{ margin: '8px 0' }}>{t('Latest entries')}</h4>
          {data.recent.length === 0 ? <p className="org-muted">{t('Nothing recorded yet.')}</p> : (
            <ul className="gh-health-hist">
              {data.recent.map((r) => <li key={`${r.path}${r.id}`}><strong>{t(r.kind)}</strong><span>{r.hint ? `${r.hint} · ` : ''}{r.date ? formatDate(r.date) : formatDate(String(r.created_at).slice(0, 10))} · {when(r.created_at)}</span></li>)}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}

export default function Team() {
  const toast = useToast();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const { data, isLoading, isError, refetch } = useTeam({ includeRemoved: showRemoved });
  const { resend, remove } = useTeamMutations();
  if (isLoading) return <Loading />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load your team" actionLabel="Retry" onAction={refetch} />;

  const onResend = async (m) => {
    try {
      const r = await resend.mutateAsync(m.id);
      toast(r.email_sent ? t('Invitation sent again to {{email}}.', { email: m.email }) : r.email_test_mode ? t('Saved (no email is sent in test mode).') : t('The email could not be sent: {{why}}', { why: r.email_error || t('unknown error') }), r.email_sent || r.email_test_mode ? 'success' : 'error');
    } catch (e) { toast(e.message, 'error'); }
  };
  const onRemove = async (m) => {
    const waiting = m.status === 'invited' || m.status === 'expired';
    const ok = await confirm(waiting
      ? t('Cancel the invitation to {{name}}?', { name: `<strong>${m.name || m.email}</strong>` })
      : t('Remove {{name}} from your team? Their access ends at once. The entries they recorded stay in your records.', { name: `<strong>${m.name || m.email}</strong>` }), { confirmLabel: waiting ? 'Cancel invitation' : 'Remove' });
    if (!ok) return;
    try { await remove.mutateAsync(m.id); toast(waiting ? t('Invitation cancelled') : t('Removed from your team')); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Your data collectors: invite them, follow what they record, and end their access whenever you need to."
        action={<button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><i className="fas fa-user-plus" /> {t('Add data collector')}</button>}
      />
      <div className="org-tiles">
        <div className="org-tile"><span className="org-tile-label">{t('Data collectors')}</span><span className="org-tile-value">{data.totals.collectors}</span></div>
        <div className="org-tile"><span className="org-tile-label">{t('Waiting for sign-in')}</span><span className="org-tile-value">{data.totals.waiting}</span></div>
        <div className="org-tile"><span className="org-tile-label">{t('Entries this week')}</span><span className="org-tile-value">{formatNumber(data.totals.entries_this_week)}</span></div>
      </div>
      <div className="gh-toolbar">
        <label className="org-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> {t('Show removed people')}</label>
      </div>
      <DataTable
        rows={data.data}
        rowKey={(r) => r.id}
        empty={<EmptyState icon="fa-user-group" title="No data collectors yet" description="Add a data collector to get help in the field. Everything they record goes into your farm, tagged with their name." actionLabel="Add data collector" onAction={() => setAdding(true)} />}
        columns={[
          { key: 'name', label: 'Name', render: (r) => <><strong>{r.name || '—'}</strong>{r.role === 'manager' ? <> <span className="badge badge-info">{t('Greenhouse manager')}</span></> : null}<div className="org-muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</div></> },
          { key: 'status', label: 'Status', render: (r) => <><Badge status={r.status} />{r.status === 'invited' && !r.email_sent && r.email_error ? <div className="org-muted" title={r.email_error}>{t('Email not sent')}</div> : null}</> },
          { key: 'week', label: 'Entries this week', render: (r) => (r.status === 'active' ? formatNumber(r.week_entries) : '—') },
          { key: 'last', label: 'Last activity', render: (r) => (r.status === 'active' ? when(r.last_activity) : r.status === 'invited' || r.status === 'expired' ? `${t('Invited')} ${when(r.invited_at)}` : '—') },
        ]}
        actions={(r) => (
          r.status === 'removed' ? null : (
            <>
              {r.status === 'active' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(r.id)}><i className="fas fa-eye" /> {t('Entries')}</button>}
              {(r.status === 'invited' || r.status === 'expired') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onResend(r)} disabled={resend.isPending}><i className="fas fa-rotate" /> {t('Send again')}</button>}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRemove(r)}>{r.status === 'active' ? t('Remove') : t('Cancel invitation')}</button>
            </>
          )
        )}
      />
      {adding && <AddForm onClose={() => setAdding(false)} />}
      {open && <MemberDetail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
