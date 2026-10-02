import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { AREA_UNITS, HARVEST_QUALITY } from '../lib/options.js';

const INITIAL = {
  currency: '',
  farm_id: '', field_id: '', crop_id: '', crop_cycle_id: '', harvest_date: '',
  harvested_area: '', area_unit: 'hectares', quantity: '', unit: 'kg', grade: '',
  quality: 'Good', storage_location: '', labor_cost: 0, transport_cost: 0, other_costs: 0, notes: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));
const n0 = (v) => Number(v) || 0;

function totalCost(r) {
  return (r.labor_cost || 0) + (r.transport_cost || 0) + (r.other_costs || 0);
}

function Body(form) {
  const { bind } = form;
  const { items: crops } = useAll('crops');
  return (
    <>
      <FarmFieldRow {...form} />
      <FormRow>
        <SelectField
          label="Crop"
          required
          {...bind('crop_id')}
          placeholder="Select Crop"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
        <CycleSelect bind={bind} />
      </FormRow>
      <FormRow>
        <DateField label="Harvest Date" required {...bind('harvest_date')} />
        <SelectField label="Quality" {...bind('quality')} options={HARVEST_QUALITY} />
      </FormRow>
      <FormRow>
        <NumberField label="Quantity" required {...bind('quantity')} />
        <TextField label="Unit" {...bind('unit')} />
      </FormRow>
      <FormRow>
        <NumberField label="Harvested Area" {...bind('harvested_area')} />
        <SelectField label="Area Unit" {...bind('area_unit')} options={AREA_UNITS} />
      </FormRow>
      <FormRow>
        <TextField label="Grade" {...bind('grade')} />
        <TextField label="Storage Location" {...bind('storage_location')} />
      </FormRow>
      <FormRow cols={3}>
        <MoneyField label="Labor Cost" bind={bind} name="labor_cost" />
        <MoneyField label="Transport Cost" bind={bind} name="transport_cost" />
        <MoneyField label="Other Costs" bind={bind} name="other_costs" />
      </FormRow>
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function HarvestForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="harvest-records"
      title="Harvest Record"
      initial={INITIAL}
      validate={(v) => (v.quantity === '' ? 'Quantity is required' : v.crop_id ? null : 'Crop is required')}
      fromRow={(r) => ({
        farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '', crop_cycle_id: r.crop_cycle_id || '',
      })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        field_id: v.field_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        harvested_area: num(v.harvested_area),
        quantity: Number(v.quantity),
        labor_cost: n0(v.labor_cost),
        transport_cost: n0(v.transport_cost),
        other_costs: n0(v.other_costs),
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function Harvest() {
  const { items: farms } = useAll('farms');
  const { items: crops } = useAll('crops');
  return (
    <CrudPage
      resource="harvest-records"
      title="Harvest"
      subtitle="Track your production output."
      addLabel="Add Harvest"
      searchPlaceholder="Search storage or grade..."
      emptyIcon="fa-wheat-awn"
      emptyTitle="No Harvest Records"
      emptyDescription="Record harvest data to track your production output."
      FormComponent={HarvestForm}
      defaultSort={{ sort: 'harvest_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'crop_id', placeholder: 'All Crops', options: crops.map((c) => ({ value: c.id, label: c.name })) },
      ]}
      columns={[
        { key: 'harvest_date', label: 'Date', sortable: true, render: (r) => formatDate(r.harvest_date) },
        { key: 'crop', label: 'Crop', render: (r) => <span className="badge badge-primary">{r.crops?.name || '—'}</span> },
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
        { key: 'quantity', label: 'Quantity', render: (r) => <><strong>{formatNumber(r.quantity)}</strong> {r.unit || 'kg'}</> },
        { key: 'harvested_area', label: 'Area', render: (r) => (r.harvested_area ? `${formatNumber(r.harvested_area)} ${r.area_unit || 'ha'}` : '—') },
        { key: 'quality', label: 'Quality', render: (r) => r.quality || '—' },
        { key: 'total_cost', label: 'Total Cost', render: (r) => (totalCost(r) ? formatCurrency(totalCost(r), r.currency) : '—') },
      ]}
      viewFields={(r) => [
        ['Harvest Date', formatDate(r.harvest_date)],
        ['Crop', r.crops?.name],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Quantity', `${formatNumber(r.quantity)} ${r.unit || 'kg'}`],
        ['Harvested Area', r.harvested_area ? `${formatNumber(r.harvested_area)} ${r.area_unit || 'ha'}` : '—'],
        ['Grade', r.grade],
        ['Quality', r.quality],
        ['Storage', r.storage_location],
        ['Total Cost', formatCurrency(totalCost(r), r.currency)],
        ['Labor Cost', formatCurrency(r.labor_cost, r.currency)],
        ['Transport Cost', formatCurrency(r.transport_cost, r.currency)],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
