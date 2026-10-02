import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { CURRENCY_OPTIONS, REQUESTABLE_ACCOUNT_TYPES } from '../lib/currencies.js';
import { LeafMark } from './LeafMark.jsx';
import { FormRow, NumberField, SelectField, TextArea, TextField } from './form.jsx';

/**
 * Shown instead of the app to signed-in users whose account is not active yet:
 * the access-request form, then "request sent", or the on-hold / rejected /
 * deactivated notice. Same split-screen design as the sign-in page.
 */
export function AccountGate({ profile, onRefresh, refreshing }) {
  const status = profile.account_status || 'new';
  const [resubmit, setResubmit] = useState(false);
  const showForm = status === 'new' || (status === 'rejected' && resubmit);

  // while waiting for approval, check back every 30 s so the dashboard opens on its own
  useEffect(() => {
    if (status !== 'pending') return undefined;
    const t = setInterval(onRefresh, 30_000);
    return () => clearInterval(t);
  }, [status, onRefresh]);

  return (
    <div className="auth-split">
      <div className="auth-split-brand">
        <div className="auth-split-brand-icon">
          <LeafMark size={96} color="#fff" />
        </div>
        <h1>CropManager</h1>
        <p>
          Streamline your crop production. Track farms, fields, crop cycles, activities, harvests,
          inventory, and finances — all in one place.
        </p>
      </div>

      <div className="auth-split-form">
        <div className={`auth-split-form-wrapper${showForm ? ' account-gate-wide' : ''}`}>
          <div className="auth-split-mobile-brand" aria-hidden="true">
            <span className="auth-split-mobile-logo">
              <LeafMark size={26} color="#fff" />
            </span>
            CropManager
          </div>
          {showForm ? (
            <RequestForm profile={profile} onCancel={status === 'rejected' ? () => setResubmit(false) : null} />
          ) : (
            <StatusNotice profile={profile} onRefresh={onRefresh} refreshing={refreshing} onResubmit={() => setResubmit(true)} />
          )}
          <SignOutLink />
        </div>
      </div>
    </div>
  );
}

function SignOutLink() {
  const { signOut } = useClerk();
  return (
    <p className="subtitle auth-split-switch">
      Signed in with the wrong account?{' '}
      <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }}>Sign out</a>
    </p>
  );
}

