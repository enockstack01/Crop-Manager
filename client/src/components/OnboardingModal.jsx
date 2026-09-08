import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Modal } from './Modal.jsx';
import { SelectField, TextField } from './form.jsx';

const ROLES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager', 'Administrator'];

export function OnboardingModal({ profile }) {
  const qc = useQueryClient();
  const [values, setValues] = useState({
    full_name: profile?.full_name || '',
    role: profile?.role || 'Farmer',
    phone: profile?.phone || '',
    location: profile?.location || '',
  });

  const save = useMutation({
    mutationFn: (body) => api.put('/profile', { ...body, onboarded: true }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });

  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Modal
      open
      onClose={() => {}}
      title="Welcome to CropManager"
      size="modal-lg"
      footer={
        <button
          className="btn btn-primary"
          disabled={save.isPending || !values.full_name.trim()}
          onClick={() => save.mutate(values)}
        >
          <i className="fas fa-check" /> Get started
        </button>
      }
    >
      <p style={{ color: 'var(--text-light)', marginBottom: 16, lineHeight: 1.5 }}>
        Tell us a little about yourself. You can change this anytime under Settings.
      </p>
      <div className="form-row">
        <TextField label="Full Name" required value={values.full_name} onChange={set('full_name')} />
        <SelectField label="Role" value={values.role} onChange={set('role')} options={ROLES} />
      </div>
      <div className="form-row">
        <TextField label="Phone" value={values.phone} onChange={set('phone')} placeholder="+260 xxx xxx xxx" />
        <TextField label="Location" value={values.location} onChange={set('location')} placeholder="City, Country" />
      </div>
    </Modal>
  );
}
