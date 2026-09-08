import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, NumberField, SelectField, TextArea } from '../components/form.jsx';
import { formatNumber, formatDate } from '../lib/format.js';
import { AREA_UNITS, FARM_TYPES } from '../lib/options.js';

const INITIAL = {
  name: '', code: '', description: '', location: '', district: '', province: '',
  country: 'Zambia', total_area: '', area_unit: 'hectares', farm_type: 'Crop', notes: '',
};

function FarmForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="farms"
      title="Farm"
      initial={INITIAL}
      toPayload={(v) => ({ ...v, total_area: v.total_area === '' ? null : Number(v.total_area) })}
    >
      {({ bind }) => (
        <>
          <FormRow>
            <TextField label="Farm Name" required {...bind('name')} placeholder="e.g. Greenfield Farm" />
            <TextField label="Farm Code" {...bind('code')} placeholder="e.g. GF-001" />
          </FormRow>
          <TextArea label="Description" {...bind('description')} placeholder="Brief description of the farm..." />
          <FormRow>
            <TextField label="Location" {...bind('location')} placeholder="e.g. Chongwe District" />
            <TextField label="District" {...bind('district')} />
          </FormRow>
          <FormRow>
            <TextField label="Province" {...bind('province')} />
            <TextField label="Country" {...bind('country')} />
          </FormRow>
          <FormRow>
            <NumberField label="Total Area" {...bind('total_area')} placeholder="e.g. 120" />
            <SelectField label="Area Unit" {...bind('area_unit')} options={AREA_UNITS} />
          </FormRow>
          <SelectField label="Farm Type" {...bind('farm_type')} options={FARM_TYPES} />
          <TextArea label="Notes" {...bind('notes')} placeholder="Additional notes..." />
        </>
      )}
    </ResourceForm>
  );
}

export default function Farms() {
  return (
    <CrudPage
      resource="farms"
      title="Farms"
      subtitle="Manage your farm locations and details."
      addLabel="Add Farm"
      searchPlaceholder="Search farms..."
      emptyIcon="fa-tractor"
      emptyTitle="No Farms Yet"
      emptyDescription="Start by adding your first farm to begin managing crop production."
      FormComponent={FarmForm}
      defaultSort={{ sort: 'created_at', order: 'desc' }}
      columns={[
        { key: 'name', label: 'Farm Name', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'code', label: 'Code', sortable: true, render: (r) => <span className="badge badge-neutral">{r.code || '—'}</span> },
        { key: 'location', label: 'Location', render: (r) => r.location || '—' },
        { key: 'total_area', label: 'Area', sortable: true, render: (r) => `${formatNumber(r.total_area)} ${r.area_unit || 'ha'}` },
        { key: 'farm_type', label: 'Type', render: (r) => r.farm_type || 'Crop' },
        { key: 'created_at', label: 'Created', render: (r) => formatDate(r.created_at) },
      ]}
      viewFields={(r) => [
        ['Farm Name', r.name],
        ['Code', r.code],
        ['Location', r.location],
        ['District', r.district],
        ['Province', r.province],
        ['Country', r.country],
        ['Total Area', `${formatNumber(r.total_area)} ${r.area_unit || 'ha'}`],
        ['Farm Type', r.farm_type],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
