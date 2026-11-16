import { useState } from 'react';
import { FormRow, NumberField } from './form.jsx';
import { readPosition, coordinateError } from '../lib/fieldLocation.js';
import { t } from '../i18n/index.js';

/**
 * The exact point of a field, asked every time a field is recorded. The position of the device is NEVER taken by itself: the person is asked
 * whether they are standing in the field. If yes, the device position is read when they press the button and put in the boxes; if no, they
 * type the field's own coordinates. The two boxes are required either way, and the weather for the field is read at that point.
 */
export function FieldLocation({ values, set, bind }) {
  const hasPoint = coordinateError(values.latitude, values.longitude) === null;
  const [mode, setMode] = useState(null); // 'here' | 'typed' | null (not chosen yet)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [accuracy, setAccuracy] = useState(null);

  const capture = async () => {
    setBusy(true);
    setMsg('');
    try {
      const p = await readPosition();
      set('latitude', String(p.lat));
      set('longitude', String(p.lon));
      setAccuracy(p.accuracy);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (m) => {
    setMode(m);
    setMsg('');
    setAccuracy(null);
  };

  return (
    <div className="field-location">
      <div className="fl-title"><i className="fas fa-location-dot" /> {t('Exact location of the field')} <span className="required">*</span></div>
      <p className="fl-lead">{t('The weather for this field is read at its exact point, so the coordinates are required.')}</p>

      <div className="fl-ask" role="group" aria-label={t('Are you standing in the field right now?')}>
        <strong>{t('Are you standing in the field right now?')}</strong>
        <div className="fl-choices">
          <button type="button" className={`btn ${mode === 'here' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={mode === 'here'} onClick={() => choose('here')}>
            <i className="fas fa-street-view" /> {t('Yes, I am in the field')}
          </button>
          <button type="button" className={`btn ${mode === 'typed' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={mode === 'typed'} onClick={() => choose('typed')}>
            <i className="fas fa-keyboard" /> {t('No, I will type the coordinates')}
          </button>
        </div>
      </div>

      {mode === 'here' && (
        <div className="fl-here">
          <p className="fl-help">{t('Stand in the middle of the field, then press the button. Your position now is saved as the position of the field.')}</p>
          <button type="button" className="btn btn-primary" onClick={capture} disabled={busy}>
            <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`} /> {busy ? t('Finding your position...') : accuracy != null ? t('Measure again') : t('Use my exact position now')}
          </button>
          {accuracy != null && (
            <p className={`fl-help ${accuracy > 100 ? 'fl-warn' : ''}`}>
              {accuracy > 100
                ? t('The position is only accurate to about {{m}} metres. Go to open ground and measure again, or type the coordinates.', { m: accuracy })
                : t('Position found, accurate to about {{m}} metres.', { m: accuracy })}
            </p>
          )}
        </div>
      )}
      {mode === 'typed' && (
        <p className="fl-help">{t('Type the exact latitude and longitude of the field, for example -1.950000 and 30.060000. In a maps app, press and hold on the field and copy the two numbers.')}</p>
      )}
      {mode === null && hasPoint && <p className="fl-help">{t('These are the saved coordinates of the field. To change them, answer the question above.')}</p>}
      {msg && <p className="fl-help fl-warn" role="alert">{msg}</p>}

      <FormRow>
        <NumberField label="Latitude" required {...bind('latitude')} step="0.000001" placeholder="-1.950000" />
        <NumberField label="Longitude" required {...bind('longitude')} step="0.000001" placeholder="30.060000" />
      </FormRow>
    </div>
  );
}
