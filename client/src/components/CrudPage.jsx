import { useState } from 'react';
import { useList, useResourceMutations } from '../lib/useResource.js';
import { debounce } from '../lib/format.js';
import { useToast } from './Toast.jsx';
import { useConfirm } from './Confirm.jsx';
import { Modal } from './Modal.jsx';
import {
  DataTable,
  EmptyState,
  FilterSelect,
  IconButton,
  Pagination,
  PageHeader,
  TableToolbar,
  ViewGrid,
} from './ui.jsx';
import { t } from '../i18n/index.js';

const PER_PAGE = 10;

/**
 * Generic list + create/edit/delete/view screen. One `<CrudPage>` renders a full
 * module (Farms, Fields, …). `FormComponent` owns the create/edit form body and
 * receives `{ editing, onClose, onSaved }`.
 */
export function CrudPage({
  resource,
  title,
  subtitle,
  addLabel,
  searchable = true,
  searchPlaceholder = 'Search...',
  filters = [],
  columns,
  defaultSort = { sort: 'created_at', order: 'desc' },
  emptyIcon = 'fa-inbox',
  emptyTitle,
  emptyDescription,
  FormComponent,
  viewFields,
  extraActions,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const { remove } = useResourceMutations(resource);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(defaultSort.sort);
  const [order, setOrder] = useState(defaultSort.order);
  const [filterValues, setFilterValues] = useState({});
  const [formState, setFormState] = useState(null); // null | { editing: row|null }
  const [viewRow, setViewRow] = useState(null);

  const params = { page, perPage: PER_PAGE, sort, order };
  if (q) params.q = q;
  for (const [k, v] of Object.entries(filterValues)) if (v) params[k] = v;

  const { data, isLoading, isError, error } = useList(resource, params);
  const rows = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const onSearch = debounce((value) => {
    setQ(value.trim());
    setPage(1);
  }, 300);

  const onSort = (key) => {
    if (sort === key) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setOrder('asc');
    }
    setPage(1);
  };

  const onDelete = async (row) => {
    const ok = await confirm(
      t('Delete {{name}}? This action cannot be undone.', { name: `<strong>${escapeHtml(row.name || row.buyer || t('this record'))}</strong>` })
    );
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast(t('Deleted successfully'));
    } catch (err) {
      toast(err.message || t('Failed to delete'), 'error');
    }
  };

  const actions = (row) => (
    <>
      {viewFields && <IconButton icon="fa-eye" title="View" onClick={() => setViewRow(row)} />}
      {extraActions?.(row)}
      {FormComponent && (
        <IconButton icon="fa-pen" title="Edit" onClick={() => setFormState({ editing: row })} />
      )}
      <IconButton icon="fa-trash" title="Delete" danger onClick={() => onDelete(row)} />
    </>
  );

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          FormComponent && (
            <button className="btn btn-primary" onClick={() => setFormState({ editing: null })}>
              <i className="fas fa-plus" /> {t(addLabel)}
            </button>
          )
        }
      />

      {(searchable || filters.length > 0) && (
        <TableToolbar onSearch={searchable ? onSearch : undefined} searchPlaceholder={searchPlaceholder}>
          {filters.map((f) => (
            <FilterSelect
              key={f.key}
              value={filterValues[f.key] || ''}
              placeholder={f.placeholder}
              options={f.options}
              onChange={(v) => {
                setFilterValues((prev) => ({ ...prev, [f.key]: v }));
                setPage(1);
              }}
            />
          ))}
        </TableToolbar>
      )}

      {isError ? (
        <EmptyState icon="fa-exclamation-triangle" title="Could not load data" description={error?.message} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          sort={sort}
          order={order}
          onSort={onSort}
          actions={actions}
          empty={
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle || t('No {{name}}', { name: t(title) })}
              description={emptyDescription}
              actionLabel={FormComponent ? addLabel : undefined}
              onAction={() => setFormState({ editing: null })}
            />
          }
        />
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      {formState && FormComponent && (
        <FormComponent
          editing={formState.editing}
          onClose={() => setFormState(null)}
          onSaved={(msg) => {
            setFormState(null);
            toast(msg || t('Saved successfully'));
          }}
        />
      )}

      {viewRow && viewFields && (
        <Modal open onClose={() => setViewRow(null)} title={t('{{name}} details', { name: t(title) })} size="modal-lg">
          <ViewGrid items={viewFields(viewRow)} />
        </Modal>
      )}
    </>
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
