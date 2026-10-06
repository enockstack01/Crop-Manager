import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CALCULATOR_BY_TYPE } from '../lib/calculators.js';
import { useResourceMutations } from '../lib/useResource.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader } from '../components/ui.jsx';
import { NumberField, SelectField } from '../components/form.jsx';
import { t } from '../i18n/index.js';

export default function CalculatorDetail() {
  const { type } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const calc = CALCULATOR_BY_TYPE[type];
  const { create } = useResourceMutations('calculation-history');

  const initial = useMemo(() => {
    const base = {};
    for (const f of calc?.fields || []) base[f.name] = f.default ?? '';
    return base;
  }, [calc]);

  const [values, setValues] = useState(initial);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setValues(initial);
    setResult(null);
    try {
      const raw = sessionStorage.getItem('calc_reopen');
      if (raw) {
        const saved = JSON.parse(raw);
        sessionStorage.removeItem('calc_reopen');
        if (saved.calculator_type === type && saved.inputs) {
          setValues({ ...initial, ...saved.inputs });
          setResult(calc.compute({ ...initial, ...saved.inputs }));
        }
      }
    } catch {
      /* ignore */
    }
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!calc) {
    return (
      <>
        <PageHeader title="Calculator not found" />
        <Link to="/calculators" className="btn btn-secondary">
          {t('Back to calculators')}
        </Link>
      </>
    );
  }

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  const run = (e) => {
    e.preventDefault();
    setResult(calc.compute(values));
  };

  const save = async () => {
    try {
      await create.mutateAsync({ calculator_type: type, inputs: values, result });
      toast('Calculation saved to history', 'info');
    } catch (err) {
      toast(err.message || 'Failed to save', 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={calc.title}
        subtitle={calc.desc}
        action={
          <button className="btn btn-secondary" onClick={() => navigate('/calculators')}>
            <i className="fas fa-arrow-left" /> {t('All Calculators')}
          </button>
        }
      />

      <form className="calc-form" onSubmit={run}>
        {calc.fields.map((f) =>
          f.type === 'select' ? (
            <SelectField key={f.name} label={f.label} value={values[f.name]} onChange={set(f.name)} options={f.options} />
          ) : (
            <NumberField key={f.name} label={f.label} value={values[f.name]} onChange={set(f.name)} />
          )
        )}

        <button type="submit" className="btn btn-primary">
          <i className="fas fa-calculator" /> {t('Calculate')}
        </button>

        {result && (
          <>
            <div className="calc-result">
              <h4>{t('Result')}</h4>
              {result.map((r) => (
                <div key={r.label} className="calc-result-item">
                  <span className="label">{r.label}</span>
                  <span className="value">{r.value}</span>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={save}>
              <i className="fas fa-save" /> {t('Save to history')}
            </button>
          </>
        )}

        <div className="calc-disclaimer">
          These calculators provide estimates for planning purposes. Always verify against agronomic
          recommendations for your specific crop, soil and conditions.
        </div>
      </form>
    </>
  );
}
