import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { CameraCapture, cameraSupported } from './CameraCapture.jsx';
import { t } from '../i18n/index.js';

export const MAX_PHOTOS = 12;

/**
 * Several photos of one plant. Take as many as it needs to show every fruit once: the server joins them into one collage, and the
 * collage is what is counted and checked for disease. Each fruit must appear in one photo only, so it is not counted twice.
 */
export function MultiPhotoUpload({ label = 'Photos of the plant', value = [], onChange }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const snap = useRef(null);

  const upload = async (files) => {
    const list = Array.from(files || []).slice(0, MAX_PHOTOS - value.length);
    if (!list.length) return;
    setBusy(true);
    const added = [];
    try {
      for (const file of list) {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        added.push(data.url);
      }
      toast(added.length === 1 ? t('Photo added') : t('{{n}} photos added', { n: added.length }));
    } catch (err) {
      toast(err.message || 'Upload failed', 'error');
    } finally {
      if (added.length) onChange([...value, ...added]);
      setBusy(false);
    }
  };
  const full = value.length >= MAX_PHOTOS;

  return (
    <div className="form-group">
      <label className="form-label">{t(label)}</label>
      <div className="photo-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || full} onClick={() => (cameraSupported() ? setCamera(true) : snap.current?.click())}><i className="fas fa-camera" /> {value.length ? t('Add another photo') : t('Take photo')}</button>
        <input type="file" multiple accept="image/*,.heic,.heif,.hif,.avif,.webp,.gif,.tif,.tiff,.bmp,.jfif" className="form-control" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} disabled={busy || full} aria-label={t('Choose photos from your device')} />
      </div>
      <input ref={snap} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      {camera && <CameraCapture onClose={() => setCamera(false)} onCapture={(f) => upload([f])} />}
      {busy && <div className="form-hint">{t('Uploading…')}</div>}
      {value.length > 0 && (
        <div className="gh-multiphoto">
          {value.map((u, i) => (
            <figure key={u}>
              <img src={u} alt={`${t('Photo')} ${i + 1}`} />
              <figcaption>{i + 1}</figcaption>
              <button type="button" className="gh-multiphoto-x" onClick={() => onChange(value.filter((x) => x !== u))} aria-label={`${t('Remove')} ${t('Photo')} ${i + 1}`}><i className="fas fa-xmark" /></button>
            </figure>
          ))}
        </div>
      )}
      <div className="form-hint">
        {value.length > 1
          ? t('These {{n}} photos are joined into one picture of the plant, and that picture is counted and checked for disease.', { n: value.length })
          : t('Take as many photos as you need to show every fruit on the plant. Make sure no fruit appears in two photos, or it is counted twice.')}
      </div>
    </div>
  );
}
