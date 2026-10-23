import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { CALCULATOR_BY_TYPE } from '../lib/calculators.js';
import { aiCalculatorReport } from '../lib/ai.js';
import { useResourceMutations } from '../lib/useResource.js';
import { useToast } from '../components/Toast.jsx';
import { PageHeader } from '../components/ui.jsx';
import { NumberField, SelectField } from '../components/form.jsx';
import { t } from '../i18n/index.js';
import { displayName } from '../lib/format.js';
import { useProfile } from '../components/profile.jsx';

/** What the farmer's records can fill in for each calculator. */
const AREA_FIELDS = ['fertilizer', 'seed-rate', 'plant-population', 'irrigation', 'rainfall', 'yield', 'crop-spacing'];

export default function CalculatorDetail() {
  const { type } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const calc = CALCULATOR_BY_TYPE[type];
  const { create } = useResourceMutations('calculation-history');
  const { data: ctx } = useQuery({ queryKey: ['calc-context'], queryFn: () => api.get('/calculators/context').then((r) => r.data), staleTime: 5 * 60 * 1000 });
  const { profile } = useProfile();

  const initial = useMemo(() => {
    const base = {};
    for (const f of calc?.fields || []) base[f.name] = f.default ?? '';
    return base;
  }, [calc]);

  const [values, setValues] = useState(initial);
  const [result, setResult] = useState(null);
  const [fieldId, setFieldId] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setValues(initial);
    setResult(null);
    setReport(null);
    setFieldId('');
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
        <Link to="/calculators" className="btn btn-secondary">{t('Back to calculators')}</Link>
      </>
    );
  }

  const set = (name) => (e) => { setValues((v) => ({ ...v, [name]: e.target.value })); setReport(null); };
  const setMany = (patch) => { setValues((v) => ({ ...v, ...patch })); setReport(null); };
  const field = ctx?.fields?.find((f) => f.id === fieldId);
  const water = ctx?.water;

  const pickField = (id) => {
    setFieldId(id);
    const f = ctx?.fields?.find((x) => x.id === id);
    if (f?.area_ha && AREA_FIELDS.includes(type)) {
      const patch = { area: String(f.area_ha) };
      if (calc.fields.some((x) => x.name === 'unit')) patch.unit = 'hectares';
      if (calc.fields.some((x) => x.name === 'areaUnit')) patch.areaUnit = 'hectares';
      setMany(patch);
    }
  };

  const run = (e) => {
    e.preventDefault();
    setResult(calc.compute(values));
    setReport(null);
    setErr('');
  };

  const save = async () => {
    try {
      await create.mutateAsync({ calculator_type: type, inputs: values, result });
      toast('Calculation saved to history', 'info');
    } catch (e2) {
      toast(e2.message || 'Failed to save', 'error');
    }
  };

  const inputRows = () => calc.fields.filter((f) => values[f.name] !== '' && values[f.name] != null).map((f) => [f.label, values[f.name]]);

  const explain = async () => {
    setBusy(true);
    setErr('');
    try {
      const out = await aiCalculatorReport({ type: calc.title, inputs: Object.fromEntries(inputRows()), results: result, field_name: field?.name });
      setReport(out.report);
    } catch (e2) {
      setErr(e2.message || t('The assistant could not explain this now. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const { downloadCalculatorPdf } = await import('../lib/pdfReport.js');
    await downloadCalculatorPdf({
      calc, inputs: inputRows(), results: result, report, owner: [displayName(profile), profile?.public_id].filter(Boolean).join(' · '), field: field?.name,
      fileName: `cropmanager-${type}-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  return (
    <>
      <PageHeader
        title={calc.title}
        subtitle={calc.desc}
        action={(
          <button className="btn btn-secondary" onClick={() => navigate('/calculators')}>
            <i className="fas fa-arrow-left" /> {t('All Calculators')}
          </button>
        )}
      />

      <form className="calc-form" onSubmit={run}>
        {AREA_FIELDS.includes(type) && ctx?.fields?.length > 0 && (
          <div className="calc-assist">
            <label className="form-label"><i className="fas fa-map" /> {t('Use one of my fields')}</label>
            <select className="form-control" value={fieldId} onChange={(e) => pickField(e.target.value)}>
              <option value="">{t('Choose a field to fill the area')}</option>
              {ctx.fields.map((f) => (
                <option key={f.id} value={f.id}>{f.name}{f.farm ? ` · ${f.farm}` : ''}{f.area_ha ? ` · ${f.area_ha} ha` : ''}{f.crop ? ` · ${f.crop}` : ''}</option>
              ))}
            </select>
            {field && <small className="calc-hint">{[field.crop && `${t('Growing')}: ${field.crop}`, field.soil && `${t('Soil')}: ${field.soil}`, field.soil_ph != null && `pH ${field.soil_ph}`].filter(Boolean).join(' · ')}</small>}
          </div>
        )}

        {water && (type === 'irrigation' || type === 'rainfall') && (
          <div className="calc-assist weather">
            <i className="fas fa-cloud-sun-rain" />
            <div>
              {type === 'irrigation' && (
                <>
                  <strong>{t('Weather water plan for {{place}}', { place: water.location })}</strong>
                  <span>{t('This week plants use about {{use}} mm and about {{rain}} mm of rain is useful: irrigate about {{need}} mm.', { use: water.crop_water_use_mm, rain: water.expected_useful_rain_mm, need: water.irrigation_needed_mm })}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMany({ depth: String(water.irrigation_needed_mm) })}>{t('Use {{n}} mm', { n: water.irrigation_needed_mm })}</button>
                </>
              )}
              {type === 'rainfall' && (
                <>
                  <strong>{t('Rain at {{place}}', { place: water.location })}</strong>
                  <div className="calc-chips">
                    {water.rain_past_7d_mm != null && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMany({ depth: String(water.rain_past_7d_mm) })}>{t('Last 7 days: {{n}} mm', { n: water.rain_past_7d_mm })}</button>}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMany({ depth: String(water.rain_next_3_days_mm) })}>{t('Next 3 days: {{n}} mm', { n: water.rain_next_3_days_mm })}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

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
            <div className="calc-actions">
              <button type="button" className="btn btn-primary" onClick={explain} disabled={busy}>
                <i className={`fas ${busy ? 'fa-circle-notch fa-spin' : 'fa-magic'}`} /> {busy ? t('Working...') : t('Explain with my farm data')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={save}><i className="fas fa-save" /> {t('Save to history')}</button>
              <button type="button" className="btn btn-secondary" onClick={download}><i className="fas fa-file-pdf" /> {t('Download report (PDF)')}</button>
            </div>
            {err && <p className="ai-missing">{err}</p>}
          </>
        )}

        {report && <CalcReport r={report} />}

        <div className="calc-disclaimer">
          {t('These calculators provide estimates for planning purposes. Always verify against agronomic recommendations for your specific crop, soil and conditions.')}
        </div>
      </form>
    </>
  );
}

function CalcReport({ r }) {
  return (
    <div className="calc-report">
      <h4><i className="fas fa-clipboard-check" /> {r.headline}</h4>
      {r.meaning?.length > 0 && (
        <section><h5>{t('What the results mean')}</h5>
          {r.meaning.map((m, i) => (<p key={i}><strong>{m.result}.</strong> {m.explanation}</p>))}
        </section>
      )}
      {r.estimates?.length > 0 && (
        <section><h5>{t('Other estimates')}</h5>
          <table className="calc-table"><tbody>
            {r.estimates.map((e, i) => (<tr key={i}><th>{e.label}</th><td>{e.value}</td><td>{e.note}</td></tr>))}
          </tbody></table>
        </section>
      )}
      {r.recommendations?.length > 0 && (
        <section><h5>{t('Recommended steps')}</h5>
          <ol>{r.recommendations.map((x, i) => (<li key={i}><strong>{x.action}</strong>{x.detail ? ` — ${x.detail}` : ''}</li>))}</ol>
        </section>
      )}
      {r.farm_link && <section><h5>{t('Your farm')}</h5><p>{r.farm_link}</p></section>}
      {r.weather_note && <section><h5>{t('Weather')}</h5><p>{r.weather_note}</p></section>}
      {r.cautions?.length > 0 && <section><h5>{t('Watch out for')}</h5><ul>{r.cautions.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
      {r.assumptions?.length > 0 && <section><h5>{t('Assumptions')}</h5><ul>{r.assumptions.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
    </div>
  );
}