function RequestForm({ profile, onCancel }) {
  const qc = useQueryClient();
  const { user } = useUser();
  const prev = profile.access_request || {};
  const [v, setV] = useState({
    full_name: profile.full_name || user?.fullName || '',
    phone: profile.phone || '',
    account_type: prev.account_type || 'Farmer',
    organization: prev.organization || '',
    country: prev.country || '',
    location: '',
    farm_size: prev.farm_size ?? '',
    farm_size_unit: prev.farm_size_unit || 'hectares',
    main_crops: prev.main_crops || '',
    currency: profile.currency || 'USD',
    message: prev.message || '',
  });
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = useMutation({
    mutationFn: (body) => api.post('/profile/access-request', body).then((r) => r.data),
    onSuccess: (p) => qc.setQueryData(['profile'], p),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    submit.mutate(v);
  };

  return (
    <form onSubmit={onSubmit}>
      <h2>Request your account</h2>
      <p className="subtitle">
        Tell us about you and your farm. An administrator reviews every request before the
        dashboard is unlocked.
      </p>

      {submit.isError && (
        <div className="account-gate-error">
          <i className="fas fa-circle-exclamation" /> {submit.error?.message || 'Could not send your request'}
        </div>
      )}

      <FormRow>
        <TextField
          label="Full Name"
          value={v.full_name}
          onChange={set('full_name')}
          autoComplete="name"
          placeholder={v.account_type}
          hint={`Leave blank to be shown as “${v.account_type}”`}
        />
        <TextField label="Phone" value={v.phone} onChange={set('phone')} autoComplete="tel" placeholder="+250 7xx xxx xxx" />
      </FormRow>
      <FormRow>
        <SelectField label="Account Type" required value={v.account_type} onChange={set('account_type')} options={REQUESTABLE_ACCOUNT_TYPES} />
        <SelectField label="Currency" required value={v.currency} onChange={set('currency')} options={CURRENCY_OPTIONS} hint="Used for all money values" />
      </FormRow>
      <TextField label="Farm / Organisation Name" required value={v.organization} onChange={set('organization')} placeholder="e.g. Green Valley Farm" />
      <FormRow>
        <TextField label="Country" required value={v.country} onChange={set('country')} autoComplete="country-name" />
        <TextField label="District / Town" value={v.location} onChange={set('location')} />
      </FormRow>
      <FormRow>
        <NumberField label="Farm Size" min="0" value={v.farm_size} onChange={set('farm_size')} placeholder="0" />
        <SelectField label="Unit" value={v.farm_size_unit} onChange={set('farm_size_unit')} options={['hectares', 'acres']} />
      </FormRow>
      <TextField label="Main Crops" value={v.main_crops} onChange={set('main_crops')} placeholder="e.g. Maize, beans, coffee" />
      <TextArea label="Anything else we should know?" rows={3} value={v.message} onChange={set('message')} />

      <div className="account-gate-actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submit.isPending || !v.organization.trim() || !v.country.trim()}
        >
          {submit.isPending ? <><i className="fas fa-spinner fa-spin" /> Sending...</> : <><i className="fas fa-paper-plane" /> Send request</>}
        </button>
      </div>
    </form>
  );
}

const NOTICES = {
  pending: {
    icon: 'fa-paper-plane',
    tone: 'success',
    title: 'Your request has been sent',
    body: 'Thank you! Your account request has been received and is being reviewed. Look forward to hearing from us soon — your dashboard opens as soon as an administrator approves it.',
  },
  on_hold: {
    icon: 'fa-circle-pause',
    tone: 'warning',
    title: 'Your account is on hold',
    body: 'Access to your account has been paused by an administrator. We will be in touch, or contact us for more information.',
  },
  rejected: {
    icon: 'fa-circle-xmark',
    tone: 'danger',
    title: 'Your request was not approved',
    body: 'An administrator reviewed your account request and could not approve it. You can update your details and send a new request.',
  },
  deactivated: {
    icon: 'fa-user-slash',
    tone: 'danger',
    title: 'Your account has been deactivated',
    body: 'This account can no longer access CropManager. Contact an administrator if you think this is a mistake.',
  },
};

function StatusNotice({ profile, onRefresh, refreshing, onResubmit }) {
  const n = NOTICES[profile.account_status] || NOTICES.pending;
  const submitted = profile.access_request?.submitted_at;
  return (
    <div className="account-gate-notice">
      <div className={`account-gate-icon tone-${n.tone}`}>
        <i className={`fas ${n.icon}`} />
      </div>
      <h2>{n.title}</h2>
      <p className="subtitle">{n.body}</p>

      {profile.status_reason && profile.account_status !== 'pending' && (
        <div className="account-gate-reason">
          <strong>Note from the administrator:</strong> {profile.status_reason}
        </div>
      )}

      {profile.account_status === 'pending' && submitted && (
        <div className="account-gate-summary">
          <div><span>Account type</span><strong>{profile.access_request.account_type}</strong></div>
          <div><span>Farm / organisation</span><strong>{profile.access_request.organization}</strong></div>
          <div><span>Sent</span><strong>{formatDateTime(submitted)}</strong></div>
        </div>
      )}

      <div className="account-gate-actions">
        {profile.account_status === 'rejected' && (
          <button className="btn btn-primary" onClick={onResubmit}>
            <i className="fas fa-rotate" /> Send a new request
          </button>
        )}
        <button className="btn btn-secondary" onClick={onRefresh} disabled={refreshing}>
          <i className={`fas fa-arrows-rotate${refreshing ? ' fa-spin' : ''}`} /> Check status
        </button>
      </div>
    </div>
  );
}
