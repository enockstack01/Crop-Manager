import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/index.js';

/**
 * Recreates the original `.modal-overlay` / `.modal` markup and behaviour
 * (overlay-click + Escape to close, body scroll lock).
 */
export function Modal({ open, onClose, title, size = '', children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay modal-active"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <h3 className="modal-title">{t(title)}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('Close')}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
