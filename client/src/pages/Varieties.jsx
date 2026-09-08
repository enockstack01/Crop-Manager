import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, SelectField, TextArea } from '../components/form.jsx';
import { useAll } from '../lib/useResource.js';
import { GROWING_PERIOD_UNITS } from '../lib/options.js';

const INITIAL = {
  crop_id: '', name: '', description: '',
  maturity_period: '', maturity_period_unit: 'days', seed_source: '', notes: '',
};

function VarietyBody({ bind }) {
  const { items: crops } = useAll('crops');
  return (
    <>
      <FormRow>
        <SelectField
          label="Crop"
          required
          {...bind('crop_id')}
          placeholder="Select Crop"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
        <TextField label="Variety Name" required {...bind('name')} placeholder="e.g. SC 627" />
      </FormRow>
      <FormRow>
        <NumberField label="Maturity Period" {...bind('maturity_period')} />
        <SelectField label="Period Unit" {...bind('maturity_period_unit')} options={GROWING_PERIOD_UNITS} />
      </FormRow>
      <TextField label="Seed Source" {...bind('seed_source')} placeholder="e.g. SeedCo" />
      <TextArea label="Description" {...bind('description')} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function VarietyForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="crop-varieties"
      title="Variety"
      initial={INITIAL}
      fromRow={(r) => ({ crop_id: r.crop_id || '' })}
      toPayload={(v) => ({ ...v, maturity_period: v.maturity_period === '' ? null : Number(v.maturity_period) })}
    >
      {(form) => <VarietyBody {...form} />}
    </ResourceForm>
  );
}

export default function Varieties() {
  const { items: crops } = useAll('crops');
  return (
    <CrudPage
      resource="crop-varieties"
      title="Varieties"
      subtitle="Track different types within each crop."
      addLabel="Add Variety"
      searchPlaceholder="Search varieties..."
      emptyIcon="fa-seedling"
      emptyTitle="No Varieties Yet"
      emptyDescription="Add crop varieties to track different types within each crop."
      FormComponent={VarietyForm}
      filters={[{ key: 'crop_id', placeholder: 'All Crops', options: crops.map((c) => ({ value: c.id, label: c.name })) }]}
      columns={[
        { key: 'name', label: 'Variety Name', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'crop', label: 'Crop', render: (r) => <span className="badge badge-primary">{r.crops?.name || '—'}</span> },
        {
          key: 'maturity_period',
          label: 'Maturity Period',
          render: (r) => (r.maturity_period ? `${r.maturity_period} ${r.maturity_period_unit || 'days'}` : '—'),
        },
        { key: 'seed_source', label: 'Seed Source', render: (r) => r.seed_source || '—' },
      ]}
      viewFields={(r) => [
        ['Variety Name', r.name],
        ['Crop', r.crops?.name],
        ['Maturity Period', r.maturity_period ? `${r.maturity_period} ${r.maturity_period_unit || 'days'}` : '—'],
        ['Seed Source', r.seed_source],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
