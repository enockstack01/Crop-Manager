import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { reasonText, useFarmerOrgMutations } from '../lib/orgApi.js';
import { FormRow, SelectField, TextField } from '../components/form.jsx';
import { t } from '../i18n/index.js';

const TYPES = ['Cooperative', 'NGO', 'Company', 'Government', 'Other'];
export const ORG_INTENT = 'org_intent';

function Form() {
  const navigate = useNavigate();
  const { register } = useFarmerOrgMutations();
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then((r) => r.data) });
  const [v, setV] = useState({ name: '', type: 'Cooperative', country: 'Rwanda', district: '', sector: '', contact_email: '', contact_phone: '', full_name: '', phone: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register.mutateAsync({ ...v, contact_email: v.contact_email || profile?.email || '' });
      try { localStorage.removeItem(ORG_INTENT); } catch { /* storage unavailable */ }
      navigate('/org', { replace: true });
    } catch (err) {
      setError(reasonText(err));
    }
  };

  return (
    <div className="org-page">
      <form className="org-card org-card-wide" onSubmit={submit}>
        <div className="org-brand">
          <img src="/brand/cropmanager-icon.png" alt="" width="44" height="44" />
          <div>
            <strong>CropManager</strong>
            <small>by Agricoders</small>
          </div>
        </div>
        <h1>{t('Register your organization')}</h1>
        <p className="org-muted">
          {t('Cooperatives, NGOs, companies and programmes bring their farmers onto CropManager with referral links and see a summary of their crop activity. A CropManager administrator approves each organization before it can invite farmers.')}
        </p>

        <TextField label="Organization name" required value={v.name} onChange={set('name')} />
        <FormRow>
          <SelectField label="Type" value={v.type} onChange={set('type')} options={TYPES} />
          <TextField label="Country" value={v.country} onChange={set('country')} />
        </FormRow>
        <FormRow>
          <TextField label="District" value={v.district} onChange={set('district')} />
          <TextField label="Sector" value={v.sector} onChange={set('sector')} />
        </FormRow>
        <FormRow>
          <TextField label="Contact email" type="email" value={v.contact_email} onChange={set('contact_email')} placeholder={profile?.email || ''} />
          <TextField label="Contact phone" value={v.contact_phone} onChange={set('contact_phone')} />
        </FormRow>
        <FormRow>
          <TextField label="Your name" required value={v.full_name} onChange={set('full_name')} />
          <TextField label="Your phone" value={v.phone} onChange={set('phone')} />
        </FormRow>

        {error && <div className="auth-message error show" role="alert">{error}</div>}
        <div className="org-actions">
          <button className="btn btn-primary btn-lg" disabled={register.isPending || !v.name.trim() || !v.full_name.trim()}>
            {register.isPending ? t('Sending…') : t('Register organization')}
          </button>
        </div>
      </form>
    </div>
  );
}

function ToSignUp() {
  try { localStorage.setItem(ORG_INTENT, '1'); } catch { /* storage unavailable */ }
  return <Navigate to="/sign-up" replace />;
}

/** Signed-out visitors sign up first (Clerk), then land back here to fill in the organization. */
export default function OrgRegister() {
  return (
    <>
      <SignedIn><Form /></SignedIn>
      <SignedOut><ToSignUp /></SignedOut>
    </>
  );
}
