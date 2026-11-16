import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { aiWeatherBriefing } from '../lib/ai.js';
import { PageHeader, EmptyState, Loading } from '../components/ui.jsx';
import { t } from '../i18n/index.js';

export const WEATHER_ICON = { clear: 'fa-sun', partly: 'fa-cloud-sun', clouds: 'fa-cloud', fog: 'fa-smog', drizzle: 'fa-cloud-rain', rain: 'fa-cloud-showers-heavy', storm: 'fa-bolt', snow: 'fa-snowflake' };
const LEVEL_ICON = { warn: 'fa-exclamation-triangle', watch: 'fa-eye', info: 'fa-check-circle' };

/** Weather at the exact point of a field: the one chosen, else the first field that has coordinates. */
export const useWeather = (fieldId) =>
  useQuery({ queryKey: ['weather', 'field', fieldId || ''], queryFn: () => api.get('/weather', { params: fieldId ? { field_id: fieldId } : {} }).then((r) => r.data), staleTime: 5 * 60 * 1000 });

const dayName = (d, opts) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);
const hour = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export default function Weather() {
  const [fieldId, setFieldId] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch, isFetching } = useWeather(fieldId);
  const [briefing, setBriefing] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const brief = async () => {
    setBusy(true);
    setErr('');
    try {
      setBriefing((await aiWeatherBriefing(fieldId || data?.field_id)).briefing);
    } catch (e) {
      setErr(e.message || t('Could not get the briefing'));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return (<><PageHeader title="Weather" subtitle="Forecast and advice at the exact point of your field." /><Loading /></>);
  if (isError) return (<><PageHeader title="Weather" /><EmptyState icon="fa-cloud" title="Weather is not available right now" description="Check your connection and try again." actionLabel="Try again" onAction={refetch} /></>);
  const fieldPicker = data.fields?.length > 0 && (
    <select className="form-control" value={fieldId || data.field_id || ''} onChange={(e) => setFieldId(e.target.value)} aria-label={t('Field')}>
      {data.fields.map((f) => <option key={f.id} value={f.id}>{f.name}{f.farm_name ? ` · ${f.farm_name}` : ''}{f.has_coordinates ? '' : ` (${t('no coordinates')})`}</option>)}
    </select>
  );
  if (!data.located) {
    const missing = data.reason === 'field_no_coordinates';
    return (
      <>
        <PageHeader title="Weather" subtitle="Forecast and advice at the exact point of your field." action={fieldPicker ? <div className="weather-tools">{fieldPicker}</div> : null} />
        <EmptyState
          icon="fa-map-marker-alt"
          title={missing ? 'This field has no coordinates yet' : data.reason === 'no_coordinates' ? 'Add the coordinates of a field' : 'Add a field with its coordinates'}
          description={missing || data.reason === 'no_coordinates'
            ? 'The weather is shown for the exact point of a field. Open the field and enter its latitude and longitude.'
            : 'The weather is shown for the exact point of a field. Add a field and enter its exact latitude and longitude.'}
          actionLabel="Go to Fields"
          onAction={() => navigate('/fields')}
        />
      </>
    );
  }

  const c = data.current;
  const w = data.water;
  return (
    <>
      <PageHeader
        title="Weather"
        subtitle="Forecast and advice at the exact point of your field."
        action={(
          <div className="weather-tools">
            {fieldPicker}
            <button type="button" className="btn btn-secondary" onClick={() => refetch()} disabled={isFetching}><i className={`fas fa-sync-alt ${isFetching ? 'fa-spin' : ''}`} /> {t('Refresh')}</button>
          </div>
        )}
      />

      {data.approximate && (
        <div className="alert-item alert-warning" style={{ marginBottom: 16 }}>
          <i className="fas fa-exclamation-triangle" />
          <div className="alert-content">
            {t('This weather is approximate: it is for the place name of your farm, not for a field. Add the exact coordinates of a field to see the weather at the field.')}
            {' '}<button type="button" className="btn btn-secondary" onClick={() => navigate('/fields')}>{t('Go to Fields')}</button>
          </div>
        </div>
      )}

      <div className="weather-hero">
        <div className="weather-now">
          <i className={`fas ${WEATHER_ICON[c.kind] || 'fa-cloud'} weather-big`} />
          <div>
            <div className="weather-temp">{Math.round(c.temp)}°C</div>
            <div className="weather-desc">{t(c.description ? c.description[0].toUpperCase() + c.description.slice(1) : '')}</div>
            <div className="weather-place"><i className="fas fa-map-marker-alt" /> {data.location.name}{data.location.farm_name ? ` · ${data.location.farm_name}` : ''}</div>
            <div className="weather-place weather-coords">{t('Exact point')}: {Number(data.location.lat).toFixed(6)}, {Number(data.location.lon).toFixed(6)}</div>
          </div>
        </div>
        <div className="weather-stats">
          <Stat icon="fa-temperature-low" label="Feels like" value={`${Math.round(c.feels)}°C`} />
          <Stat icon="fa-tint" label="Humidity" value={`${c.humidity}%`} />
          <Stat icon="fa-wind" label="Wind" value={`${Math.round(c.wind_kph)} km/h`} />
          <Stat icon="fa-cloud" label="Cloud cover" value={c.clouds != null ? `${c.clouds}%` : '-'} />
          <Stat icon="fa-compress-arrows-alt" label="Pressure" value={`${c.pressure} hPa`} />
          <Stat icon="fa-cloud-rain" label="Rain, past 7 days" value={data.rain_past_7d_mm != null ? `${data.rain_past_7d_mm} mm` : '-'} />
        </div>
      </div>

      <div className="chart-card mb-24">
        <div className="chart-card-header"><h3><i className="fas fa-clock" /> {t('Next hours')}</h3></div>
        <div className="chart-card-body weather-hours">
          {data.hourly.slice(0, 8).map((h) => (
            <div className="weather-hour" key={h.time}>
              <div className="weather-hour-t">{hour(h.time)}</div>
              <i className={`fas ${WEATHER_ICON[h.kind] || 'fa-cloud'}`} />
              <strong>{Math.round(h.temp)}°</strong>
              <span className="weather-pop"><i className="fas fa-tint" /> {h.pop}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-card mb-24">
        <div className="chart-card-header"><h3><i className="fas fa-calendar-week" /> {t('Forecast')}</h3></div>
        <div className="chart-card-body weather-days">
          {data.daily.slice(0, 7).map((d, i) => (
            <div className="weather-day" key={d.date}>
              <div className="weather-day-n">{i === 0 ? t('Today') : dayName(d.date, { weekday: 'short' })}<small>{dayName(d.date, { day: 'numeric', month: 'short' })}</small></div>
              <i className={`fas ${WEATHER_ICON[d.kind] || 'fa-cloud'}`} />
              <div className="weather-day-t"><strong>{Math.round(d.tmax)}°</strong> <span>{Math.round(d.tmin)}°</span></div>
              <div className="weather-day-r"><i className="fas fa-tint" /> {d.rain_mm} mm <small>{d.pop}%</small></div>
            </div>
          ))}
        </div>
      </div>

      <div className="weather-grid">
        <div className="chart-card">
          <div className="chart-card-header"><h3><i className="fas fa-seedling" /> {t('Advice for this field')}</h3></div>
          <div className="chart-card-body">
            {data.crops.length > 0 && <p className="ai-lead">{t('Based on the active crops in this field: {{crops}}', { crops: data.crops.join(', ') })}</p>}
            {data.advice.map((a, i) => (
              <div className={`weather-advice ${a.level}`} key={i}>
                <i className={`fas ${LEVEL_ICON[a.level]}`} />
                <div><strong>{t(a.topic)}</strong><div>{a.text}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header"><h3><i className="fas fa-water" /> {t('Water plan, next {{n}} days', { n: w.days })}</h3></div>
          <div className="chart-card-body">
            <div className="water-rows">
              <div><span>{t('Crop water use')}</span><strong>{w.crop_water_use_mm} mm</strong></div>
              <div><span>{t('Useful rain expected')}</span><strong>{w.expected_useful_rain_mm} mm</strong></div>
              <div className="water-need"><span>{t('Irrigation needed')}</span><strong>{w.irrigation_needed_mm} mm</strong></div>
            </div>
            <p className="ai-disclaimer"><i className="fas fa-info-circle" /> {t('1 mm of water is 1 litre on every square metre. The Irrigation calculator uses this plan.')}</p>
          </div>
        </div>
      </div>

      <div className="chart-card mt-24">
        <div className="chart-card-header">
          <h3><i className="fas fa-magic" /> {t('Weekly briefing')}</h3>
          <button type="button" className="btn btn-primary" onClick={brief} disabled={busy}>{busy ? t('Working...') : t('Write my briefing')}</button>
        </div>
        <div className="chart-card-body">
          {err && <p className="ai-missing">{err}</p>}
          {briefing ? <div className="weather-brief">{briefing}</div> : <p className="ai-lead">{t('The assistant reads the forecast together with your fields, crops and records and tells you what to do this week.')}</p>}
        </div>
      </div>
      <p className="ai-disclaimer">{t('Weather data from {{p}}. Forecasts change: check again before big decisions.', { p: data.provider })}</p>
    </>
  );
}

function Stat({ icon, label, value }) {
  return (<div className="weather-stat"><i className={`fas ${icon}`} /><span>{t(label)}</span><strong>{value}</strong></div>);
}
