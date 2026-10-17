import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';
import { PhotoUpload } from '../../components/PhotoUpload.jsx';
import { aiDiagnose, reportToText } from '../../lib/ai.js';
import { AiDisclaimer, AiStatusBar, DiagnosisReport, Thinking } from './AiBits.jsx';
import { t } from '../../i18n/index.js';

/**
 * Crop scouting diagnosis: photo + notes in, a report out (cause, treatment, medication,
 * how to give it). `input` holds what the scouting record already says; `onUse(text)` is
 * called with the report as text so the caller can save it as the record's recommendation.
 */
export function DiagnoseModal({ open, onClose, input = {}, onUse, useLabel = 'Use as recommendation' }) {
  const toast = useToast();
  const [photo, setPhoto] = useState(input.photo_url || null);
  const [symptoms, setSymptoms] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const { report: r } = await aiDiagnose({ ...input, photo_url: photo, symptoms });
      setReport(r);
    } catch (err) {
      setError(err.message || t('The AI assistant could not answer.'));
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    try {
      await onUse?.(reportToText(report, t));
      toast(t('Report saved as the recommendation'));
      onClose();
    } catch (err) {
      toast(err.message || t('Failed to save'), 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Diagnose with AI"
      size="modal-lg"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>{t('Close')}</button>
          {report && onUse && <button className="btn btn-primary" onClick={use}><i className="fas fa-check" /> {t(useLabel)}</button>}
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            <i className="fas fa-wand-magic-sparkles" /> {report ? t('Diagnose again') : t('Diagnose')}
          </button>
        </>
      }
    >
      <AiStatusBar />
      <PhotoUpload label="Photo of the affected plant" value={photo} onChange={setPhoto} />
      <div className="form-group">
        <label className="form-label">{t('What do you see? (optional)')}</label>
        <textarea
          className="form-control"
          rows={3}
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder={t('For example: yellow spots on the lower leaves, spreading after rain')}
        />
      </div>
      {busy && <Thinking label="Looking at the photo…" />}
      {error && <div className="auth-message error show" role="alert">{error}</div>}
      {report && !busy && <DiagnosisReport report={report} photo={photo} />}
      <AiDisclaimer />
    </Modal>
  );
}
