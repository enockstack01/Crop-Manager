import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast.jsx';
import { PERIODS, periodRange } from '../lib/period.js';
import { t } from '../i18n/index.js';

const FORMATS = [
  { id: 'pdf', label: 'PDF document', icon: 'fa-file-pdf' },
  { id: 'xlsx', label: 'Excel workbook (.xlsx)', icon: 'fa-file-excel' },
  { id: 'csv', label: 'CSV (spreadsheet text)', icon: 'fa-file-csv' },
];

/**
 * "Export" button: pick the recording period (everything by default), then PDF, Excel or CSV.
 * `run(format, { from, to })` does the download; the period is empty for "All time".
 * Reports pass `period={false}` because they already have their own date filters.
 */
export function ExportMenu({ run, disabled = false, label = 'Export', formats = FORMATS, period = true }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [choice, setChoice] = useState('all');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const box = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const range = periodRange(choice, custom);
  const badCustom = choice === 'custom' && range.from && range.to && range.from > range.to;

  const go = async (f) => {
    if (badCustom) { toast(t('The start of the period is after its end.'), 'error'); return; }
    setOpen(false);
    setBusy(f.id);
    try {
      await run(f.id, range);
    } catch (err) {
      toast(err.message || t('Could not export'), 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="export-menu" ref={box}>
      <button type="button" className="btn btn-secondary" disabled={disabled || !!busy} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <i className={`fas ${busy ? 'fa-circle-notch fa-spin' : 'fa-download'}`} /> {t(label)} <i className="fas fa-caret-down" />
      </button>
      {open && (
        <div className="export-pop" role="menu">
          {period && (
            <div className="export-period">
              <label className="export-period-label" htmlFor="export-period">{t('Recording period')}</label>
              <select id="export-period" className="form-control" value={choice} onChange={(e) => setChoice(e.target.value)}>
                {PERIODS.map((p) => <option key={p.id} value={p.id}>{t(p.label)}</option>)}
              </select>
              {choice === 'custom' && (
                <div className="export-period-dates">
                  <input type="date" className="form-control" value={custom.from} max={custom.to || undefined} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label={t('From')} />
                  <input type="date" className="form-control" value={custom.to} min={custom.from || undefined} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label={t('To')} />
                </div>
              )}
              {choice !== 'all' && range.from && range.to && <div className="export-period-hint">{range.from} → {range.to}</div>}
            </div>
          )}
          {formats.map((f) => (
            <button type="button" role="menuitem" key={f.id} onClick={() => go(f)}><i className={`fas ${f.icon}`} /> {t(f.label)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
