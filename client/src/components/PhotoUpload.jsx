import { useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { t } from '../i18n/index.js';

export function PhotoUpload({ label = 'Photo', value, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.url);
      toast('Photo uploaded');
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type="file" accept="image/*" className="form-control" onChange={handle} disabled={busy} />
      {busy && <div className="form-hint">{t('Uploading…')}</div>}
      {value && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={value}
            alt="preview"
            style={{ maxHeight: 80, borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange(null)}>
            {t('Remove')}
          </button>
        </div>
      )}
    </div>
  );
}
