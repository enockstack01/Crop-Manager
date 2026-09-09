import React from 'react';
import { Sheet } from '../components/Sheet';
import { KeyValue } from '../components/ui';
import { Button } from '../components/Button';
import type { ModuleConfig } from '../navigation/modules';

export function RecordDetailSheet({
  config,
  row,
  onClose,
  onEdit,
}: {
  config: ModuleConfig;
  row: any;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${config.formTitle} details`}
      footer={<Button title="Edit" icon="pencil" onPress={onEdit} style={{ flex: 1 }} />}
    >
      {config.detail(row)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([label, value]) => (
          <KeyValue key={label} label={label}>
            {value}
          </KeyValue>
        ))}
    </Sheet>
  );
}
