import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CrudPage } from '../components/CrudPage.jsx';
import { ResourceForm } from '../components/ResourceForm.jsx';
import { Modal } from '../components/Modal.jsx';
import { FormRow, NumberField, TextField, DateField, SelectField, TextArea, ModalFooter } from '../components/form.jsx';
import { IconButton, StatusBadge } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import { formatCurrency, formatDate, formatNumber } from '../lib/format.js';
import { INVENTORY_CATEGORIES, INVENTORY_UNITS } from '../lib/options.js';

const INITIAL = {
  name: '', category: '', unit: 'kg', current_quantity: 0, minimum_stock: 0, unit_cost: 0,
  supplier: '', expiry_date: '', storage_location: '', notes: '',
};
const n0 = (v) => Number(v) || 0;

function stockStatus(i) {
  if (i.current_quantity <= 0) return 'Out of Stock';
  if (i.current_quantity <= i.minimum_stock * 1.5) return 'Low Stock';
  return 'In Stock';
}

function ItemForm(props) {
  return (
    <ResourceForm
      {...props}
      resource="inventory-items"
      title="Item"
      initial={INITIAL}
      toPayload={(v) => ({
        ...v,
        current_quantity: n0(v.current_quantity),
        minimum_stock: n0(v.minimum_stock),
        unit_cost: n0(v.unit_cost),
        expiry_date: v.expiry_date || null,
      })}
    >
      {({ bind }) => (
        <>
          <FormRow>
            <TextField label="Item Name" required {...bind('name')} />
            <SelectField label="Category" required {...bind('category')} placeholder="Select Category" options={INVENTORY_CATEGORIES} />
          </FormRow>
          <FormRow>
            <SelectField label="Unit" {...bind('unit')} options={INVENTORY_UNITS} />
            <NumberField label="Unit Cost" {...bind('unit_cost')} />
          </FormRow>
          <FormRow>
            <NumberField label="Current Quantity" {...bind('current_quantity')} />
            <NumberField label="Minimum Stock" {...bind('minimum_stock')} />
          </FormRow>
          <FormRow>
            <TextField label="Supplier" {...bind('supplier')} />
            <DateField label="Expiry Date" {...bind('expiry_date')} />
          </FormRow>
          <TextField label="Storage Location" {...bind('storage_location')} />
          <TextArea label="Notes" {...bind('notes')} />
        </>
      )}
    </ResourceForm>
  );
}

function StockModal({ item, type, onClose }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');

  const mutate = useMutation({
    mutationFn: () => api.post(`/inventory-items/${item.id}/stock`, { type, quantity: Number(qty), notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${type === 'in' ? 'Added' : 'Removed'} ${qty} ${item.unit}`);
      onClose();
    },
    onError: (e) => toast(e.message || 'Failed', 'error'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={type === 'in' ? 'Stock In' : 'Stock Out'}
      size="modal-sm"
      footer={<ModalFooter onCancel={onClose} saving={mutate.isPending} saveLabel="Confirm" formId="stock-form" />}
    >
      <form
        id="stock-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (Number(qty) > 0) mutate.mutate();
        }}
      >
        <p style={{ color: 'var(--text-light)', marginBottom: 12 }}>
          Current stock: <strong>{formatNumber(item.current_quantity)} {item.unit}</strong>
        </p>
        <NumberField label={`Quantity to ${type === 'in' ? 'add' : 'remove'}`} required value={qty} onChange={(e) => setQty(e.target.value)} />
        <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const [stockFor, setStockFor] = useState(null);

  return (
    <>
      <CrudPage
        resource="inventory-items"
        title="Inventory"
        subtitle="Track your stock levels."
        addLabel="Add Item"
        searchPlaceholder="Search item or supplier..."
        emptyIcon="fa-boxes"
        emptyTitle="No Inventory Items"
        emptyDescription="Add items to track your stock levels."
        FormComponent={ItemForm}
        defaultSort={{ sort: 'name', order: 'asc' }}
        filters={[{ key: 'category', placeholder: 'All Categories', options: INVENTORY_CATEGORIES }]}
        extraActions={(row) => (
          <>
            <IconButton icon="fa-arrow-up" title="Stock In" color="var(--green)" onClick={() => setStockFor({ item: row, type: 'in' })} />
            <IconButton icon="fa-arrow-down" title="Stock Out" color="var(--red)" onClick={() => setStockFor({ item: row, type: 'out' })} />
          </>
        )}
        columns={[
          { key: 'name', label: 'Item', sortable: true, render: (r) => <strong>{r.name}</strong> },
          { key: 'category', label: 'Category', render: (r) => <span className="badge badge-primary">{r.category}</span> },
          { key: 'current_quantity', label: 'Current Stock', render: (r) => <strong>{formatNumber(r.current_quantity)}</strong> },
          { key: 'minimum_stock', label: 'Min Stock', render: (r) => formatNumber(r.minimum_stock) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={stockStatus(r)} /> },
          { key: 'unit_cost', label: 'Unit Cost', render: (r) => (r.unit_cost ? formatCurrency(r.unit_cost) : '—') },
          { key: 'expiry_date', label: 'Expiry', render: (r) => (r.expiry_date ? formatDate(r.expiry_date) : '—') },
        ]}
        viewFields={(r) => [
          ['Item', r.name],
          ['Category', r.category],
          ['Current Stock', `${formatNumber(r.current_quantity)} ${r.unit}`],
          ['Minimum Stock', formatNumber(r.minimum_stock)],
          ['Status', stockStatus(r)],
          ['Unit Cost', formatCurrency(r.unit_cost)],
          ['Supplier', r.supplier],
          ['Expiry Date', r.expiry_date ? formatDate(r.expiry_date) : '—'],
          ['Storage Location', r.storage_location],
          ['Notes', r.notes, true],
        ]}
      />
      {stockFor && <StockModal item={stockFor.item} type={stockFor.type} onClose={() => setStockFor(null)} />}
    </>
  );
}
