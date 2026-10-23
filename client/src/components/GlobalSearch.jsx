import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { NAV_PAGES } from './Sidebar.jsx';
import { t } from '../i18n/index.js';

/**
 * The search box in the top bar, on every page: finds pages and any of your records (names, notes,
 * crops, farms, fields...). Arrow keys move, Enter opens, Esc closes, "/" jumps to the box.
 * Picking a record opens its page with the box on that page already filled in.
 */
export function GlobalSearch({ orgUser = false }) {
  const navigate = useNavigate();
  const box = useRef(null);
  const wrap = useRef(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState([]);
  const [active, setActive] = useState(0);

  // pages whose name matches
  const pages = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return NAV_PAGES(orgUser).filter((p) => t(p.label).toLowerCase().includes(n) || p.label.toLowerCase().includes(n)).slice(0, 5);
  }, [q, orgUser]);

  useEffect(() => {
    const n = q.trim();
    if (n.length < 2 || orgUser) { setGroups([]); return undefined; }
    const ctl = new AbortController();
    setBusy(true);
    const id = setTimeout(() => {
      api.get('/search', { params: { q: n }, signal: ctl.signal })
        .then((r) => setGroups(r.data.groups || []))
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 250);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [q, orgUser]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        box.current?.focus();
      }
    };
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, []);

  // one flat list for the keyboard
  const flat = [
    ...pages.map((p) => ({ type: 'page', key: `p${p.to}`, to: p.to, title: t(p.label), icon: p.icon })),
    ...groups.flatMap((g) => g.items.map((i) => ({ type: 'record', key: `${g.kind}${i.id}`, to: `${g.route}?q=${encodeURIComponent(i.title)}`, title: i.title, subtitle: i.subtitle, group: g.label }))),
  ];
  useEffect(() => setActive(0), [q, groups.length, pages.length]);

  const go = (item) => {
    setOpen(false);
    setQ('');
    box.current?.blur();
    navigate(item.to);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); box.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && flat[active]) go(flat[active]);
  };

  const show = open && q.trim().length >= 2;
  let lastGroup = null;
  return (
    <div className="topbar-search" ref={wrap}>
      <i className={`fas ${busy ? 'fa-circle-notch fa-spin' : 'fa-search'}`} />
      <input
        ref={box}
        type="text"
        value={q}
        placeholder={t('Search...')}
        aria-label={t('Search')}
        autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <div className="search-pop" role="listbox">
          {flat.length === 0 && !busy && <div className="search-empty">{t('Nothing found for "{{q}}"', { q: q.trim() })}</div>}
          {flat.map((item, i) => {
            const head = item.type === 'page' ? (lastGroup !== 'page' ? t('Pages') : null) : (lastGroup !== item.group ? t(item.group) : null);
            lastGroup = item.type === 'page' ? 'page' : item.group;
            return (
              <div key={item.key}>
                {head && <div className="search-group">{head}</div>}
                <button type="button" role="option" aria-selected={i === active} className={`search-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
                  {item.icon && <i className={`fas ${item.icon}`} />}
                  <span className="search-title">{item.title}</span>
                  {item.subtitle && <span className="search-sub">{item.subtitle}</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
