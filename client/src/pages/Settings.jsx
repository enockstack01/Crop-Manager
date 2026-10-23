import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserProfile } from '@clerk/clerk-react';
import { api } from '../lib/api.js';
import { useProfile } from '../components/profile.jsx';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, Loading } from '../components/ui.jsx';
import { FormRow, SelectField, TextField } from '../components/form.jsx';
import { CURRENCY_OPTIONS } from '../lib/currencies.js';
import { ExportMenu } from '../components/ExportMenu.jsx';
import { downloadExport } from '../lib/download.js';
import { t } from '../i18n/index.js';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/index.js';
import { useChooseLanguage } from '../components/LanguageMenu.jsx';
import { useConfirm } from '../components/Confirm.jsx';
import { formatDate } from '../lib/format.js';
import { reasonText, useFarmerOrgMutations, useMyOrg } from '../lib/orgApi.js';

export default function Settings() {
  const { profile, isLoading } = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [showClerk, setShowClerk] = useState(false);
  const [values, setValues] = useState(null);
  const { i18n } = useTranslation();
  const chooseLanguage = useChooseLanguage();
  const confirm = useConfirm();
  const { farmerOrg } = useMyOrg();
  const { leave } = useFarmerOrgMutations();
  const leaveOrg = async () => {
    if (!(await confirm(t('Leave <strong>{{name}}</strong>? They will stop seeing your crop activity straight away. Your own records are not changed.', { name: farmerOrg.organization.name }), { confirmLabel: t('Leave') }))) return;
    try {
      await leave.mutateAsync();
      toast(t('You left the organization'));
    } catch (err) {
      toast(reasonText(err), 'error');
    }
  };

  const mutate = useMutation({
    mutationFn: (body) => api.put('/profile', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      toast('Profile updated successfully');
    },
    onError: (e) => toast(e.message || 'Failed to update profile', 'error'),
  });

  if (isLoading) return <Loading />;

  const current = values ?? {
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    currency: profile?.currency || 'USD',
  };
  const set = (k) => (e) => setValues({ ...current, [k]: e.target.value });
  const save = () => mutate.mutate(current);

  return (
    <>
      <PageHeader title="Profile Settings" />

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="card-header">
          <h3>
            <i className="fas fa-user" style={{ color: 'var(--primary)', marginRight: 8 }} /> {t('Personal Information')}
          </h3>
        </div>
        <div className="card-body">
          <div className="flex items-center gap-16 mb-24">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="avatar"
                style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  fontSize: 28,
                }}
              >
                <i className="fas fa-user" />
              </div>
            )}
            <div>
              <p className="font-semibold" style={{ fontSize: 14 }}>
                {t('Profile Photo & Account')}
              </p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => setShowClerk((s) => !s)}>
                {showClerk ? 'Hide' : 'Manage'} account
              </button>
            </div>
          </div>

          <FormRow>
            <TextField
              label="Full Name"
              value={current.full_name}
              onChange={set('full_name')}
              placeholder={profile?.role || 'Farmer'}
              hint={`Leave blank to be shown as “${profile?.role || 'Farmer'}”`}
            />
            <TextField label="Email" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
          </FormRow>
          <FormRow>
            <TextField label="User ID" value={profile?.public_id || ''} disabled style={{ opacity: 0.6 }} hint="Your CropManager ID: quote it when you contact support. It is printed on your reports." />
          </FormRow>
          <FormRow>
            <TextField label="Phone" value={current.phone} onChange={set('phone')} placeholder="+260 xxx xxx xxx" />
            <TextField label="Location" value={current.location} onChange={set('location')} placeholder="City, Country" />
          </FormRow>
          <FormRow>
            <SelectField
              label="Default Currency"
              value={current.currency}
              onChange={set('currency')}
              options={CURRENCY_OPTIONS}
              hint="Pre-selected when you record an amount; you can pick another currency on each record"
            />
            <TextField
              label="Account Type"
              value={profile?.role || 'Farmer'}
              disabled
              style={{ opacity: 0.6 }}
              hint="Managed by an administrator"
            />
          </FormRow>

          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary" disabled={mutate.isPending} onClick={save}>
              <i className="fas fa-save" /> {t('Save Changes')}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="card-header">
          <h3>
            <i className="fas fa-database" style={{ color: 'var(--forest)', marginRight: 8 }} /> {t('Your data')}
          </h3>
        </div>
        <div className="card-body">
          <p className="org-muted" style={{ marginBottom: 12 }}>{t('Download everything you have recorded: one sheet per kind of record in Excel, or one PDF. Each records page also has its own Export button.')}</p>
          <ExportMenu label="Export all my records" run={(format) => downloadExport('/export', { format }, `cropmanager-all-records.${format}`)} />
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="card-header">
          <h3>
            <i className="fas fa-globe" style={{ color: 'var(--forest)', marginRight: 8 }} /> {t('Language')}
          </h3>
        </div>
        <div className="card-body">
          <SelectField
            label="Interface language"
            value={i18n.language}
            onChange={(e) => chooseLanguage(e.target.value)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            hint="Also used by the mobile app when you sign in there"
          />
        </div>
      </div>

      {farmerOrg && (
        <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
          <div className="card-header">
            <h3>
              <i className="fas fa-building" style={{ color: 'var(--primary)', marginRight: 8 }} /> {t('My organization')}
            </h3>
          </div>
          <div className="card-body">
            <p><b>{farmerOrg.organization.name}</b> <span className="org-muted">· {t(farmerOrg.organization.type)}{farmerOrg.organization.district ? ` · ${farmerOrg.organization.district}` : ''}</span></p>
            <p className="org-muted" style={{ margin: '8px 0 12px' }}>
              {t('Joined {{date}}. You agreed on {{consent}} to share a summary of your crop activity: farms, crops, planting, harvests and field activity. They can see it but cannot change your records.', { date: formatDate(farmerOrg.joined_at), consent: formatDate(farmerOrg.consent_given_at) })}
            </p>
            <button className="btn btn-secondary" onClick={leaveOrg} disabled={leave.isPending}>
              <i className="fas fa-right-from-bracket" /> {t('Leave organization')}
            </button>
          </div>
        </div>
      )}

      {showClerk && (
        <div className="card" style={{ maxWidth: 900 }}>
          <div className="card-body" style={{ padding: 0 }}>
            <UserProfile routing="hash" />
          </div>
        </div>
      )}
    </>
  );
}
