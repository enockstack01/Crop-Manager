import React from 'react';
import { useAll } from '../lib/useResource';
import { FormApi, SelectField } from './fields';

export function useFarmOptions() {
  const { items } = useAll('farms');
  return items.map((f: any) => ({ value: f.id, label: f.name }));
}

export function useCropOptions() {
  const { items } = useAll('crops');
  return items.map((c: any) => ({ value: c.id, label: c.name }));
}

export function useSeasonOptions() {
  const { items } = useAll('seasons');
  return items.map((s: any) => ({ value: s.id, label: s.name }));
}

export function useCycleOptions() {
  const { items } = useAll('crop-cycles');
  return items.map((c: any) => ({
    value: c.id,
    label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}${c.seasons?.name ? ` — ${c.seasons.name}` : ''}`,
  }));
}

/** Farm select + dependent Field select. Clears field when farm changes. */
export function FarmFieldRow({ form, required = false }: { form: FormApi; required?: boolean }) {
  const { values, set } = form;
  const { items: farms } = useAll('farms');
  const { items: fields } = useAll('fields', { farm_id: values.farm_id }, { enabled: !!values.farm_id });
  return (
    <>
      <SelectField
        label="Farm"
        required={required}
        value={values.farm_id || ''}
        onChangeValue={(v) => {
          set('farm_id', v);
          set('field_id', '');
        }}
        placeholder="Select Farm"
        options={farms.map((f: any) => ({ value: f.id, label: f.name }))}
      />
      <SelectField
        label="Field"
        value={values.field_id || ''}
        onChangeValue={(v) => set('field_id', v)}
        placeholder="Select Field"
        options={fields.map((f: any) => ({ value: f.id, label: f.name }))}
      />
    </>
  );
}

export function CycleSelect({
  form,
  label = 'Crop Cycle',
  placeholder = 'Select Crop Cycle',
  required = false,
}: {
  form: FormApi;
  label?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const options = useCycleOptions();
  return (
    <SelectField
      label={label}
      required={required}
      value={form.values.crop_cycle_id || ''}
      onChangeValue={(v) => form.set('crop_cycle_id', v)}
      placeholder={placeholder}
      options={options}
    />
  );
}
