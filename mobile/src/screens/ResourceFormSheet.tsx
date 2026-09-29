import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { AppText } from '../components/ui';
import { useForm } from '../components/fields';
import type { ModuleConfig } from '../navigation/modules';

export function ResourceFormSheet({
  config,
  editing,
  onClose,
  onSaved,
}: {
  config: ModuleConfig;
  editing: any | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const toast = useToast();
  const { create, update } = useResourceMutations(config.resource);
  const isEdit = !!editing;

  const startValues = useMemo(() => {
    if (!isEdit) return config.initial;
    const picked: Record<string, any> = {};
    for (const key of Object.keys(config.initial)) picked[key] = editing[key] ?? config.initial[key];
    return config.fromRow ? { ...picked, ...config.fromRow(editing) } : picked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editing]);

  const form = useForm(startValues);
  const [err, setErr] = useState('');
  const saving = create.isPending || update.isPending;

  const submit = async () => {
    setErr('');
    if (config.validate) {
      const v = config.validate(form.values);
      if (v) {
        setErr(v);
        return;
      }
    }
    try {
      const payload = config.toPayload ? config.toPayload(form.values) : form.values;
      if (isEdit) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      onSaved(`${config.formTitle} ${isEdit ? 'updated' : 'added'} successfully`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
      toast(e?.message || 'Failed to save', 'error');
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} ${config.formTitle}`}
      footer={
        <>
          <Button title="Cancel" kind="secondary" onPress={onClose} />
          <Button title={`Save ${config.formTitle}`} icon="content-save" loading={saving} onPress={submit} />
        </>
      }
    >
      {err ? (
        <View style={{ backgroundColor: '#FFEBEE', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: '#D32F2F' }}>
          <AppText style={{ color: '#C62828', fontSize: 13 }}>{err}</AppText>
        </View>
      ) : null}
      {config.Form(form)}
    </Sheet>
  );
}
