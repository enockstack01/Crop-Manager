import { Link } from 'react-router-dom';
import { badgeClass } from '../lib/format.js';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div
      className="flex items-center justify-between mb-24"
      style={{ flexWrap: 'wrap', gap: 12 }}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="page-subtitle" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * A number that scales its font to the width of its container and the length of the
 * text, so long values (e.g. "ZMW 12,345,678.00") never overflow a card. The nearest
 * `container-type: inline-size` ancestor (.stat-tile, .kpi-info) is the measure.
 */
export function FitValue({ value, className = '', style }) {
  const text = value === null || value === undefined || value === '' ? '—' : value;
  const chars = typeof text === 'string' || typeof text === 'number' ? String(text).length : 8;
  return (
    <div className={`fit-value ${className}`} style={{ '--chars': Math.max(chars, 4), ...style }}>
      {text}
    </div>
  );
}

/** Centered label / value / unit tile; lay several out in a `.stat-grid`. */
export function StatTile({ label, value, sub, color = 'var(--text)', tone, max }) {
  return (
    <div className={`stat-tile${tone ? ` tone-${tone}` : ''}`}>
      <div className="stat-tile-label">{label}</div>
      <FitValue value={value} style={{ color, ...(max ? { '--fit-max': `${max}px` } : null) }} />
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }) {
  if (!status) return <span>—</span>;
  return <span className={`badge ${badgeClass(status)}`}>{status}</span>;
}

export function Loading({ label = 'Loading data...' }) {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ icon = 'fa-inbox', title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <i className={`fas ${icon}`} />
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-desc">{description}</p>}
      {actionLabel && (
        <button className="btn btn-primary" onClick={onAction}>
          <i className="fas fa-plus" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  const nums = [];
  for (let i = start; i <= end; i += 1) nums.push(i);

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <i className="fas fa-chevron-left" />
      </button>
      {start > 1 && (
        <>
          <button className="page-btn" onClick={() => onChange(1)}>
            1
          </button>
          {start > 2 && <span className="page-dots">...</span>}
        </>
      )}
      {nums.map((n) => (
        <button
          key={n}
          className={`page-btn ${n === page ? 'active' : ''}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="page-dots">...</span>}
          <button className="page-btn" onClick={() => onChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  );
}

export function TableToolbar({ search, onSearch, searchPlaceholder = 'Search...', children }) {
  return (
    <div className="table-toolbar">
      <div className="table-toolbar-left">
        {onSearch && (
          <div className="table-search">
            <i className="fas fa-search" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              defaultValue={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function FilterSelect({ value, onChange, placeholder, options }) {
  return (
    <select className="table-filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const t = typeof o === 'object' ? o.label : o;
        return (
          <option key={v} value={v}>
            {t}
          </option>
        );
      })}
    </select>
  );
}

/**
 * Generic sortable data table.
 * columns: [{ key, label, sortable?, render?(row), className?, width? }]
 */
export function DataTable({
  columns,
  rows,
  loading,
  sort,
  order,
  onSort,
  actions,
  empty,
  rowKey = (r) => r.id,
}) {
  if (loading) return <Loading />;
  if (!rows || rows.length === 0) return empty || null;

  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.sortable ? 'sortable' : undefined}
                onClick={c.sortable ? () => onSort(c.key) : undefined}
              >
                {c.label}
                {c.sortable && (
                  <i
                    className={`fas ${
                      sort === c.key ? (order === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'
                    }`}
                  />
                )}
              </th>
            ))}
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.render ? c.render(row) : row[c.key] ?? '—'}
                </td>
              ))}
              {actions && <td className="table-actions">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RowActions({ children }) {
  return <>{children}</>;
}

export function IconButton({ icon, title, danger, onClick, color }) {
  return (
    <button
      className={`btn-icon ${danger ? 'btn-icon-danger' : ''}`}
      title={title}
      onClick={onClick}
      type="button"
    >
      <i className={`fas ${icon}`} style={color ? { color } : undefined} />
    </button>
  );
}

export function ViewGrid({ items }) {
  return (
    <div className="view-grid">
      {items.map(([label, value, full]) => (
        <div key={label} className={`view-item ${full ? 'full-width' : ''}`}>
          <label>{label}</label>
          <p>{value ?? '—'}</p>
        </div>
      ))}
    </div>
  );
}

export { Link };
