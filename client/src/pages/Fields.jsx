import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, SelectField, TextArea } from '../components/form.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useAll } from '../lib/useResource.js';
import { formatNumber } from '../lib/format.js';
import { AREA_UNITS, FIELD_STATUS } from '../lib/options.js';

const INITIAL = {
  farm_id: '', name: '', code: '', area: '', area_unit: 'hectares', location: '',
  latitude: '', longitude: '', soil_type: '', soil_ph: '', status: 'Active', notes: '',
};

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

function FieldFormBody({ bind }) {
  const { items: farms } = useAll('farms');
  return (
    <>
      <FormRow>
        <SelectField
          label="Farm"
          required
          {...bind('farm_id')}
          placeholder="Select Farm"
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
        />
        <TextField label="Field Name" required {...bind('name')} placeholder="e.g. North Block" />
      </FormRow>
      <FormRow>
        <TextField label="Field Code" {...bind('code')} />
        <TextField label="Location" {...bind('location')} />
      </FormRow>
      <FormRow>
        <NumberField label="Area" {...bind('area')} />
        <SelectField label="Area Unit" {...bind('area_unit')} options={AREA_UNITS} />
      </FormRow>
      <FormRow>
        <TextField label="Soil Type" {...bind('soil_type')} placeholder="e.g. Sandy loam" />
        <NumberField label="Soil pH" {...bind('soil_ph')} step="0.1" />
      </FormRow>
      <FormRow>
        <NumberField label="Latitude" {...bind('latitude')} step="0.000001" />
        <NumberField label="Longitude" {...bind('longitude')} step="0.000001" />
      </FormRow>
      <SelectField label="Status" {...bind('status')} options={FIELD_STATUS} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function FieldForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="fields"
      title="Field"
      initial={INITIAL}
      fromRow={(r) => ({ farm_id: r.farm_id || '' })}
      toPayload={(v) => ({
        ...v,
        area: num(v.area),
        soil_ph: num(v.soil_ph),
        latitude: num(v.latitude),
        longitude: num(v.longitude),
      })}
    >
      {(form) => <FieldFormBody {...form} />}
    </ResourceForm>
  );
}

export default function Fields() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="fields"
      title="Fields"
      subtitle="Track crop production areas within each farm."
      addLabel="Add Field"
      searchPlaceholder="Search fields..."
      emptyIcon="fa-map"
      emptyTitle="No Fields Yet"
      emptyDescription="Add your first field to start tracking crop production areas."
      FormComponent={FieldForm}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'status', placeholder: 'All Statuses', options: FIELD_STATUS },
      ]}
      columns={[
        { key: 'name', label: 'Field Name', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'farm', label: 'Farm', render: (r) => r.farms?.name || '—' },
        { key: 'code', label: 'Code', render: (r) => <span className="badge badge-neutral">{r.code || '—'}</span> },
        { key: 'area', label: 'Area', sortable: true, render: (r) => `${formatNumber(r.area)} ${r.area_unit || 'ha'}` },
        { key: 'soil_type', label: 'Soil Type', render: (r) => r.soil_type || '—' },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      ]}
      viewFields={(r) => [
        ['Field Name', r.name],
        ['Farm', r.farms?.name],
        ['Code', r.code],
        ['Area', `${formatNumber(r.area)} ${r.area_unit || 'ha'}`],
        ['Location', r.location],
        ['Soil Type', r.soil_type],
        ['Soil pH', r.soil_ph],
        ['Status', r.status],
        ['Latitude', r.latitude],
        ['Longitude', r.longitude],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
