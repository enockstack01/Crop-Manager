import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api.js';
import { LANGUAGES, setLanguage, t } from '../i18n/index.js';

/** Switch the interface language and save it on the profile, so the mobile app
 *  follows it too. */
export function useChooseLanguage() {
  const qc = useQueryClient();
  return (code) => {
    // keep the cached profile in step, or the app would switch straight back
    qc.setQueryData(['profile'], (p) => (p ? { ...p, language: code } : p));
    api.put('/profile', { language: code }).catch(() => {});
    setLanguage(code);
  };
}

/** Globe button + menu of interface languages. */
export function LanguageMenu({ className = 'topbar-btn topbar-lang' }) {
  const { i18n } = useTranslation();
  const chooseLanguage = useChooseLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (code) => {
    setOpen(false);
    chooseLanguage(code);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className={className}
        title={t('Language')}
        aria-label={t('Language')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <i className="fas fa-globe" />
        <span className="lang-code">{i18n.language.toUpperCase()}</span>
      </button>
      <div className={`dropdown-menu lang-menu ${open ? 'dropdown-active' : ''}`} role="menu">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            role="menuitemradio"
            aria-checked={i18n.language === l.code}
            className={`lang-option${i18n.language === l.code ? ' active' : ''}`}
            onClick={() => choose(l.code)}
          >
            {l.label}
            {i18n.language === l.code && <i className="fas fa-check" />}
          </button>
        ))}
      </div>
    </div>
  );
}
