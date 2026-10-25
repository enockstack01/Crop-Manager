import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { CameraCapture, cameraSupported } from './CameraCapture.jsx';
import { t } from '../i18n/index.js';

/**
 * Up to `max` photos of a plant: take them with the camera or pick them from the gallery. Each is
 * uploaded to the account and the list of URLs is returned through `onChange`.
 * `autoCamera` opens the camera straight away.
 */
export function PhotoSet({ label = 'Photos of the affected plant', urls = [], onChange, max = 3, autoCamera = false }) {
  const toast = useToast();
  const pick = useRef(null);
  const snap = useRef(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const full = urls.length >= max;

  useEffect(() => { if (autoCamera) openCamera(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files) => {
    const list = [...files].slice(0, max - urls.length);
    if (!list.length) return;
    setBusy(true);
    try {
      const out = [];
      for (const file of list) {
        const form = new FormData();
        form.append('file', file);
        const { data } = await api.post('/uploads', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        out.push(data.url);
      }
      onChange([...urls, ...out]);
    } catch (err) {
      toast(err.message || t('Upload failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  function openCamera() {
    if (cameraSupported()) setCamera(true);
    else snap.current?.click(); // the phone's own camera app
  }

  return (
    <div className="form-group">
      <label className="form-label">{t(label)}</label>
      <div className="photo-set">
        {urls.map((u, i) => (
          <div className="photo-thumb" key={u}>
            <img src={u} alt={`${t('Photo')} ${i + 1}`} />
            <button type="button" aria-label={t('Remove')} onClick={() => onChange(urls.filter((x) => x !== u))}><i className="fas fa-times" /></button>
          </div>
        ))}
        {busy && <div className="photo-thumb busy"><i className="fas fa-circle-notch fa-spin" /></div>}
      </div>
      {!full && (
        <div className="photo-actions">
          <button type="button" className="btn btn-primary" onClick={openCamera} disabled={busy}><i className="fas fa-camera" /> {t('Take photo')}</button>
          <button type="button" className="btn btn-secondary" onClick={() => pick.current?.click()} disabled={busy}><i className="fas fa-image" /> {t('Choose photo')}</button>
        </div>
      )}
      <div className="form-hint">{t('Up to {{n}} photos: the sick leaf, the stem, the whole plant.', { n: max })}</div>
      <input ref={pick} type="file" accept="image/*,.heic,.heif,.hif,.avif,.webp,.gif,.tif,.tiff,.bmp,.jfif,.svg" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      <input ref={snap} type="file" accept="image/*,.heic,.heif,.hif,.avif,.webp,.gif,.tif,.tiff,.bmp,.jfif,.svg" capture="environment" hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      {camera && <CameraCapture onClose={() => setCamera(false)} onCapture={(file) => upload([file])} />}
    </div>
  );
}
