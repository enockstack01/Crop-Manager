import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useResourceMutations } from '../lib/useResource';
import { useToast } from '../components/Toast';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { AppText } from '../components/ui';
import { useForm } from '../components/fields';
import { getCurrency } from '../lib/format';
import type { ModuleConfig } from '../navigation/modules';
import { t } from '../i18n';

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
    // money records: new ones start in the user's default currency (Settings)
    const withCurrency = (v: Record<string, any>) => ('currency' in config.initial && !v.currency ? { ...v, currency: getCurrency() } : v);
    if (!isEdit) return withCurrency(config.initial);
    const picked: Record<string, any> = {};
    for (const key of Object.keys(config.initial)) picked[key] = editing[key] ?? config.initial[key];
    return withCurrency(config.fromRow ? { ...picked, ...config.fromRow(editing) } : picked);
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
      const saved: any = isEdit ? await update.mutateAsync({ id: editing.id, ...payload }) : await create.mutateAsync(payload);
      onSaved(
        saved?._offline
          ? t('{{name}} saved on this phone — it will sync when you are back online', { name: t(config.formTitle) })
          : t(isEdit ? '{{name}} updated successfully' : '{{name}} added successfully', { name: t(config.formTitle) }),
      );
    } catch (e: any) {
      setErr(e?.message || 'Failed to save');
      toast(e?.message || t('Failed to save'), 'error');
    }
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={t(isEdit ? 'Edit {{name}}' : 'Add {{name}}', { name: t(config.formTitle) })}
      footer={
        <>
          <Button title="Cancel" kind="secondary" onPress={onClose} />
          <Button title={t('Save {{name}}', { name: t(config.formTitle) })} icon="content-save" loading={saving} onPress={submit} />
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
