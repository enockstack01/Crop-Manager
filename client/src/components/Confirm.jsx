import { createContext, useCallback, useContext, useState } from 'react';
import { Modal } from './Modal.jsx';

const ConfirmCtx = createContext(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback(
    (message, { confirmLabel = 'Delete', danger = true } = {}) =>
      new Promise((resolve) => {
        setState({ message, confirmLabel, danger, resolve });
      }),
    []
  );

  const finish = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => finish(false)}
        title="Confirm Action"
        size="modal-sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => finish(false)}>
              Cancel
            </button>
            <button
              className={`btn ${state?.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => finish(true)}
            >
              {state?.confirmLabel}
            </button>
          </>
        }
      >
        <p
          style={{ color: 'var(--text-light)', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: state?.message || '' }}
        />
      </Modal>
    </ConfirmCtx.Provider>
  );
}
