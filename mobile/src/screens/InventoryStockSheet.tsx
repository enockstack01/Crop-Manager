import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { writeOrQueue } from '../lib/useResource';
import { formatNumber } from '../lib/format';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { AppText } from '../components/ui';
import { NumberField, TextAreaField } from '../components/fields';
import { t } from '../i18n';

export function InventoryStockSheet({
  item,
  type,
  onClose,
}: {
  item: any;
  type: 'in' | 'out';
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');

  const mutate = useMutation({
    networkMode: 'always',
    // offline: queued and applied to the cached stock level until it syncs
    mutationFn: () =>
      writeOrQueue(
        qc,
        { method: 'post', url: `/inventory-items/${item.id}/stock`, resource: 'inventory-items', body: { type, quantity: Number(qty), notes } },
        () => {
          const delta = (type === 'in' ? 1 : -1) * Number(qty);
          const apply = (r: any) => (r?.id === item.id ? { ...r, current_quantity: Number(r.current_quantity || 0) + delta, _offline: true } : r);
          qc.setQueriesData({ queryKey: ['inventory-items'] }, (old: any) =>
            !old ? old : Array.isArray(old) ? old.map(apply) : Array.isArray(old.data) ? { ...old, data: old.data.map(apply) } : apply(old));
        },
      ),
    onSuccess: (res: any) => {
      if (!res?._offline) {
        qc.invalidateQueries({ queryKey: ['inventory-items'] });
        qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
      toast(t(type === 'in' ? 'Added {{qty}}' : 'Removed {{qty}}', { qty: `${qty} ${item.unit || ''}`.trim() }));
      onClose();
    },
    onError: (e: any) => toast(e?.message || 'Failed', 'error'),
  });

  return (
    <Sheet
      visible
      onClose={onClose}
      title={type === 'in' ? 'Stock In' : 'Stock Out'}
      footer={
        <>
          <Button title="Cancel" kind="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            title="Confirm"
            loading={mutate.isPending}
            onPress={() => Number(qty) > 0 && mutate.mutate()}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <AppText variant="subtitle">
        {t('Current stock:')} <AppText weight="700">{formatNumber(item.current_quantity)} {item.unit}</AppText>
      </AppText>
      <NumberField
        label={`Quantity to ${type === 'in' ? 'add' : 'remove'}`}
        required
        value={qty}
        onChangeValue={setQty}
      />
      <TextAreaField label="Notes" value={notes} onChangeValue={setNotes} />
    </Sheet>
  );
}
