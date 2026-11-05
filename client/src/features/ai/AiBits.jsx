import { useEffect, useState } from 'react';
import { aiStatus } from '../../lib/ai.js';
import { t } from '../../i18n/index.js';

/** The note every AI answer carries: it supports, and does not replace, an expert. */
export function AiDisclaimer() {
  return (
    <p className="ai-disclaimer">
      <i className="fas fa-circle-info" />{' '}
      {t('AI advice is a guide, not a prescription. Follow product labels and local rules, and ask an agronomist or vet for serious problems. The text you send is processed by our AI service.')}
    </p>
  );
}

/** Shows why the assistant is unavailable and how many requests are left today. */
export function AiStatusBar() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let live = true;
    aiStatus().then((d) => live && setS(d)).catch(() => live && setS({ enabled: false, error: true }));
    return () => { live = false; };
  }, []);
  if (!s) return null;
  if (!s.enabled) {
    return (
      <div className="ai-status ai-status-off">
        <i className="fas fa-plug-circle-xmark" />{' '}
        {s.error ? t('Could not check the AI assistant.') : t('The AI assistant is not set up yet. Your administrator needs to switch it on.')}
      </div>
    );
  }
  if (s.remaining == null) return null;
  const hourLeft = s.hourly_remaining != null && s.hourly_remaining < s.remaining;
  return (
    <div className="ai-status">
      <i className="fas fa-bolt" />{' '}
      {hourLeft ? t('{{count}} AI requests left this hour', { count: s.hourly_remaining }) : t('{{count}} AI requests left today', { count: s.remaining })}
    </div>
  );
}

export function Thinking({ label = 'Thinking…' }) {
  return (
    <div className="ai-thinking" role="status">
      <span className="spinner" /> {t(label)}
    </div>
  );
}

const SEVERITY = { Low: 'badge-success', Medium: 'badge-warning', High: 'badge-danger', Critical: 'badge-danger' };

/** Diagnosis-to-treatment report: cause, treatment, medication, how to give it. */
export function DiagnosisReport({ report: r, photo, photos = [] }) {
  return (
    <div className="ai-report">
      <div className="ai-report-head">
        {(photos.length ? photos : photo ? [photo] : []).slice(0, 3).map((p) => <img key={p} src={p} alt="" className="ai-report-photo" />)}
        <div>
          <h3>{r.title}</h3>
          <div className="ai-badges">
            <span className="badge badge-info">{t(r.problem_type)}</span>
            <span className={`badge ${SEVERITY[r.severity] || 'badge-neutral'}`}>{t('Severity')}: {t(r.severity)}</span>
            <span className="badge badge-neutral">{t('Confidence')}: {t(r.confidence)}</span>
          </div>
        </div>
      </div>
      {r.need_better_photo && (
        <div className="ai-note">
          <b>{t('The photo or notes are not enough for a sure answer.')}</b> {r.photo_tips}
        </div>
      )}
      <Section icon="fa-camera" title="What is happening" text={r.overview} />
      <Section icon="fa-leaf" title="Affected part" text={r.affected_part} />
      {r.visible_signs?.length > 0 && <Section icon="fa-eye" title="What the photo shows" text={r.visible_signs.join(' · ')} />}
      <Section icon="fa-magnifying-glass" title="Cause" text={r.cause} />
      <Section icon="fa-hand-holding-medical" title="Treatment" text={r.treatment} />
      <Section icon="fa-prescription-bottle-medical" title="Medication" text={r.medication} />
      <Section icon="fa-clipboard-list" title="How to give it" text={r.how_to_give} />
      <Section icon="fa-shield-halved" title="Prevention" text={r.prevention} />
      {r.other_possibilities?.length > 0 && (
        <Section icon="fa-list" title="Other possibilities" text={r.other_possibilities.join(' · ')} />
      )}
      <Section icon="fa-link" title="Your farm" text={r.farm_link} />
      <Section icon="fa-user-doctor" title="When to get expert help" text={r.when_to_get_help} />
      {r.follow_up_days ? (
        <p className="ai-followup"><i className="fas fa-calendar-check" /> {t('Check the crop again in {{count}} days.', { count: r.follow_up_days })}</p>
      ) : null}
    </div>
  );
}

function Section({ icon, title, text }) {
  if (!text) return null;
  return (
    <div className="ai-section">
      <h4><i className={`fas ${icon}`} /> {t(title)}</h4>
      <p>{text}</p>
    </div>
  );
}

/**
 * What the crop-disease model found in the photo: the three most likely matches with confidence bars and the
 * plant part, a retake-photo notice when the match is not certain, or a note that only the assistant read the photo.
 * `detection` is the block the server returns with a diagnosis; `hasPhoto` says whether a photo was sent.
 */
export function DetectionCard({ detection: d, hasPhoto = true }) {
  if (!d) return null;
  if (d.source !== 'classifier') {
    return hasPhoto ? (
      <p className="ai-detect-note">
        <i className="fas fa-circle-info" /> {t('Only the AI assistant read this photo. The CropHealth model could not be reached.')}
      </p>
    ) : null;
  }
  const unsure = !d.confident || d.unrecognised;
  return (
    <div className="ai-detect">
      <div className="ai-detect-head">
        <span className="badge badge-info"><i className="fas fa-microscope" /> {t('Detected by the CropHealth model')}</span>
        <span className="ai-detect-title">{t('Most likely matches')}</span>
      </div>
      <ol className="ai-detect-list">
        {d.predictions.slice(0, 3).map((p) => {
          const pct = Math.round(p.confidence * 100);
          return (
            <li key={p.label}>
              <div className="ai-detect-row">
                <span className="ai-detect-name">{p.healthy ? `${p.crop}: ${t('Healthy plant')}` : `${p.crop}: ${p.disease}`}</span>
                <b>{pct}%</b>
              </div>
              <div className="ai-bar" role="img" aria-label={`${pct}%`}><span style={{ width: `${Math.max(2, pct)}%` }} /></div>
              {p.part ? <div className="ai-detect-part">{t('Plant part')}: {p.part}</div> : null}
            </li>
          );
        })}
      </ol>
      {unsure && (
        <div className="ai-note" role="alert">
          <b>{d.unrecognised ? t('This photo does not look like a plant the model knows.') : t('The match is not certain.')}</b>{' '}
          {t('Retake the photo: one plant, the leaf in focus, in daylight. If the problem continues, ask an extension officer.')}
        </div>
      )}
    </div>
  );
}
