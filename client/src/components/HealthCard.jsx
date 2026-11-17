import { t } from '../i18n/index.js';

/** How each disease result looks and reads. */
export const HEALTH = {
  healthy: { label: 'Healthy', tone: 'success', icon: 'fa-leaf' },
  sick: { label: 'Possible disease', tone: 'danger', icon: 'fa-virus' },
  unsure: { label: 'Not sure', tone: 'warning', icon: 'fa-circle-question' },
  not_checked: { label: 'Disease not checked', tone: 'neutral', icon: 'fa-circle-minus' },
};

const pct = (n) => `${Math.round((n || 0) * 100)}%`;

/** The health card for one photo: the plant, and which counted fruit look diseased (numbered like the marked photo). */
export function HealthCard({ health }) {
  const h = health || { status: 'not_checked' };
  const m = HEALTH[h.status] || HEALTH.not_checked;
  const sick = (h.fruits || []).filter((f) => f.status === 'sick');
  return (
    <div className="gh-health">
      <div className="gh-health-head">
        <span className={`badge badge-${m.tone}`}><i className={`fas ${m.icon}`} /> {t(m.label)}</span>
        <strong>{t('Plant health')}</strong>
      </div>
      {h.status === 'not_checked' ? <p className="org-muted">{h.reason ? t(h.reason) : t('The disease check was not done for this photo.')}</p> : (
        <>
          <p style={{ margin: '6px 0' }}>{h.message ? t(h.message) : ''}</p>
          {h.plant?.disease && (
            <p className="org-muted" style={{ margin: '4px 0' }}>
              {t('The plant in the photo')}: <strong>{h.plant.disease}</strong> ({pct(h.plant.confidence)} {t('sure')})
              {h.plant.alternatives?.length ? `. ${t('Other possibilities')}: ${h.plant.alternatives.map((a) => `${a.disease} (${pct(a.confidence)})`).join(', ')}` : ''}
            </p>
          )}
          {h.fruits ? (
            <div className="gh-fruit-health">
              <div className="org-muted" style={{ marginBottom: 4 }}>{t('Fruit checked')}: {h.checked_fruit}. {t('Diseased')}: {h.sick_fruit}</div>
              <div className="gh-fruit-chips">
                {h.fruits.map((f) => (
                  <span key={f.index} className={`gh-chip ${f.status}`} title={f.disease || ''}>
                    #{f.index}{f.status === 'sick' ? ` ${f.disease}` : f.status === 'healthy' ? ` ${t('healthy')}` : ` ${t('not sure')}`}
                  </span>
                ))}
              </div>
              {sick.length > 0 && <p className="org-muted" style={{ margin: '6px 0 0' }}>{t('Fruit with a dashed red ring and a ! on the marked photo are the diseased ones.')}</p>}
            </div>
          ) : h.fruit_note ? <p className="org-muted" style={{ margin: '4px 0' }}>{t(h.fruit_note)}</p> : null}
          {h.fruit_note && h.fruits ? <p className="org-muted" style={{ margin: '4px 0' }}>{t(h.fruit_note)}</p> : null}
        </>
      )}
    </div>
  );
}
