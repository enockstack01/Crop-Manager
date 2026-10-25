import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { CameraCapture, cameraSupported } from './CameraCapture.jsx';
import { t } from '../i18n/index.js';

export function PhotoUpload({ label = 'Photo', value, onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const snap = useRef(null);

  const upload = async (file) => {
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
      <div className="photo-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => (cameraSupported() ? setCamera(true) : snap.current?.click())}><i className="fas fa-camera" /> {t('Take photo')}</button>
        <input type="file" accept="image/*,.heic,.heif,.hif,.avif,.webp,.gif,.tif,.tiff,.bmp,.jfif,.svg" className="form-control" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
      </div>
      <input ref={snap} type="file" accept="image/*,.heic,.heif,.hif,.avif,.webp,.gif,.tif,.tiff,.bmp,.jfif,.svg" capture="environment" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      {camera && <CameraCapture onClose={() => setCamera(false)} onCapture={upload} />}
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
