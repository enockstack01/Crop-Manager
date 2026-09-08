import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserProfile } from '@clerk/clerk-react';
import { api } from '../lib/api.js';
import { useProfile } from '../components/profile.jsx';
import { useToast } from '../components/Toast.jsx';
import { PageHeader, Loading } from '../components/ui.jsx';
import { FormRow, TextField, SelectField } from '../components/form.jsx';
import { USER_ROLES } from '../lib/options.js';

export default function Settings() {
  const { profile, isLoading } = useProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [showClerk, setShowClerk] = useState(false);
  const [values, setValues] = useState(null);

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
    role: profile?.role || 'Farmer',
  };
  const set = (k) => (e) => setValues({ ...current, [k]: e.target.value });
  const save = () => mutate.mutate(current);

  return (
    <>
      <PageHeader title="Profile Settings" />

      <div className="card" style={{ maxWidth: 720, marginBottom: 20 }}>
        <div className="card-header">
          <h3>
            <i className="fas fa-user" style={{ color: 'var(--primary)', marginRight: 8 }} /> Personal Information
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
                Profile Photo & Account
              </p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => setShowClerk((s) => !s)}>
                {showClerk ? 'Hide' : 'Manage'} account
              </button>
            </div>
          </div>

          <FormRow>
            <TextField label="Full Name" required value={current.full_name} onChange={set('full_name')} />
            <TextField label="Email" value={profile?.email || ''} disabled style={{ opacity: 0.6 }} />
          </FormRow>
          <FormRow>
            <TextField label="Phone" value={current.phone} onChange={set('phone')} placeholder="+260 xxx xxx xxx" />
            <TextField label="Location" value={current.location} onChange={set('location')} placeholder="City, Country" />
          </FormRow>
          <SelectField label="Role" value={current.role} onChange={set('role')} options={USER_ROLES} />

          <div style={{ marginTop: 8 }}>
            <button className="btn btn-primary" disabled={mutate.isPending} onClick={save}>
              <i className="fas fa-save" /> Save Changes
            </button>
          </div>
        </div>
      </div>

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
