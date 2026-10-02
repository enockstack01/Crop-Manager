import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { CycleSelect } from '../components/relationFields.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { PAYMENT_STATUS } from '../lib/options.js';

const INITIAL = {
  currency: '',
  farm_id: '', crop_id: '', crop_cycle_id: '', buyer: '', quantity: 0, unit: 'kg',
  unit_price: 0, sale_date: '', market: '', payment_status: 'Pending', notes: '',
};

function Body({ bind }) {
  const { items: farms } = useAll('farms');
  const { items: crops } = useAll('crops');
  return (
    <>
      <FormRow>
        <SelectField
          label="Farm"
          {...bind('farm_id')}
          placeholder="Select Farm"
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
        />
        <SelectField
          label="Crop"
          required
          {...bind('crop_id')}
          placeholder="Select Crop"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
      </FormRow>
      <CycleSelect bind={bind} placeholder="Select Cycle" />
      <FormRow>
        <TextField label="Buyer" {...bind('buyer')} />
        <TextField label="Market" {...bind('market')} />
      </FormRow>
      <FormRow cols={3}>
        <NumberField label="Quantity" {...bind('quantity')} />
        <TextField label="Unit" {...bind('unit')} />
        <MoneyField label="Unit Price" bind={bind} name="unit_price" />
      </FormRow>
      <FormRow>
        <DateField label="Sale Date" required {...bind('sale_date')} />
        <SelectField label="Payment Status" {...bind('payment_status')} options={PAYMENT_STATUS} />
      </FormRow>
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function SaleForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="sales"
      title="Sale"
      initial={INITIAL}
      validate={(v) => (v.crop_id ? null : 'Crop is required')}
      fromRow={(r) => ({ farm_id: r.farm_id || '', crop_id: r.crop_id || '', crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        quantity: Number(v.quantity) || 0,
        unit_price: Number(v.unit_price) || 0,
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function Sales() {
  const { items: farms } = useAll('farms');
  const { items: crops } = useAll('crops');
  return (
    <CrudPage
      resource="sales"
      title="Sales"
      subtitle="Record crop sales and track payment status."
      addLabel="Add Sale"
      searchPlaceholder="Search buyer or market..."
      emptyIcon="fa-hand-holding-usd"
      emptyTitle="No Sales"
      emptyDescription="Record crop sales and track payment status."
      FormComponent={SaleForm}
      defaultSort={{ sort: 'sale_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'crop_id', placeholder: 'All Crops', options: crops.map((c) => ({ value: c.id, label: c.name })) },
        { key: 'payment_status', placeholder: 'All Statuses', options: PAYMENT_STATUS },
      ]}
      columns={[
        { key: 'sale_date', label: 'Date', sortable: true, render: (r) => formatDate(r.sale_date) },
        { key: 'crop', label: 'Crop', render: (r) => <span className="badge badge-primary">{r.crops?.name || '—'}</span> },
        { key: 'buyer', label: 'Buyer', render: (r) => r.buyer || '—' },
        { key: 'quantity', label: 'Qty', render: (r) => `${formatNumber(r.quantity)} ${r.unit || 'kg'}` },
        { key: 'unit_price', label: 'Unit Price', render: (r) => formatCurrency(r.unit_price, r.currency) },
        { key: 'total_amount', label: 'Total', render: (r) => <strong>{formatCurrency(r.total_amount, r.currency)}</strong> },
        { key: 'payment_status', label: 'Payment', render: (r) => <StatusBadge status={r.payment_status} /> },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.sale_date)],
        ['Crop', r.crops?.name],
        ['Farm', r.farms?.name],
        ['Buyer', r.buyer],
        ['Market', r.market],
        ['Quantity', `${formatNumber(r.quantity)} ${r.unit || 'kg'}`],
        ['Unit Price', formatCurrency(r.unit_price, r.currency)],
        ['Total Amount', formatCurrency(r.total_amount, r.currency)],
        ['Payment Status', r.payment_status],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
