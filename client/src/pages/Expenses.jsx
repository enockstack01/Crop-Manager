import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { FormRow, TextField, DateField, SelectField, TextArea, MoneyField } from '../components/form.jsx';
import { CycleSelect } from '../components/relationFields.jsx';
import { useAll } from '../lib/useResource.js';
import { formatCurrency, formatDate } from '../lib/format.js';
import { EXPENSE_CATEGORIES } from '../lib/options.js';

const INITIAL = {
  currency: '',
  farm_id: '', crop_cycle_id: '', category: '', description: '', amount: 0,
  expense_date: '', payment_method: '', supplier: '', notes: '',
};

function Body({ bind }) {
  const { items: farms } = useAll('farms');
  return (
    <>
      <FormRow>
        <SelectField
          label="Farm"
          {...bind('farm_id')}
          placeholder="Select Farm"
          options={farms.map((f) => ({ value: f.id, label: f.name }))}
        />
        <SelectField label="Category" required {...bind('category')} placeholder="Select Category" options={EXPENSE_CATEGORIES} />
      </FormRow>
      <CycleSelect bind={bind} />
      <FormRow>
        <MoneyField label="Amount" required bind={bind} name="amount" />
        <DateField label="Expense Date" required {...bind('expense_date')} />
      </FormRow>
      <TextField label="Description" {...bind('description')} />
      <FormRow>
        <TextField label="Payment Method" {...bind('payment_method')} />
        <TextField label="Supplier" {...bind('supplier')} />
      </FormRow>
      <TextArea label="Notes" {...bind('notes')} />
    </>
  );
}

function ExpenseForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="expenses"
      title="Expense"
      initial={INITIAL}
      fromRow={(r) => ({ farm_id: r.farm_id || '', crop_cycle_id: r.crop_cycle_id || '' })}
      toPayload={(v) => ({
        ...v,
        farm_id: v.farm_id || null,
        crop_cycle_id: v.crop_cycle_id || null,
        amount: Number(v.amount) || 0,
      })}
    >
      {(form) => <Body {...form} />}
    </ResourceForm>
  );
}

export default function Expenses() {
  const { items: farms } = useAll('farms');
  return (
    <CrudPage
      resource="expenses"
      title="Expenses"
      subtitle="Track all farm-related expenditures."
      addLabel="Add Expense"
      searchPlaceholder="Search description or supplier..."
      emptyIcon="fa-receipt"
      emptyTitle="No Expenses"
      emptyDescription="Track all farm-related expenditures."
      FormComponent={ExpenseForm}
      defaultSort={{ sort: 'expense_date', order: 'desc' }}
      filters={[
        { key: 'farm_id', placeholder: 'All Farms', options: farms.map((f) => ({ value: f.id, label: f.name })) },
        { key: 'category', placeholder: 'All Categories', options: EXPENSE_CATEGORIES },
      ]}
      columns={[
        { key: 'expense_date', label: 'Date', sortable: true, render: (r) => formatDate(r.expense_date) },
        { key: 'category', label: 'Category', render: (r) => <span className="badge badge-primary">{r.category || 'Other'}</span> },
        { key: 'description', label: 'Description', className: 'text-truncate', render: (r) => r.description || '—' },
        { key: 'farm', label: 'Farm', render: (r) => r.farms?.name || '—' },
        { key: 'amount', label: 'Amount', render: (r) => <strong style={{ color: 'var(--red)' }}>{formatCurrency(r.amount, r.currency)}</strong> },
        { key: 'supplier', label: 'Supplier', render: (r) => r.supplier || '—' },
      ]}
      viewFields={(r) => [
        ['Date', formatDate(r.expense_date)],
        ['Category', r.category],
        ['Amount', formatCurrency(r.amount, r.currency)],
        ['Farm', r.farms?.name],
        ['Payment Method', r.payment_method],
        ['Supplier', r.supplier],
        ['Description', r.description, true],
        ['Notes', r.notes, true],
      ]}
    />
  );
}
