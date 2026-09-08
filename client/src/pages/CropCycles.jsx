import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useAll } from '../lib/useResource.js';
import { formatDate, formatNumber } from '../lib/format.js';
import { AREA_UNITS, CYCLE_STATUS } from '../lib/options.js';

const INITIAL = {
  farm_id: '', field_id: '', crop_id: '', variety_id: '', season_id: '',
  planting_date: '', expected_harvest_date: '', actual_harvest_date: '',
  area_planted: '', area_unit: 'hectares', seed_quantity: '', seed_unit: 'kg',
  expected_production: '', expected_production_unit: 'kg',
  actual_production: '', actual_production_unit: 'kg', status: 'Planned', notes: '',
};

const num = (v) => (v === '' || v == null ? null : Number(v));

function CycleBody({ values, set, bind }) {
  const { items: farms } = useAll('farms');
  const { items: crops } = useAll('crops');
  const { items: seasons } = useAll('seasons');
  const { items: fields } = useAll('fields', { farm_id: values.farm_id }, { enabled: !!values.farm_id });
  const { items: varieties } = useAll('crop-varieties', { crop_id: values.crop_id }, { enabled: !!values.crop_id });

  return (
    <>
      <FormRow>
        <SelectField
          label="Farm"
          required
          value={values.farm_id}
          onChange={(e) => {
            set('farm_id', e.target.value);
            set('field_id', '');
          }}
          placeholder="Select Farm"
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
        />
        <SelectField
          label="Field"
          required
          {...bind('field_id')}
          placeholder="Select Field"
          options={fields.map((f) => ({ value: f.id, label: f.name }))}
        />
      </FormRow>
      <FormRow>
        <SelectField
          label="Crop"
          required
          value={values.crop_id}
          onChange={(e) => {
            set('crop_id', e.target.value);
            set('variety_id', '');
          }}
          placeholder="Select Crop"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectField
          label="Variety"
          {...bind('variety_id')}
          placeholder="No Variety"
          options={varieties.map((v) => ({ value: v.id, label: v.name }))}
        />
      </FormRow>
      <SelectField
        label="Season"
        {...bind('season_id')}
        placeholder="Select Season"
        options={seasons.map((s) => ({ value: s.id, label: s.name }))}
      />
      <FormRow cols={3}>
        <DateField label="Planting Date" {...bind('planting_date')} />
        <DateField label="Expected Harvest" {...bind('expected_harvest_date')} />
        <DateField label="Actual Harvest" {...bind('actual_harvest_date')} />
      </FormRow>
      <FormRow>
        <NumberField label="Area Planted" {...bind('area_planted')} />
        <SelectField label="Area Unit" {...bind('area_unit')} options={AREA_UNITS} />
      </FormRow>
      <FormRow>
        <NumberField label="Seed Quantity" {...bind('seed_quantity')} />
        <TextField label="Seed Unit" {...bind('seed_unit')} />
      </FormRow>
      <FormRow>
        <NumberField label="Expected Production" {...bind('expected_production')} />
        <TextField label="Expected Prod. Unit" {...bind('expected_production_unit')} />
      </FormRow>
      <FormRow>
        <NumberField label="Actual Production" {...bind('actual_production')} />
        <TextField label="Actual Prod. Unit" {...bind('actual_production_unit')} />
      </FormRow>
      <SelectField label="Status" {...bind('status')} options={CYCLE_STATUS} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function CycleForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="crop-cycles"
      title="Crop Cycle"
      initial={INITIAL}
      fromRow={(r) => ({
        farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '',
        variety_id: r.variety_id || '', season_id: r.season_id || '',
      })}
      toPayload={(v) => ({
        ...v,
        variety_id: v.variety_id || null,
        season_id: v.season_id || null,
        planting_date: v.planting_date || null,
        expected_harvest_date: v.expected_harvest_date || null,
        actual_harvest_date: v.actual_harvest_date || null,
        area_planted: num(v.area_planted),
        seed_quantity: num(v.seed_quantity),
        expected_production: num(v.expected_production),
        actual_production: num(v.actual_production),
      })}
    >
      {(form) => <CycleBody {...form} />}
    </ResourceForm>
  );
}

export default function CropCycles() {
  const { items: farms } = useAll('farms');
  const { items: crops } = useAll('crops');
  const { items: seasons } = useAll('seasons');
  return (
    <CrudPage
      resource="crop-cycles"
      title="Crop Cycles"
      subtitle="Track production from planting to harvest."
      addLabel="Add Crop Cycle"
      searchable={false}
      emptyIcon="fa-sync-alt"
      emptyTitle="No Crop Cycles Yet"
      emptyDescription="Create your first crop cycle to start tracking production from planting to harvest."
      FormComponent={CycleForm}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'crop_id', placeholder: 'All Crops', options: crops.map((c) => ({ value: c.id, label: c.name })) },
        { key: 'season_id', placeholder: 'All Seasons', options: seasons.map((s) => ({ value: s.id, label: s.name })) },
        { key: 'status', placeholder: 'All Statuses', options: CYCLE_STATUS },
      ]}
      columns={[
        {
          key: 'farm',
          label: 'Farm / Field',
          render: (r) => (
            <>
              <strong>{r.farms?.name || '—'}</strong>
              <br />
              <span className="text-xs text-light">{r.fields?.name || ''}</span>
            </>
          ),
        },
        { key: 'crop', label: 'Crop', render: (r) => <span className="badge badge-primary">{r.crops?.name || '—'}</span> },
        { key: 'variety', label: 'Variety', render: (r) => r.crop_varieties?.name || '—' },
        { key: 'season', label: 'Season', render: (r) => r.seasons?.name || '—' },
        { key: 'planting_date', label: 'Planted', render: (r) => formatDate(r.planting_date) },
        { key: 'area_planted', label: 'Area', render: (r) => (r.area_planted ? `${formatNumber(r.area_planted)} ${r.area_unit || 'ha'}` : '—') },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      viewFields={(r) => [
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Crop', r.crops?.name],
        ['Variety', r.crop_varieties?.name],
        ['Season', r.seasons?.name],
        ['Status', r.status],
        ['Planting Date', formatDate(r.planting_date)],
        ['Expected Harvest', formatDate(r.expected_harvest_date)],
        ['Actual Harvest', formatDate(r.actual_harvest_date)],
        ['Area Planted', r.area_planted ? `${formatNumber(r.area_planted)} ${r.area_unit || 'ha'}` : '—'],
        ['Seed Quantity', r.seed_quantity ? `${formatNumber(r.seed_quantity)} ${r.seed_unit || 'kg'}` : '—'],
        ['Expected Production', r.expected_production ? `${formatNumber(r.expected_production)} ${r.expected_production_unit || 'kg'}` : '—'],
        ['Actual Production', r.actual_production ? `${formatNumber(r.actual_production)} ${r.actual_production_unit || 'kg'}` : '—'],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
