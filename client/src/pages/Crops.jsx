import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, SelectField, TextArea } from '../components/form.jsx';
import { GROWING_PERIOD_UNITS } from '../lib/options.js';

const INITIAL = {
  name: '', category: '', description: '',
  typical_growing_period: '', growing_period_unit: 'days', notes: '',
};

function CropForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="crops"
      title="Crop"
      initial={INITIAL}
      toPayload={(v) => ({
        ...v,
        typical_growing_period: v.typical_growing_period === '' ? null : Number(v.typical_growing_period),
      })}
    >
      {({ bind }) => (
        <>
          <FormRow>
            <TextField label="Crop Name" required {...bind('name')} placeholder="e.g. Maize" />
            <TextField label="Category" {...bind('category')} placeholder="e.g. Cereal" />
          </FormRow>
          <FormRow>
            <NumberField label="Typical Growing Period" {...bind('typical_growing_period')} />
            <SelectField label="Period Unit" {...bind('growing_period_unit')} options={GROWING_PERIOD_UNITS} />
          </FormRow>
          <TextArea label="Description" {...bind('description')} />
          <TextArea label="Notes" {...bind('notes')} />
        </>
      )}
    </ResourceForm>
  );
}

export default function Crops() {
  return (
    <CrudPage
      resource="crops"
      title="Crops"
      subtitle="Build your crop database."
      addLabel="Add Crop"
      searchPlaceholder="Search crops..."
      emptyIcon="fa-leaf"
      emptyTitle="No Crops Yet"
      emptyDescription="Add your first crop to start building your crop database."
      FormComponent={CropForm}
      defaultSort={{ sort: 'name', order: 'asc' }}
      columns={[
        { key: 'name', label: 'Crop Name', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'category', label: 'Category', render: (r) => <span className="badge badge-primary">{r.category || '—'}</span> },
        {
          key: 'typical_growing_period',
          label: 'Growing Period',
          render: (r) => (r.typical_growing_period ? `${r.typical_growing_period} ${r.growing_period_unit || 'days'}` : '—'),
        },
        { key: 'description', label: 'Description', className: 'text-truncate', render: (r) => r.description || '—' },
      ]}
      viewFields={(r) => [
        ['Crop Name', r.name],
        ['Category', r.category],
        ['Growing Period', r.typical_growing_period ? `${r.typical_growing_period} ${r.growing_period_unit || 'days'}` : '—'],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
