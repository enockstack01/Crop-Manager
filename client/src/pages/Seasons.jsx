import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea } from '../components/form.jsx';
import { StatusBadge } from '../components/ui.jsx';
import { formatDate } from '../lib/format.js';
import { SEASON_STATUS } from '../lib/options.js';

const INITIAL = { name: '', start_date: '', end_date: '', description: '', status: 'Active', notes: '' };

function SeasonForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="seasons"
      title="Season"
      initial={INITIAL}
      toPayload={(v) => ({ ...v, start_date: v.start_date || null, end_date: v.end_date || null })}
    >
      {({ bind }) => (
        <>
          <TextField label="Season Name" required {...bind('name')} placeholder="e.g. 2025/2026 Rainy" />
          <FormRow>
            <DateField label="Start Date" {...bind('start_date')} />
            <DateField label="End Date" {...bind('end_date')} />
          </FormRow>
          <SelectField label="Status" {...bind('status')} options={SEASON_STATUS} />
          <TextArea label="Description" {...bind('description')} />
          <TextArea label="Notes" {...bind('notes')} />
        </>
      )}
    </ResourceForm>
  );
}

export default function Seasons() {
  return (
    <CrudPage
      resource="seasons"
      title="Seasons"
      subtitle="Organize crop production by growing period."
      addLabel="Add Season"
      searchPlaceholder="Search seasons..."
      emptyIcon="fa-calendar-alt"
      emptyTitle="No Seasons Yet"
      emptyDescription="Define your growing seasons to organize crop production by period."
      FormComponent={SeasonForm}
      filters={[{ key: 'status', placeholder: 'All Statuses', options: SEASON_STATUS }]}
      columns={[
        { key: 'name', label: 'Season', sortable: true, render: (r) => <strong>{r.name}</strong> },
        { key: 'start_date', label: 'Start Date', render: (r) => formatDate(r.start_date) },
        { key: 'end_date', label: 'End Date', render: (r) => formatDate(r.end_date) },
        { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'description', label: 'Description', className: 'text-truncate', render: (r) => r.description || '—' },
      ]}
      viewFields={(r) => [
        ['Season Name', r.name],
        ['Status', r.status],
        ['Start Date', formatDate(r.start_date)],
        ['End Date', formatDate(r.end_date)],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
