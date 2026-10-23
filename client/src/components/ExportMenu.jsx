import { useEffect, useRef, useState } from 'react';
import { useToast } from './Toast.jsx';
import { t } from '../i18n/index.js';

const FORMATS = [
  { id: 'pdf', label: 'PDF document', icon: 'fa-file-pdf' },
  { id: 'xlsx', label: 'Excel workbook (.xlsx)', icon: 'fa-file-excel' },
  { id: 'csv', label: 'CSV (spreadsheet text)', icon: 'fa-file-csv' },
];

/**
 * "Export" button with a PDF / Excel / CSV choice. `run(format)` does the download.
 * Used on every records page and on the reports.
 */
export function ExportMenu({ run, disabled = false, label = 'Export', formats = FORMATS }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const box = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = async (f) => {
    setOpen(false);
    setBusy(f.id);
    try {
      await run(f.id);
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
          {formats.map((f) => (
            <button type="button" role="menuitem" key={f.id} onClick={() => go(f)}><i className={`fas ${f.icon}`} /> {t(f.label)}</button>
          ))}
        </div>
      )}
    </div>
  );
}
