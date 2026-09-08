import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { FarmFieldRow, CycleSelect } from '../components/relationFields.jsx';
import { PhotoUpload } from '../components/PhotoUpload.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { useAll } from '../lib/useResource.js';
import { formatDate } from '../lib/format.js';
import { PLANT_HEALTH } from '../lib/options.js';

const INITIAL = {
  farm_id: '', field_id: '', crop_id: '', crop_cycle_id: '', scouting_date: '', scout_name: '',
  growth_stage: '', plant_health: 'Healthy', pest_observation: '', disease_observation: '',
  weed_observation: '', soil_observation: '', moisture_observation: '', recommendation: '',
  photo_url: null, notes: '',
};

function Body(form) {
  const { bind, values, set } = form;
  const { items: crops } = useAll('crops');
  return (
    <>
      <FarmFieldRow {...form} />
      <FormRow>
        <SelectField
          label="Crop"
          {...bind('crop_id')}
          placeholder="Select Crop"
          options={crops.map((c) => ({ value: c.id, label: c.name }))}
        />
        <CycleSelect bind={bind} />
      </FormRow>
      <FormRow>
        <DateField label="Scouting Date" required {...bind('scouting_date')} />
        <TextField label="Scout Name" {...bind('scout_name')} />
      </FormRow>
      <FormRow>
        <TextField label="Growth Stage" {...bind('growth_stage')} />
        <SelectField label="Plant Health" {...bind('plant_health')} options={PLANT_HEALTH} />
      </FormRow>
      <TextArea label="Pest Observation" {...bind('pest_observation')} />
      <TextArea label="Disease Observation" {...bind('disease_observation')} />
      <TextArea label="Weed Observation" {...bind('weed_observation')} />
      <FormRow>
        <TextField label="Soil Observation" {...bind('soil_observation')} />
        <TextField label="Moisture Observation" {...bind('moisture_observation')} />
      </FormRow>
      <TextArea label="Recommendation" {...bind('recommendation')} />
      <PhotoUpload value={values.photo_url} onChange={(url) => set('photo_url', url)} />
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function ScoutForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="crop-scouting-records"
      title="Scouting Record"
      initial={INITIAL}
      fromRow={(r) => ({
        farm_id: r.farm_id || '', field_id: r.field_id || '', crop_id: r.crop_id || '',
        crop_cycle_id: r.crop_cycle_id || '', photo_url: r.photo_url || null,
      })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        field_id: v.field_id || null,
        crop_id: v.crop_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function Scouting() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="crop-scouting-records"
      title="Crop Scouting"
      subtitle="Monitor crop health with field observations."
      addLabel="Add Scouting Record"
      searchPlaceholder="Search scout or observation..."
      emptyIcon="fa-search"
      emptyTitle="No Scouting Records"
      emptyDescription="Record field scouting observations to monitor crop health."
      FormComponent={ScoutForm}
      defaultSort={{ sort: 'scouting_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'plant_health', placeholder: 'All Health', options: PLANT_HEALTH },
      ]}
      columns={[
        { key: 'scouting_date', label: 'Date', sortable: true, render: (r) => formatDate(r.scouting_date) },
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
        { key: 'crop', label: 'Crop', render: (r) => <span className="badge badge-primary">{r.crops?.name || '—'}</span> },
        { key: 'plant_health', label: 'Health', render: (r) => <StatusBadge status={r.plant_health} /> },
        { key: 'growth_stage', label: 'Growth Stage', render: (r) => r.growth_stage || '—' },
        { key: 'pest', label: 'Pest', render: (r) => (r.pest_observation ? <span className="text-danger text-xs font-semibold">Yes</span> : <span className="text-muted text-xs">None</span>) },
        { key: 'disease', label: 'Disease', render: (r) => (r.disease_observation ? <span className="text-danger text-xs font-semibold">Yes</span> : <span className="text-muted text-xs">None</span>) },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.scouting_date)],
        ['Scout', r.scout_name],
        ['Farm', r.farms?.name],
        ['Field', r.fields?.name],
        ['Crop', r.crops?.name],
        ['Growth Stage', r.growth_stage],
        ['Plant Health', r.plant_health],
        ['Moisture', r.moisture_observation],
        ['Pest Observation', r.pest_observation || 'None observed', true],
        ['Disease Observation', r.disease_observation || 'None observed', true],
        ['Weed Observation', r.weed_observation || 'None observed', true],
        ['Soil Observation', r.soil_observation, true],
        ['Recommendation', r.recommendation, true],
        [
          'Photo',
          r.photo_url ? (
            <img src={r.photo_url} alt="scouting" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 8 }} />
          ) : (
            '—'
          ),
          true,
        ],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
