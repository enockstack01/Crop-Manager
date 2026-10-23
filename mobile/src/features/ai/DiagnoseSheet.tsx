import React, { useState } from 'react';
import { View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button } from '../../components/Button';
import { PhotoSetField } from '../../components/PhotoSetField';
import { TextAreaField } from '../../components/fields';
import { useToast } from '../../components/Toast';
import { aiDiagnose, reportToText } from '../../lib/ai';
import { shareDiagnosisPdf } from '../../lib/pdfReport';
import { useProfile } from '../../lib/useResource';
import { AiDisclaimer, AiStatusBar, DiagnosisReport, ErrorNote, Thinking } from './AiBits';
import { t } from '../../i18n';

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
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      setReport((await aiDiagnose({ ...input, photo_url: photo, photo_urls: photos, symptoms })).report);
    } catch (e: any) {
      setError(e?.message || t('The AI assistant could not answer.'));
    } finally {
      setBusy(false);
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
      {busy ? <Thinking label="Looking at the photo…" /> : null}
      <ErrorNote message={error} />
      {report && !busy ? <DiagnosisReport report={report} photos={photos} /> : null}
      <AiDisclaimer />
    </Sheet>
  );
}
