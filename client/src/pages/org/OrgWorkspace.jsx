import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState, IconButton, Loading, PageHeader } from '../../components/ui.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { reasonText, useFarmerRecords, useOrgActivity, useOrgInvites, useOrgMutations } from '../../lib/orgApi.js';
import { OrgGate } from './OrgGate.jsx';
import { t } from '../../i18n/index.js';

/* ------------------------------------------------------------- invitations */
const STATUS = { invited: ['badge-warning', 'Waiting'], joined: ['badge-success', 'Joined'], revoked: ['badge-neutral', 'Cancelled'], expired: ['badge-danger', 'Expired'] };
const RESULT = {
  joined: 'Linked now', invited: 'Invitation emailed', invited_test: 'Invitation saved (test mode, no email sent)', invite_not_sent: 'Saved, but the email could not be sent',
  invalid_email: 'Not an email address', not_a_farmer: 'Not a farmer account', already_member: 'Already a member', other_org: 'Belongs to another organization', org_limit: 'Farmer limit reached', limit_reached: 'Farmer limit reached',
};

function InvitesBody({ org }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useOrgInvites(org.id, status);
  const { inviteFarmers, resendInvite, revokeInvite } = useOrgMutations(org.id);
  const [emails, setEmails] = useState('');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    try {
      setResult(await inviteFarmers.mutateAsync({ emails, consent_confirmed: consent }));
      setEmails('');
    } catch (err) { toast(reasonText(err), 'error'); }
  };
  const resend = async (i) => {
    try { await resendInvite.mutateAsync(i.id); toast(t('Invitation sent again')); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const revoke = async (i) => {
    if (!(await confirm(t('Cancel the invitation to <strong>{{email}}</strong>?', { email: i.email }), { confirmLabel: t('Cancel invitation') }))) return;
    try { await revokeInvite.mutateAsync(i.id); toast(t('Invitation cancelled')); } catch (err) { toast(reasonText(err), 'error'); }
  };
  const counts = data?.counts || {};

  return (
    <>
      <PageHeader title="Invitations" subtitle="Invite farmers by email. People without an account get a sign-up email and join your organization when they sign in." />
      <form className="card org-form" onSubmit={send}>
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="inv-emails">{t('Email addresses (one per line, or separated by commas)')}</label>
            <textarea id="inv-emails" className="form-control" rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="farmer@example.com" />
          </div>
          <label className="org-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t('These farmers have agreed to share a summary of their crop activity with {{org}}.', { org: org.name })}
          </label>
          <div><button className="btn btn-primary" disabled={!consent || !emails.trim() || inviteFarmers.isPending || org.status !== 'active'}><i className="fas fa-paper-plane" /> {t('Send invitations')}</button></div>
        </div>
      </form>

      {result && (
        <div className="card org-form" style={{ marginTop: 12 }}>
          <div className="card-body">
            <b>{t('{{joined}} linked, {{invited}} invited', { joined: result.joined, invited: result.invited })}</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {result.rows.map((r) => <li key={r.email}>{r.email}: {t(RESULT[r.result] || r.result)}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="org-chips" style={{ marginTop: 20 }}>
        {['', 'invited', 'expired', 'joined', 'revoked'].map((s) => (
          <button key={s || 'all'} className={`farm-profile-chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s ? t(STATUS[s][1]) : t('All')}{s ? ` (${counts[s] || 0})` : ''}
          </button>
        ))}
      </div>
      {isLoading ? <Loading /> : !data?.data?.length ? (
        <EmptyState icon="fa-envelope" title="No invitations" description="Invitations you send appear here with their status." />
      ) : (
        <div className="table-responsive" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead><tr><th>{t('Email')}</th><th>{t('Status')}</th><th>{t('Sent')}</th><th>{t('Expires')}</th><th>{t('Actions')}</th></tr></thead>
            <tbody>
              {data.data.map((i) => (
                <tr key={i.id}>
                  <td><b>{i.email}</b>{i.email_error && <><br /><span className="org-muted">{t('The email could not be sent')}</span></>}</td>
                  <td><span className={`badge ${STATUS[i.status][0]}`}>{t(STATUS[i.status][1])}</span></td>
                  <td>{i.sent_count ? `${i.sent_count}× · ${formatDateTime(i.last_sent_at)}` : '—'}</td>
                  <td>{i.status === 'joined' ? formatDate(i.joined_at) : formatDate(i.expires_at)}</td>
                  <td>
                    {(i.status === 'invited' || i.status === 'expired') && <IconButton icon="fa-paper-plane" title="Send again" onClick={() => resend(i)} />}
                    {i.status === 'invited' && <IconButton icon="fa-ban" title="Cancel invitation" danger onClick={() => revoke(i)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export function OrgInvites() { return <OrgGate>{(p) => <InvitesBody {...p} />}</OrgGate>; }

/* ------------------------------------------------------------ farmer records */
const Section = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 12 }}><div className="card-body"><h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>{t(title)}</h3>{children}</div></div>
);

function FarmerBody({ org }) {
  const { farmerId } = useParams();
  const { data, isLoading, isError } = useFarmerRecords(org.id, farmerId);
  if (isLoading) return <Loading />;
  if (isError || !data) return <EmptyState icon="fa-exclamation-triangle" title="Could not load this farmer" description="The farmer may have left your organization." />;
  const none = <p className="org-muted" style={{ margin: 0 }}>{t('Nothing recorded yet.')}</p>;
  return (
    <>
      <PageHeader title={data.farmer.name} subtitle={[data.farmer.location, data.farmer.phone, data.farmer.email].filter(Boolean).join(' · ')} action={<Link className="btn btn-secondary" to="/org/farmers"><i className="fas fa-arrow-left" /> {t('Farmers')}</Link>} />
      <p className="org-muted">{t('Crop records only. Money, stock and equipment are never shared with an organization.')}</p>
      <Section title="Farms">
        {data.farms.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{data.farms.map((f) => <li key={f.id}><b>{f.name}</b> {f.district && `· ${f.district}`} · {f.hectares} ha</li>)}</ul> : none}
      </Section>
      <Section title="Crops in the field">
        {data.cycles.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{data.cycles.map((c) => <li key={c.id}><b>{c.crop}</b> · {t(c.status)} · {c.hectares} ha {c.expected_harvest_date && `· ${t('harvest')} ${formatDate(c.expected_harvest_date)}`}</li>)}</ul> : none}
      </Section>
      <Section title="Pest and disease">
        {data.scouting.length || data.protection.length ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {data.scouting.map((s, i) => <li key={`s${i}`}>{formatDate(s.date)} · {s.disease || s.pest || s.health}{s.recommendation && ` — ${s.recommendation}`}</li>)}
            {data.protection.map((p, i) => <li key={`p${i}`}>{formatDate(p.date)} · {p.name} ({t(p.type)}{p.severity && `, ${t(p.severity)}`})</li>)}
          </ul>
        ) : none}
      </Section>
      <Section title="Recent work">
        {data.activities.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{data.activities.map((a, i) => <li key={i}>{formatDate(a.date)} · {a.type}{a.description && ` — ${a.description}`}</li>)}</ul> : none}
      </Section>
      <Section title="Harvested">
        {data.harvested_kg.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{data.harvested_kg.map((h) => <li key={h.crop}><b>{h.crop}</b> · {h.kg.toLocaleString()} kg</li>)}</ul> : none}
      </Section>
    </>
  );
}
export function OrgFarmerDetail() { return <OrgGate>{(p) => <FarmerBody {...p} />}</OrgGate>; }

/* ------------------------------------------------------------------ activity */
const ACTION_TEXT = {
  'farmers.invited': 'Farmers invited', 'farmer.joined': 'A farmer joined', 'farmer.left': 'A farmer left', 'farmer.removed': 'A farmer was removed', 'farmer.records_viewed': 'A farmer\'s records were opened',
  'farmer_invite.resent': 'Invitation sent again', 'farmer_invite.revoked': 'Invitation cancelled', 'member.invited': 'Team member invited', 'member.removed': 'Team member removed', 'member.role_changed': 'Team role changed',
  'referral_link.created': 'Referral link created', 'referral_link.revoked': 'Referral link cancelled', 'organization.updated': 'Organization details changed', 'farmers.exported': 'Farmer list exported',
};

function ActivityBody({ org, role }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrgActivity(org.id, page, role === 'org_admin');
  if (role !== 'org_admin') return <EmptyState icon="fa-lock" title="Administrators only" description="Only an administrator can read the activity log." />;
  const pages = Math.max(1, Math.ceil((data?.total || 0) / 25));
  return (
    <>
      <PageHeader title="Activity" subtitle="Who did what in your organization." />
      {isLoading ? <Loading /> : !data?.data?.length ? <EmptyState icon="fa-clock-rotate-left" title="No activity yet" /> : (
        <div className="table-responsive">
          <table className="data-table">
            <thead><tr><th>{t('When')}</th><th>{t('Who')}</th><th>{t('What')}</th></tr></thead>
            <tbody>{data.data.map((a) => <tr key={a.id}><td>{formatDateTime(a.created_at)}</td><td>{a.actor || '—'}</td><td>{t(ACTION_TEXT[a.action] || a.action)}</td></tr>)}</tbody>
          </table>
          {pages > 1 && (
            <div className="org-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Previous')}</button>
              <span className="org-muted">{page} / {pages}</span>
              <button className="btn btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('Next')}</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
export function OrgActivity() { return <OrgGate>{(p) => <ActivityBody {...p} />}</OrgGate>; }
