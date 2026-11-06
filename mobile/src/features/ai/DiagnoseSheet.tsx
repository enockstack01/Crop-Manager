import React, { useRef, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { PhotoSetField } from '../../components/PhotoSetField';
import { TextAreaField } from '../../components/fields';
import { useToast } from '../../components/Toast';
import { aiDiagnose, reportToText } from '../../lib/ai';
import { shareDiagnosisPdf } from '../../lib/pdfReport';
import { useProfile } from '../../lib/useResource';
import { AiDisclaimer, AiStatusBar, DetectionCard, DiagnosisReport, ErrorNote, OfflineResult, Thinking } from './AiBits';
import { OfflineNote } from './OfflineNote';
import { isLocalPhoto, localPhotoFor } from '../../components/PhotoSetField';
import { t } from '../../i18n';

/** How long to wait for the server before also checking the photo with the model on the phone. */
const OFFLINE_AFTER_MS = 8000;

/** Scouting diagnosis: photo + notes in, report out. `onUse(text)` saves it as the recommendation. */
export function DiagnoseSheet({ visible, onClose, input, onUse, autoCamera = false }: {
  visible: boolean; onClose: () => void; input: Record<string, any>; onUse?: (text: string) => void | Promise<void>; autoCamera?: boolean;
}) {
  const toast = useToast();
  const [photos, setPhotos] = useState<string[]>(input.photo_url ? [input.photo_url] : []);
  const photo = photos[0] || null;
  const [symptoms, setSymptoms] = useState('');
  const { profile } = useProfile();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [detection, setDetection] = useState<any>(null);
  const [offline, setOffline] = useState<any>(null);
  const runId = useRef(0);
  const [error, setError] = useState('');

  /**
   * Asks the server first (photo model, then the AI report). With no connection, or when the server has not answered
   * within a few seconds, the photo is also checked with the model on the phone and shown as an offline result; a
   * report from the server that arrives later replaces it.
   */
  const run = async () => {
    const me = ++runId.current;
    const live = () => runId.current === me;
    setBusy(true);
    setError('');
    setReport(null);
    setDetection(null);
    setOffline(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const local = photo ? localPhotoFor(photo) : null;
    const checkOnPhone = async () => {
      if (!local) return false;
      try {
        const { diagnoseOffline } = await import('../../ml/offline'); // loaded only when needed: the model code is large
        const r = await diagnoseOffline(local);
        if (live()) setOffline(r);
        return true;
      } catch {
        if (live()) setError(t('The phone could not run the offline check. Connect to the internet and try again.'));
        return false;
      }
    };
    try {
      // a photo taken with no signal exists only on the phone: the server cannot see it
      if (photo && (isLocalPhoto(photo) || !onlineManager.isOnline())) {
        if (local) await checkOnPhone();
        else setError(t('No connection. Connect to the internet and try again.'));
        return;
      }
      if (local) timer = setTimeout(checkOnPhone, OFFLINE_AFTER_MS);
      const r = await aiDiagnose({ ...input, photo_url: photo, photo_urls: photos, symptoms });
      if (!live()) return;
      setOffline(null);
      setReport(r.report);
      setDetection(r.detection || null);
    } catch (e: any) {
      if (!live()) return;
      if (e?.network && local) await checkOnPhone();
      else setError(e?.message || t('The AI assistant could not answer.'));
    } finally {
      if (timer) clearTimeout(timer);
      if (live()) setBusy(false);
    }
  };
  const pdf = async () => {
    setPdfBusy(true);
    try {
      await shareDiagnosisPdf(report, { photoUrl: photo, crop: input.crop, owner: [profile?.full_name, profile?.public_id].filter(Boolean).join(' · ') });
    } catch (e: any) {
      toast(e?.message || t('Could not create the PDF'), 'error');
    } finally {
      setPdfBusy(false);
    }
  };
  const use = async () => {
    try {
      await onUse?.(reportToText(report));
      toast(t('Report saved as the recommendation'));
      onClose();
    } catch (e: any) {
      toast(e?.message || t('Failed to save'), 'error');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Diagnose with AI"
      footer={
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {report ? <Button title="Download PDF" icon="file-pdf" kind="secondary" loading={pdfBusy} onPress={pdf} /> : null}
          {report && onUse ? <Button title="Use as recommendation" icon="check" kind="secondary" onPress={use} /> : null}
          <Button title={report ? 'Diagnose again' : 'Diagnose'} icon="wand-magic-sparkles" loading={busy} onPress={run} />
        </View>
      }
    >
      <AiStatusBar />
      <PhotoSetField urls={photos} onChange={setPhotos} autoCamera={autoCamera && visible} />
      <TextAreaField
        label="What do you see? (optional)"
        value={symptoms}
        onChangeValue={setSymptoms}
        placeholder="For example: yellow spots on the lower leaves, spreading after rain"
      />
      {busy ? <Thinking label={offline ? 'Waiting for the AI assistant…' : 'Looking at the photo…'} /> : null}
      {offline && !report ? <OfflineResult result={offline} waiting={busy} /> : null}
      {offline && !report ? <OfflineNote result={offline} notes={symptoms} auto /> : null}
      <ErrorNote message={error} />
      {report && !busy ? <DetectionCard detection={detection} hasPhoto={photos.length > 0} /> : null}
      {report && !busy ? <DiagnosisReport report={report} photos={photos} /> : null}
      <AiDisclaimer />
    </Sheet>
  );
}
