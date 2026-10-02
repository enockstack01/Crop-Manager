import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { FERTILIZER_METHODS, FERTILIZER_TYPES } from '../lib/options.js';

const INITIAL = {
  currency: '',
  farm_id: '', field_id: '', crop_cycle_id: '', application_date: '', fertilizer_name: '',
  fertilizer_type: '', quantity: '', unit: 'kg', application_method: '', cost: 0,
  supplier: '', applied_by: '', notes: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));

function Body(form) {
  const { bind } = form;
  return (
    <>
      <FarmFieldRow {...form} />
      <CycleSelect bind={bind} />
      <FormRow>
        <TextField label="Fertilizer Name" required {...bind('fertilizer_name')} />
        <SelectField label="Type" required {...bind('fertilizer_type')} placeholder="Select Type" options={FERTILIZER_TYPES} />
      </FormRow>
      <FormRow>
        <DateField label="Application Date" required {...bind('application_date')} />
        <SelectField label="Method" {...bind('application_method')} placeholder="Select Method" options={FERTILIZER_METHODS} />
      </FormRow>
      <FormRow>
        <NumberField label="Quantity" {...bind('quantity')} />
        <TextField label="Unit" {...bind('unit')} />
      </FormRow>
      <FormRow>
        <MoneyField label="Cost" bind={bind} name="cost" />
        <TextField label="Supplier" {...bind('supplier')} />
      </FormRow>
      <TextField label="Applied By" {...bind('applied_by')} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function FertForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="fertilizer-applications"
      title="Fertilizer Application"
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

export default function Fertilizers() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="fertilizer-applications"
      title="Fertilizer"
      subtitle="Track fertilizer applications for your crops."
      addLabel="Add Application"
      searchPlaceholder="Search fertilizer or supplier..."
      emptyIcon="fa-flask"
      emptyTitle="No Fertilizer Records"
      emptyDescription="Track fertilizer applications for your crops."
      FormComponent={FertForm}
      defaultSort={{ sort: 'application_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'fertilizer_type', placeholder: 'All Types', options: FERTILIZER_TYPES },
      ]}
      columns={[
        { key: 'application_date', label: 'Date', sortable: true, render: (r) => formatDate(r.application_date) },
        { key: 'fertilizer_name', label: 'Fertilizer', render: (r) => <strong>{r.fertilizer_name}</strong> },
        { key: 'fertilizer_type', label: 'Type', render: (r) => <span className="badge badge-primary">{r.fertilizer_type}</span> },
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
        { key: 'quantity', label: 'Quantity', render: (r) => (r.quantity ? `${formatNumber(r.quantity)} ${r.unit || 'kg'}` : '—') },
        { key: 'application_method', label: 'Method', render: (r) => r.application_method || '—' },
        { key: 'cost', label: 'Cost', render: (r) => (r.cost ? formatCurrency(r.cost, r.currency) : '—') },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.application_date)],
        ['Fertilizer', r.fertilizer_name],
        ['Type', r.fertilizer_type],
        ['Method', r.application_method],
        ['Quantity', r.quantity ? `${formatNumber(r.quantity)} ${r.unit || 'kg'}` : '—'],
        ['Cost', formatCurrency(r.cost, r.currency)],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Supplier', r.supplier],
        ['Applied By', r.applied_by],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
