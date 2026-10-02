import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { formatCurrency, formatDate } from '../lib/format.js';
import { EQUIPMENT_STATUS } from '../lib/options.js';

const INITIAL = {
  currency: '',
  name: '', equipment_type: '', model: '', serial_number: '', purchase_date: '',
  purchase_cost: 0, condition: '', location: '', status: 'Available', notes: '',
};

function EquipmentForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="equipment"
      title="Equipment"
      initial={INITIAL}
      toPayload={(v) => ({ ...v, purchase_cost: Number(v.purchase_cost) || 0, purchase_date: v.purchase_date || null })}
    >
      {({ bind }) => (
        <>
          <FormRow>
            <TextField label="Equipment Name" required {...bind('name')} />
            <TextField label="Type" {...bind('equipment_type')} placeholder="e.g. Tractor" />
          </FormRow>
          <FormRow>
            <TextField label="Model" {...bind('model')} />
            <TextField label="Serial Number" {...bind('serial_number')} />
          </FormRow>
          <FormRow>
            <DateField label="Purchase Date" {...bind('purchase_date')} />
            <MoneyField label="Purchase Cost" bind={bind} name="purchase_cost" />
          </FormRow>
          <FormRow>
            <TextField label="Condition" {...bind('condition')} placeholder="e.g. Good" />
            <TextField label="Location" {...bind('location')} />
          </FormRow>
          <SelectField label="Status" {...bind('status')} options={EQUIPMENT_STATUS} />
          <TextArea label="Notes" {...bind('notes')} />
        </>
      )}
    </ResourceForm>
  );
}

export default function Equipment() {
  return (
    <CrudPage
      resource="equipment"
      title="Equipment"
      subtitle="Register your farm equipment."
      addLabel="Add Equipment"
      searchPlaceholder="Search name, model, serial..."
      emptyIcon="fa-cog"
      emptyTitle="No Equipment"
      emptyDescription="Register your farm equipment."
      FormComponent={EquipmentForm}
      filters={[{ key: 'status', placeholder: 'All Statuses', options: EQUIPMENT_STATUS }]}
      columns={[
        { key: 'name', label: 'Equipment', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'equipment_type', label: 'Type', render: (r) => r.equipment_type || '—' },
        { key: 'model', label: 'Model', render: (r) => r.model || '—' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'condition', label: 'Condition', render: (r) => r.condition || '—' },
        { key: 'location', label: 'Location', render: (r) => r.location || '—' },
      ]}
      viewFields={(r) => [
        ['Equipment', r.name],
        ['Type', r.equipment_type],
        ['Model', r.model],
        ['Serial Number', r.serial_number],
        ['Status', r.status],
        ['Condition', r.condition],
        ['Location', r.location],
        ['Purchase Date', r.purchase_date ? formatDate(r.purchase_date) : '—'],
        ['Purchase Cost', formatCurrency(r.purchase_cost, r.currency)],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
