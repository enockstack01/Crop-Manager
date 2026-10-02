import { useCallback, useState } from 'react';
import { CURRENCIES } from '../lib/currencies.js';

/** Tiny controlled-form helper. `bind(name)` wires an input to `values[name]`. */
export function useForm(initial = {}) {
  const [values, setValues] = useState(initial);
  const set = useCallback((name, value) => setValues((v) => ({ ...v, [name]: value })), []);
  const reset = useCallback((next = initial) => setValues(next), [initial]);
  const bind = useCallback(
    (name) => ({
      value: values[name] ?? '',
      onChange: (e) => set(name, e.target.value),
    }),
    [values, set]
  );
  return { values, setValues, set, reset, bind };
}

function Wrap({ label, required, hint, children, full }) {
  return (
    <div className="form-group" style={full ? { gridColumn: '1 / -1' } : undefined}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export function TextField({ label, required, hint, full, type = 'text', ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <input className="form-control" type={type} {...rest} />
    </Wrap>
  );
}

export function NumberField({ label, required, hint, full, step = 'any', ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <input className="form-control" type="number" step={step} {...rest} />
    </Wrap>
  );
}

export function DateField({ label, required, hint, full, ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <input className="form-control" type="date" {...rest} />
    </Wrap>
  );
}

export function TextArea({ label, required, hint, full, rows = 3, ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <textarea className="form-control form-textarea" rows={rows} {...rest} />
    </Wrap>
  );
}

export function SelectField({ label, required, hint, full, options = [], placeholder, children, ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <select className="form-control form-select" {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const value = typeof o === 'object' ? o.value : o;
          const text = typeof o === 'object' ? o.label : o;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
        {children}
      </select>
    </Wrap>
  );
}

/**
 * An amount with its currency picked right beside it: [USD ▾][ 0.00 ].
 * Every money field in a record shares the record's `currency`.
 */
export function MoneyField({ label, required, hint, full, bind, name, currencyName = 'currency', ...rest }) {
  return (
    <Wrap label={label} required={required} hint={hint} full={full}>
      <div className="money-input">
        <select className="form-control form-select money-currency" aria-label={`${label} currency`} {...bind(currencyName)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code} title={c.name}>{c.code}</option>
          ))}
        </select>
        <input className="form-control" type="number" step="any" min="0" {...bind(name)} {...rest} />
      </div>
    </Wrap>
  );
}

export function FormRow({ children, cols = 2 }) {
  return <div className={cols === 3 ? 'form-row-3' : 'form-row'}>{children}</div>;
}

export function ModalFooter({ onCancel, saving, saveLabel = 'Save', formId = 'resource-form' }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={saving}>
        {saving ? (
          <>
            <i className="fas fa-spinner fa-spin" /> Saving...
          </>
        ) : (
          <>
            <i className="fas fa-save" /> {saveLabel}
          </>
        )}
      </button>
    </>
  );
}
