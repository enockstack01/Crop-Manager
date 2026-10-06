import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Modal } from './Modal.jsx';
import { TextField } from './form.jsx';
import { t } from '../i18n/index.js';

export function OnboardingModal({ profile }) {
  const qc = useQueryClient();
  // new accounts join as Farmers; an administrator can change the role later
  const [values, setValues] = useState({ full_name: profile?.full_name || '' });

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
          <i className="fas fa-check" /> {t('Get started')}
        </button>
      }
    >
      <p style={{ color: 'var(--text-light)', marginBottom: 16, lineHeight: 1.5 }}>
        {t('Confirm your name to get started.')}
      </p>
      <TextField label="Full Name" required value={values.full_name} onChange={set('full_name')} />
    </Modal>
  );
}
