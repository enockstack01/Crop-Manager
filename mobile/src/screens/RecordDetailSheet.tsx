import React from 'react';
import { Sheet } from '../components/Sheet';
import { KeyValue } from '../components/ui';
import { Button } from '../components/Button';
import type { ModuleConfig } from '../navigation/modules';
import { t } from '../i18n';

export function RecordDetailSheet({
  config,
  row,
  onClose,
  onEdit,
  canEdit = true,
}: {
  config: ModuleConfig;
  row: any;
  onClose: () => void;
  onEdit: () => void;
  canEdit?: boolean;
}) {
  return (
    <Sheet
      visible
      onClose={onClose}
      title={t('{{name}} details', { name: t(config.formTitle) })}
      footer={
        <>
          <Button title="Close" kind="secondary" onPress={onClose} />
          {canEdit ? <Button title="Edit" icon="pencil" onPress={onEdit} /> : null}
        </>
      }
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
