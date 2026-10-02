import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate } from '../lib/format.js';

const INITIAL = {
  currency: '',
  equipment_id: '', maintenance_date: '', type: '', description: '', cost: 0,
  performed_by: '', next_maintenance: '', notes: '',
};

function MaintBody({ bind }) {
  const { items: equipment } = useAll('equipment');
  return (
    <>
      <FormRow>
        <SelectField
          label="Equipment"
          {...bind('equipment_id')}
          placeholder="Select Equipment"
          options={equipment.map((e) => ({ value: e.id, label: e.name }))}
        />
        <DateField label="Maintenance Date" required {...bind('maintenance_date')} />
      </FormRow>
      <FormRow>
        <TextField label="Type" {...bind('type')} placeholder="e.g. Service / Repair" />
        <MoneyField label="Cost" bind={bind} name="cost" />
      </FormRow>
      <TextArea label="Description" {...bind('description')} />
      <FormRow>
        <TextField label="Performed By" {...bind('performed_by')} />
        <DateField label="Next Maintenance" {...bind('next_maintenance')} />
      </FormRow>
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function MaintForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="equipment-maintenance"
      title="Maintenance"
      initial={INITIAL}
      fromRow={(r) => ({ equipment_id: r.equipment_id || '' })}
      toPayload={(v) => ({
        ...v,
        equipment_id: v.equipment_id || null,
        cost: Number(v.cost) || 0,
        next_maintenance: v.next_maintenance || null,
      })}
    >
      {(form) => <MaintBody {...form} />}
    </ResourceForm>
  );
}

export default function Maintenance() {
  const { items: equipment } = useAll('equipment');
  return (
    <CrudPage
      resource="equipment-maintenance"
      title="Equipment Maintenance"
      subtitle="Track equipment servicing and repairs."
      addLabel="Add Record"
      searchPlaceholder="Search description or person..."
      emptyIcon="fa-wrench"
      emptyTitle="No Maintenance Records"
      emptyDescription="Track equipment servicing and repairs."
      FormComponent={MaintForm}
      defaultSort={{ sort: 'maintenance_date', order: 'desc' }}
      filters={[{ key: 'equipment_id', placeholder: 'All Equipment', options: equipment.map((e) => ({ value: e.id, label: e.name })) }]}
      columns={[
        { key: 'maintenance_date', label: 'Date', sortable: true, render: (r) => formatDate(r.maintenance_date) },
        { key: 'equipment', label: 'Equipment', render: (r) => <span className="badge badge-primary">{r.equipment?.name || '—'}</span> },
        { key: 'type', label: 'Type', render: (r) => r.type || '—' },
        { key: 'description', label: 'Description', className: 'text-truncate', render: (r) => r.description || '—' },
        { key: 'cost', label: 'Cost', render: (r) => (r.cost ? formatCurrency(r.cost, r.currency) : '—') },
        { key: 'performed_by', label: 'Performed By', render: (r) => r.performed_by || '—' },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.maintenance_date)],
        ['Equipment', r.equipment?.name],
        ['Type', r.type],
        ['Cost', formatCurrency(r.cost, r.currency)],
        ['Performed By', r.performed_by],
        ['Next Maintenance', r.next_maintenance ? formatDate(r.next_maintenance) : '—'],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
