import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { TextArea } from '../../components/form.jsx';
import { useToast } from '../../components/Toast.jsx';
import { useAdminUserMutations } from '../../lib/useAdmin.js';

/** Account lifecycle labels (server: models/system.models.js ACCOUNT_STATUSES). */
export const STATUS_META = {
  new: { label: 'No request yet', badge: 'badge-neutral' },
  pending: { label: 'Pending approval', badge: 'badge-warning' },
  active: { label: 'Active', badge: 'badge-success' },
  on_hold: { label: 'On hold', badge: 'badge-info' },
  rejected: { label: 'Rejected', badge: 'badge-danger' },
  deactivated: { label: 'Deactivated', badge: 'badge-danger' },
};

export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.new;
  return <span className={`badge ${m.badge}`}>{m.label}</span>;
}

export const ACTIONS = {
  approve: { status: 'active', label: 'Approve', icon: 'fa-circle-check', color: 'var(--green)', btn: 'btn-primary', done: 'Account approved' },
  reject: { status: 'rejected', label: 'Reject', icon: 'fa-circle-xmark', color: 'var(--red)', btn: 'btn-danger', reason: true, done: 'Request rejected' },
  hold: { status: 'on_hold', label: 'Put on hold', icon: 'fa-circle-pause', color: 'var(--orange)', btn: 'btn-secondary', reason: true, done: 'Account put on hold' },
  activate: { status: 'active', label: 'Activate', icon: 'fa-user-check', color: 'var(--green)', btn: 'btn-primary', done: 'Account activated' },
  reactivate: { status: 'active', label: 'Re-activate', icon: 'fa-rotate-left', color: 'var(--green)', btn: 'btn-primary', done: 'Account re-activated' },
  deactivate: { status: 'deactivated', label: 'Deactivate', icon: 'fa-user-slash', color: 'var(--red)', btn: 'btn-secondary', reason: true, done: 'Account deactivated' },
};

/** Which actions make sense for an account in each status. */
export function actionsFor(status) {
  switch (status) {
    case 'pending': return ['approve', 'reject', 'hold'];
    case 'active': return ['hold', 'deactivate'];
    case 'on_hold': return ['activate', 'deactivate'];
    case 'rejected': return ['approve'];
    case 'deactivated': return ['reactivate'];
    default: return ['approve'];
  }
}

/**
 * Confirm-and-run for account status changes. `start(user, actionKey)` opens a small
 * dialog (with an optional note for the user on reject / hold / deactivate);
 * render `dialog` somewhere in the page.
 */
export function useAccountActions() {
  const toast = useToast();
  const { update } = useAdminUserMutations();
  const [pending, setPending] = useState(null); // { user, key }
  const [reason, setReason] = useState('');

  const close = () => setPending(null);
  const start = (user, key) => {
    setReason('');
    setPending({ user, key });
  };
  const run = async () => {
    const { user, key } = pending;
    const a = ACTIONS[key];
    try {
      await update.mutateAsync({ userId: user.user_id, account_status: a.status, reason: reason.trim() });
      toast(a.done);
      close();
    } catch (e) {
      toast(e.message || 'Failed', 'error');
    }
  };

  const a = pending && ACTIONS[pending.key];
  const name = pending && (pending.user.full_name || pending.user.email || pending.user.user_id);
  const dialog = (
    <Modal
      open={!!pending}
      onClose={close}
      title={a ? `${a.label} account` : ''}
      footer={
        a && (
          <>
            <button className="btn btn-secondary" onClick={close}>Cancel</button>
            <button className={`btn ${a.btn}`} onClick={run} disabled={update.isPending}>
              <i className={`fas ${update.isPending ? 'fa-spinner fa-spin' : a.icon}`} /> {a.label}
            </button>
          </>
        )
      }
    >
      {a && (
        <>
          <p style={{ marginBottom: a.reason ? 16 : 0, lineHeight: 1.5 }}>
            {a.label} the account of <strong>{name}</strong>?{' '}
            {a.status === 'active'
              ? 'They will be able to use the dashboard straight away.'
              : 'They will no longer be able to open the dashboard.'}{' '}
            They are notified of the change.
          </p>
          {a.reason && (
            <TextArea
              label="Note to the user (optional)"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. We need more details about your farm"
            />
          )}
        </>
      )}
    </Modal>
  );

  return { start, dialog };
}
