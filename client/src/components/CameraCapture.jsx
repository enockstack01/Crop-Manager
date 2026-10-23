import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/index.js';

/**
 * Live camera in the browser: opens the back camera (front camera on a laptop), shows a preview, takes a
 * still and hands it back as a JPEG File. Falls back to the device's own camera app through a file input
 * when the browser cannot open the camera (no permission, plain http, no camera).
 */
export const cameraSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

export function CameraCapture({ onCapture, onClose }) {
  const video = useRef(null);
  const stream = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [error, setError] = useState('');
  const [shot, setShot] = useState(null); // { url, blob }
  const [many, setMany] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let dead = false;
    setError('');
    stop();
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then(async (s) => {
        if (dead) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setMany(devices.filter((d) => d.kind === 'videoinput').length > 1);
      })
      .catch((e) => setError(e?.name === 'NotAllowedError' ? t('Camera permission was refused. Allow the camera for this site in your browser, or choose a photo instead.') : t('The camera could not be opened. Choose a photo instead.')));
    return () => { dead = true; stop(); };
  }, [facing, stop]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => { if (shot?.url) URL.revokeObjectURL(shot.url); }, [shot]);

  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const scale = Math.min(1, 1600 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => { if (blob) setShot({ blob, url: URL.createObjectURL(blob) }); }, 'image/jpeg', 0.88);
  };

  const use = () => {
    onCapture(new File([shot.blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    onClose();
  };

  return createPortal(
    <div className="modal-overlay modal-active" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal camera-modal">
        <div className="modal-header">
          <h3 className="modal-title">{t('Take a photo')}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('Close')}><i className="fas fa-times" /></button>
        </div>
        <div className="modal-body">
          {error ? <div className="auth-message error show" role="alert">{error}</div> : (
            <div className="camera-stage">
              {shot ? <img src={shot.url} alt={t('Photo taken')} /> : <video ref={video} playsInline muted />}
            </div>
          )}
          <p className="form-hint">{t('Fill the frame with the sick part of the plant (leaf, stem or fruit), in good light and in focus.')}</p>
        </div>
        <div className="modal-footer">
          {shot ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShot(null)}><i className="fas fa-redo" /> {t('Retake')}</button>
              <button type="button" className="btn btn-primary" onClick={use}><i className="fas fa-check" /> {t('Use this photo')}</button>
            </>
          ) : (
            <>
              {many && <button type="button" className="btn btn-secondary" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}><i className="fas fa-sync-alt" /> {t('Switch camera')}</button>}
              <button type="button" className="btn btn-primary" onClick={snap} disabled={!!error}><i className="fas fa-camera" /> {t('Take photo')}</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
