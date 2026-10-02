import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { ACTIVITY_TYPES } from '../lib/options.js';

const INITIAL = {
  currency: '',
  farm_id: '', field_id: '', crop_cycle_id: '', activity_type: '', activity_date: '',
  description: '', labor_cost: 0, equipment_cost: 0, material_cost: 0, performed_by: '', notes: '',
};
const n0 = (v) => Number(v) || 0;

function ActivityBody(form) {
  const { bind } = form;
  return (
    <>
      <FarmFieldRow {...form} />
      <CycleSelect bind={bind} />
      <FormRow>
        <SelectField label="Activity Type" required {...bind('activity_type')} placeholder="Select Type" options={ACTIVITY_TYPES} />
        <DateField label="Date" required {...bind('activity_date')} />
      </FormRow>
      <TextArea label="Description" {...bind('description')} />
      <FormRow cols={3}>
        <MoneyField label="Labor Cost" bind={bind} name="labor_cost" />
        <MoneyField label="Equipment Cost" bind={bind} name="equipment_cost" />
        <MoneyField label="Material Cost" bind={bind} name="material_cost" />
      </FormRow>
      <TextField label="Performed By" {...bind('performed_by')} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function ActivityForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="field-activities"
      title="Activity"
      initial={INITIAL}
      fromRow={(r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        field_id: v.field_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        labor_cost: n0(v.labor_cost),
        equipment_cost: n0(v.equipment_cost),
        material_cost: n0(v.material_cost),
      })}
    >
      {(form) => <ActivityBody {...form} />}
    </ResourceForm>
  );
}

export default function Activities() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="field-activities"
      title="Field Activities"
      subtitle="Track all work done on your farm."
      addLabel="Add Activity"
      searchPlaceholder="Search description or person..."
      emptyIcon="fa-tasks"
      emptyTitle="No Activities"
      emptyDescription="Record field activities to track all work done on your farm."
      FormComponent={ActivityForm}
      defaultSort={{ sort: 'activity_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'activity_type', placeholder: 'All Types', options: ACTIVITY_TYPES },
      ]}
      columns={[
        { key: 'activity_date', label: 'Date', sortable: true, render: (r) => formatDate(r.activity_date) },
        { key: 'activity_type', label: 'Type', render: (r) => <span className="badge badge-info">{r.activity_type}</span> },
        {
          key: 'farm',
          label: 'Farm / Field',
          render: (r) => (
            <>
              {r.farms?.name || '—'}
              <br />
              <span className="text-xs text-light">{r.fields?.name || ''}</span>
            </>
          ),
        },
        { key: 'crop', label: 'Crop', render: (r) => r.crop_cycles?.crops?.name || '—' },
        { key: 'description', label: 'Description', className: 'text-truncate', render: (r) => r.description || '—' },
        { key: 'total_cost', label: 'Total Cost', render: (r) => (r.total_cost ? formatCurrency(r.total_cost, r.currency) : '—') },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.activity_date)],
        ['Type', r.activity_type],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Crop', r.crop_cycles?.crops?.name],
        ['Performed By', r.performed_by],
        ['Labor Cost', formatCurrency(r.labor_cost, r.currency)],
        ['Equipment Cost', formatCurrency(r.equipment_cost, r.currency)],
        ['Material Cost', formatCurrency(r.material_cost, r.currency)],
        ['Total Cost', formatCurrency(r.total_cost, r.currency)],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
