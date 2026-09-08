import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { PROBLEM_TYPES, PROTECTION_METHODS, SEVERITIES } from '../lib/options.js';

const INITIAL = {
  farm_id: '', field_id: '', crop_cycle_id: '', protection_date: '', problem_type: '',
  problem_name: '', severity: '', treatment: '', product_name: '', quantity: '',
  unit: 'litres', application_method: '', cost: 0, applied_by: '', notes: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));

function Body(form) {
  const { bind } = form;
  return (
    <>
      <FarmFieldRow {...form} />
      <CycleSelect bind={bind} />
      <FormRow>
        <SelectField label="Problem Type" required {...bind('problem_type')} placeholder="Select Type" options={PROBLEM_TYPES} />
        <TextField label="Problem Name" required {...bind('problem_name')} placeholder="e.g. Fall armyworm" />
      </FormRow>
      <FormRow>
        <DateField label="Date" required {...bind('protection_date')} />
        <SelectField label="Severity" {...bind('severity')} placeholder="Select Severity" options={SEVERITIES} />
      </FormRow>
      <TextField label="Treatment" {...bind('treatment')} />
      <FormRow>
        <TextField label="Product Name" {...bind('product_name')} />
        <SelectField label="Application Method" {...bind('application_method')} placeholder="Select Method" options={PROTECTION_METHODS} />
      </FormRow>
      <FormRow cols={3}>
        <NumberField label="Quantity" {...bind('quantity')} />
        <TextField label="Unit" {...bind('unit')} />
        <NumberField label="Cost" {...bind('cost')} />
      </FormRow>
      <TextField label="Applied By" {...bind('applied_by')} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function ProtForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="crop-protection-records"
      title="Crop Protection Record"
      initial={INITIAL}
      fromRow={(r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        field_id: v.field_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        quantity: num(v.quantity),
        cost: Number(v.cost) || 0,
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function CropProtection() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="crop-protection-records"
      title="Crop Protection"
      subtitle="Record pest, disease, and weed management activities."
      addLabel="Add Record"
      searchPlaceholder="Search problem or product..."
      emptyIcon="fa-shield-alt"
      emptyTitle="No Crop Protection Records"
      emptyDescription="Record pest, disease, and weed management activities."
      FormComponent={ProtForm}
      defaultSort={{ sort: 'protection_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'problem_type', placeholder: 'All Types', options: PROBLEM_TYPES },
        { key: 'severity', placeholder: 'All Severities', options: SEVERITIES },
      ]}
      columns={[
        { key: 'protection_date', label: 'Date', sortable: true, render: (r) => formatDate(r.protection_date) },
        { key: 'problem_type', label: 'Type', render: (r) => <span className="badge badge-info">{r.problem_type}</span> },
        { key: 'problem_name', label: 'Problem', render: (r) => <strong>{r.problem_name}</strong> },
        { key: 'severity', label: 'Severity', render: (r) => <StatusBadge status={r.severity} /> },
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
        { key: 'treatment', label: 'Treatment', render: (r) => r.treatment || '—' },
        { key: 'cost', label: 'Cost', render: (r) => (r.cost ? formatCurrency(r.cost) : '—') },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.protection_date)],
        ['Problem Type', r.problem_type],
        ['Problem', r.problem_name],
        ['Severity', r.severity],
        ['Treatment', r.treatment],
        ['Product', r.product_name],
        ['Quantity', r.quantity ? `${r.quantity} ${r.unit || 'L'}` : '—'],
        ['Cost', formatCurrency(r.cost)],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Applied By', r.applied_by],
        ['Method', r.application_method],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
