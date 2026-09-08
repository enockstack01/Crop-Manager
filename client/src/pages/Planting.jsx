import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { CycleSelect, useCycleOptions } from '../components/relationFields.jsx';
import { formatDate, formatNumber } from '../lib/format.js';
import { SPACING_UNITS } from '../lib/options.js';

const INITIAL = {
  crop_cycle_id: '', planting_date: '', seed_quantity: '', seed_unit: 'kg', seed_source: '',
  seed_cost: '', row_spacing: '', plant_spacing: '', spacing_unit: 'cm', planting_method: '', notes: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));

function PlantingForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="planting-records"
      title="Planting Record"
      initial={INITIAL}
      fromRow={(r) => ({ crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        seed_quantity: num(v.seed_quantity),
        seed_cost: num(v.seed_cost),
        row_spacing: num(v.row_spacing),
        plant_spacing: num(v.plant_spacing),
      })}
    >
      {({ bind }) => (
        <>
          <CycleSelect bind={bind} required />
          <FormRow>
            <DateField label="Planting Date" required {...bind('planting_date')} />
            <TextField label="Planting Method" {...bind('planting_method')} placeholder="e.g. Row planting" />
          </FormRow>
          <FormRow>
            <NumberField label="Seed Quantity" {...bind('seed_quantity')} />
            <TextField label="Seed Unit" {...bind('seed_unit')} />
          </FormRow>
          <FormRow>
            <TextField label="Seed Source" {...bind('seed_source')} />
            <NumberField label="Seed Cost" {...bind('seed_cost')} />
          </FormRow>
          <FormRow cols={3}>
            <NumberField label="Row Spacing" {...bind('row_spacing')} />
            <NumberField label="Plant Spacing" {...bind('plant_spacing')} />
            <SelectField label="Spacing Unit" {...bind('spacing_unit')} options={SPACING_UNITS} />
          </FormRow>
          <TextArea label="Notes" {...bind('notes')} />
        </>
      )}
    </ResourceForm>
  );
}

export default function Planting() {
  const cycleOptions = useCycleOptions();
  return (
    <CrudPage
      resource="planting-records"
      title="Planting Records"
      subtitle="Record planting details for your crop cycles."
      addLabel="Add Planting Record"
      searchPlaceholder="Search by source or method..."
      emptyIcon="fa-hand-holding-seedling"
      emptyTitle="No Planting Records"
      emptyDescription="Record planting details for your crop cycles."
      FormComponent={PlantingForm}
      defaultSort={{ sort: 'planting_date', order: 'desc' }}
      filters={[{ key: 'crop_cycle_id', placeholder: 'All Cycles', options: cycleOptions }]}
      columns={[
        { key: 'planting_date', label: 'Date', sortable: true, render: (r) => formatDate(r.planting_date) },
        {
          key: 'cycle',
          label: 'Crop Cycle',
          render: (r) => (
            <>
              <span className="badge badge-primary">{r.crop_cycles?.crops?.name || '—'}</span>
              <br />
              <span className="text-xs text-light">
                {r.crop_cycles?.farms?.name || ''} / {r.crop_cycles?.fields?.name || ''}
              </span>
            </>
          ),
        },
        { key: 'seed_quantity', label: 'Seed Qty', render: (r) => (r.seed_quantity ? `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}` : '—') },
        { key: 'seed_source', label: 'Seed Source', render: (r) => r.seed_source || '—' },
        { key: 'planting_method', label: 'Method', render: (r) => r.planting_method || '—' },
        {
          key: 'spacing',
          label: 'Spacing',
          render: (r) => (r.row_spacing && r.plant_spacing ? `${r.row_spacing} x ${r.plant_spacing} ${r.spacing_unit || 'cm'}` : '—'),
        },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.planting_date)],
        ['Crop', r.crop_cycles?.crops?.name],
        ['Farm', r.crop_cycles?.farms?.name],
        ['Field', r.crop_cycles?.fields?.name],
        ['Seed Quantity', r.seed_quantity ? `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}` : '—'],
        ['Seed Cost', r.seed_cost || '—'],
        ['Row Spacing', r.row_spacing ? `${r.row_spacing} ${r.spacing_unit || 'cm'}` : '—'],
        ['Plant Spacing', r.plant_spacing ? `${r.plant_spacing} ${r.spacing_unit || 'cm'}` : '—'],
        ['Seed Source', r.seed_source],
        ['Method', r.planting_method],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
