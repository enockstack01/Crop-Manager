import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const ICONS = {
  success: 'fa-check-circle',
  error: 'fa-times-circle',
  warning: 'fa-exclamation-triangle',
  info: 'fa-info-circle',
};
const COLORS = { success: '#2E7D32', error: '#D32F2F', warning: '#F9A825', info: '#1976D2' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, type = 'success', duration = 4000) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, type }]);
      if (duration) setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  const value = useMemo(() => toast, [toast]);
  const container = typeof document !== 'undefined' && document.getElementById('toast-container');

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {container &&
        createPortal(
          toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type} toast-show`}>
              <i className={`fas ${ICONS[t.type] || ICONS.info}`} style={{ color: COLORS[t.type] || COLORS.info }} />
              <span className="toast-message">{t.message}</span>
              <button className="toast-close" onClick={() => remove(t.id)}>
                <i className="fas fa-times" />
              </button>
            </div>
          )),
          container
        )}
    </ToastCtx.Provider>
  );
}
