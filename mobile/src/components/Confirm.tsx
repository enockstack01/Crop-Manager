import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { AppText } from './ui';

type ConfirmOpts = { confirmLabel?: string; danger?: boolean };
type ConfirmFn = (message: string, opts?: ConfirmOpts) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOpts & { message: string }) | null
  >(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, opts = {}) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ message, confirmLabel: opts.confirmLabel ?? 'Delete', danger: opts.danger ?? true });
    });
  }, []);

  const finish = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Sheet
        visible={!!state}
        onClose={() => finish(false)}
        title="Confirm"
        scroll={false}
        size="sm"
        footer={
          <>
            <Button title="Cancel" kind="secondary" onPress={() => finish(false)} />
            <Button
              title={state?.confirmLabel ?? 'Confirm'}
              kind={state?.danger ? 'danger' : 'primary'}
              icon={state?.danger ? 'trash-can-outline' : 'check'}
              onPress={() => finish(true)}
            />
          </>
        }
      >
        <AppText style={{ fontSize: 14, lineHeight: 22 }}>{state?.message}</AppText>
      </Sheet>
    </ConfirmCtx.Provider>
  );
}
