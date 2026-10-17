import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { EmptyState, IconButton, Loading, PageHeader } from '../../components/ui.jsx';
import { useConfirm } from '../../components/Confirm.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDateTime } from '../../lib/format.js';
import { reasonText, useOrgLinks, useOrgMutations } from '../../lib/orgApi.js';
import { OrgGate } from './OrgGate.jsx';
import { t } from '../../i18n/index.js';

const STATUS_BADGE = { active: 'badge-success', expired: 'badge-neutral', revoked: 'badge-danger', full: 'badge-warning', inactive: 'badge-neutral' };

/** Live countdown to the moment a link stops working. */
function Countdown({ to }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((new Date(to).getTime() - now) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return <span className={`org-countdown ${s === 0 ? 'done' : ''}`}>{s === 0 ? t('Expired') : `${hh}:${mm}:${ss}`}</span>;
}

/** The link just created: shown once, with copy, WhatsApp, SMS and a QR code for field days. */
function NewLink({ link, onClose }) {
  const toast = useToast();
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(link.url, { margin: 1, width: 220, color: { dark: '#14532D', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(''));
  }, [link.url]);
  const text = `${t('Join our organization on CropManager')}: ${link.url}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.url); toast(t('Link copied')); } catch { toast(t('Could not copy. Select the link and copy it.'), 'error'); }
  };
  return (
    <div className="org-newlink">
      <div className="org-newlink-main">
        <div className="farm-profile-section">{t('New referral link')}</div>
        <input className="form-control" readOnly value={link.url} onFocus={(e) => e.target.select()} aria-label={t('Referral link')} />
        <div className="org-actions" style={{ margin: '10px 0' }}>
          <button className="btn btn-primary" onClick={copy}><i className="fas fa-copy" /> {t('Copy')}</button>
          <a className="btn btn-secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><i className="fab fa-whatsapp" /> WhatsApp</a>
          <a className="btn btn-secondary" href={`sms:?&body=${encodeURIComponent(text)}`}><i className="fas fa-message" /> SMS</a>
          <button className="btn btn-secondary" onClick={onClose}>{t('Done')}</button>
        </div>
        <p className="org-muted">
          {t('Valid for')} <Countdown to={link.expires_at} /> · {t('Up to {{count}} farmers can join with it.', { count: link.max_uses })} {t('This is the only time the full link is shown.')}
        </p>
      </div>
      {qr && <img src={qr} alt={t('QR code of the referral link')} width="180" height="180" className="org-qr" />}
    </div>
  );
}

function Body({ org, role }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: links, isLoading } = useOrgLinks(org.id);
  const { createLink, revokeLink } = useOrgMutations(org.id);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [fresh, setFresh] = useState(null);

  const create = async (e) => {
    e.preventDefault();
    try {
      setFresh(await createLink.mutateAsync({ label, max_uses: maxUses }));
      setLabel('');
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };
  const revoke = async (l) => {
    if (!(await confirm(t('Cancel this link now? Nobody can join with it afterwards.'), { confirmLabel: t('Cancel link') }))) return;
    try { await revokeLink.mutateAsync(l.id); toast(t('Link cancelled')); } catch (err) { toast(reasonText(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Referral links" subtitle="Share a link so farmers can join your organization. Each link works for six hours." />
      {fresh && <NewLink link={fresh} onClose={() => setFresh(null)} />}
      <form className="card org-form" onSubmit={create}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 220px' }}>
            <label className="form-label">{t('Label (optional)')}</label>
            <input className="form-control" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder={t('For example: Huye field day')} />
          </div>
          <div className="form-group" style={{ margin: 0, width: 170 }}>
            <label className="form-label">{t('Maximum farmers')}</label>
            <input className="form-control" type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder={t('Default')} />
          </div>
          <button className="btn btn-primary" disabled={createLink.isPending || org.status !== 'active'}>
            <i className="fas fa-link" /> {t('Generate referral link')}
          </button>
        </div>
      </form>

      {isLoading ? <Loading /> : !links?.length ? (
        <EmptyState icon="fa-link" title="No referral links yet" description="Generate a link, then share it by WhatsApp, SMS or QR code." />
      ) : (
        <div className="table-responsive" style={{ marginTop: 20 }}>
          <table className="data-table">
            <thead><tr><th>{t('Link')}</th><th>{t('Status')}</th><th>{t('Created by')}</th><th>{t('Expires')}</th><th>{t('Farmers joined')}</th>{role === 'org_admin' && <th>{t('Actions')}</th>}</tr></thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.label || t('Referral link')}</b><br /><span className="org-muted">{formatDateTime(l.created_at)}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[l.status] || 'badge-neutral'}`}>{t(l.status)}</span></td>
                  <td>{l.created_by || '—'}</td>
                  <td>{formatDateTime(l.expires_at)}{l.status === 'active' && <><br /><Countdown to={l.expires_at} /></>}</td>
                  <td>{l.use_count}{l.max_uses ? ` / ${l.max_uses}` : ''}</td>
                  {role === 'org_admin' && <td>{l.status === 'active' && <IconButton icon="fa-ban" title="Cancel link" danger onClick={() => revoke(l)} />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function OrgLinks() {
  return <OrgGate>{(p) => <Body {...p} />}</OrgGate>;
}
