import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { AppText } from '../components/ui';
import { NumberField, TextAreaField } from '../components/fields';

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
    mutationFn: () => api.post(`/inventory-items/${item.id}/stock`, { type, quantity: Number(qty), notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${type === 'in' ? 'Added' : 'Removed'} ${qty} ${item.unit}`);
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
        Current stock: <AppText weight="700">{formatNumber(item.current_quantity)} {item.unit}</AppText>
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
