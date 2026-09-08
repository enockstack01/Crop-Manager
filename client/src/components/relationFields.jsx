import { useAll } from '../lib/useResource.js';
import { FormRow, SelectField } from './form.jsx';

export function useCycleOptions() {
  const { items } = useAll('crop-cycles');
  return items.map((c) => ({
    value: c.id,
    label: `${c.farms?.name || '?'} / ${c.crops?.name || '?'}${c.seasons?.name ? ` — ${c.seasons.name}` : ''}`,
  }));
}

/** Farm select + dependent Field select. Clears field when farm changes. */
export function FarmFieldRow({ values, set, bind, required = false }) {
  const { items: farms } = useAll('farms');
  const { items: fields } = useAll('fields', { farm_id: values.farm_id }, { enabled: !!values.farm_id });
  return (
    <FormRow>
      <SelectField
        label="Farm"
        required={required}
        value={values.farm_id || ''}
        onChange={(e) => {
          set('farm_id', e.target.value);
          set('field_id', '');
        }}
        placeholder="Select Farm"
        options={farms.map((f) => ({ value: f.id, label: f.name }))}
      />
      <SelectField
        label="Field"
        {...bind('field_id')}
        placeholder="Select Field"
        options={fields.map((f) => ({ value: f.id, label: f.name }))}
      />
    </FormRow>
  );
}

export function CycleSelect({ bind, label = 'Crop Cycle', placeholder = 'Select Crop Cycle', required = false }) {
  const options = useCycleOptions();
  return <SelectField label={label} required={required} {...bind('crop_cycle_id')} placeholder={placeholder} options={options} />;
}
