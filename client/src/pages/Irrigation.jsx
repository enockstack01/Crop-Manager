import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { AREA_UNITS, IRRIGATION_METHODS, WATER_UNITS } from '../lib/options.js';

const INITIAL = {
  farm_id: '', field_id: '', crop_cycle_id: '', irrigation_date: '', irrigation_method: '',
  duration_hours: '', water_volume: '', water_unit: 'cubic metres', area_irrigated: '',
  area_unit: 'hectares', cost: 0, operator: '', notes: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));

function Body(form) {
  const { bind } = form;
  return (
    <>
      <FarmFieldRow {...form} />
      <CycleSelect bind={bind} />
      <FormRow>
        <SelectField label="Method" required {...bind('irrigation_method')} placeholder="Select Method" options={IRRIGATION_METHODS} />
        <DateField label="Date" required {...bind('irrigation_date')} />
      </FormRow>
      <FormRow>
        <NumberField label="Duration (hours)" {...bind('duration_hours')} />
        <NumberField label="Cost" {...bind('cost')} />
      </FormRow>
      <FormRow>
        <NumberField label="Water Volume" {...bind('water_volume')} />
        <SelectField label="Water Unit" {...bind('water_unit')} options={WATER_UNITS} />
      </FormRow>
      <FormRow>
        <NumberField label="Area Irrigated" {...bind('area_irrigated')} />
        <SelectField label="Area Unit" {...bind('area_unit')} options={AREA_UNITS} />
      </FormRow>
      <TextField label="Operator" {...bind('operator')} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function IrrigationForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="irrigation-records"
      title="Irrigation Record"
      initial={INITIAL}
      fromRow={(r) => ({ farm_id: r.farm_id || '', field_id: r.field_id || '', crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        field_id: v.field_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        duration_hours: num(v.duration_hours),
        water_volume: num(v.water_volume),
        area_irrigated: num(v.area_irrigated),
        cost: Number(v.cost) || 0,
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function Irrigation() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="irrigation-records"
      title="Irrigation"
      subtitle="Track water applications across your fields."
      addLabel="Add Irrigation"
      searchable={false}
      emptyIcon="fa-tint"
      emptyTitle="No Irrigation Records"
      emptyDescription="Track water applications across your fields."
      FormComponent={IrrigationForm}
      defaultSort={{ sort: 'irrigation_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'irrigation_method', placeholder: 'All Methods', options: IRRIGATION_METHODS },
      ]}
      columns={[
        { key: 'irrigation_date', label: 'Date', sortable: true, render: (r) => formatDate(r.irrigation_date) },
        { key: 'irrigation_method', label: 'Method', render: (r) => <span className="badge badge-info">{r.irrigation_method}</span> },
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
        { key: 'water_volume', label: 'Volume', render: (r) => (r.water_volume ? `${formatNumber(r.water_volume)} ${r.water_unit || 'm³'}` : '—') },
        { key: 'duration_hours', label: 'Duration', render: (r) => (r.duration_hours ? `${r.duration_hours} hrs` : '—') },
        { key: 'cost', label: 'Cost', render: (r) => (r.cost ? formatCurrency(r.cost) : '—') },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.irrigation_date)],
        ['Method', r.irrigation_method],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Volume', r.water_volume ? `${formatNumber(r.water_volume)} ${r.water_unit || 'm³'}` : '—'],
        ['Duration', r.duration_hours ? `${r.duration_hours} hours` : '—'],
        ['Area Irrigated', r.area_irrigated ? `${formatNumber(r.area_irrigated)} ${r.area_unit || 'ha'}` : '—'],
        ['Cost', formatCurrency(r.cost)],
        ['Operator', r.operator],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
