import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';
import { useResourceMutations } from '../lib/useResource.js';
import { formatCurrency } from '../lib/format.js';
import { aiAdvice, aiChat, aiInsights, aiParseRecord, aiSeasonSummary } from '../lib/ai.js';
import { AiDisclaimer, AiStatusBar, Thinking } from '../features/ai/AiBits.jsx';
import { DiagnoseModal } from '../features/ai/DiagnoseModal.jsx';
import { t } from '../i18n/index.js';

const TABS = [
  { id: 'ask', icon: 'fa-comments', label: 'Ask' },
  { id: 'insights', icon: 'fa-lightbulb', label: 'Farm insights' },
  { id: 'plans', icon: 'fa-list-check', label: 'Plans and advice' },
  { id: 'summary', icon: 'fa-file-signature', label: 'Season summary' },
  { id: 'record', icon: 'fa-pen-to-square', label: 'Quick record' },
  { id: 'photo', icon: 'fa-camera', label: 'Check a plant' },
];

/** Runs an AI call and keeps its loading, error and result state. */
function useAi(fn) {
  const [state, setState] = useState({ busy: false, error: '', data: null });
  const run = async (...args) => {
    setState({ busy: true, error: '', data: null });
    try {
      setState({ busy: false, error: '', data: await fn(...args) });
    } catch (err) {
      setState({ busy: false, error: err.message || t('The AI assistant could not answer.'), data: null });
    }
  };
  return [state, run];
}

const Failed = ({ message }) => (message ? <div className="auth-message error show" role="alert">{message}</div> : null);

/* ---------------------------------------------------------------- ask */
const EXAMPLES = [
  'Which of my crops needs attention this week?',
  'How can I lower my costs next season?',
  'When should I harvest and sell to get a better price?',
];

function Ask() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, busy]);

  const send = async (q) => {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    const next = [...messages, { role: 'user', content: question }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError('');
    try {
      const { reply } = await aiChat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err.message || t('The AI assistant could not answer.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ai-chat">
      <div className="ai-chat-log" aria-live="polite">
        {!messages.length && (
          <div className="ai-chat-empty">
            <p>{t('Ask about your crops, pests, inputs, money or harvest. The assistant reads your farm records to answer.')}</p>
            <div className="ai-examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="btn btn-secondary btn-sm" onClick={() => send(t(ex))}>{t(ex)}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-bubble ai-bubble-${m.role}`}>{m.content}</div>
        ))}
        {busy && <Thinking />}
        <div ref={end} />
      </div>
      <Failed message={error} />
      <form className="ai-chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input
          className="form-control"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('Type your question')}
          aria-label={t('Type your question')}
        />
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          <i className="fas fa-paper-plane" /> {t('Send')}
        </button>
        {messages.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={() => { setMessages([]); setError(''); }}>{t('New chat')}</button>
        )}
      </form>
    </div>
  );
}

/* ----------------------------------------------------------- insights */
const MODULE_ROUTE = {
  'crop-scouting-records': 'scouting', 'inventory-items': 'inventory', 'harvest-records': 'harvest',
  'fertilizer-applications': 'fertilizers', 'irrigation-records': 'irrigation',
};
const PRIORITY = { High: 'badge-danger', Medium: 'badge-warning', Low: 'badge-neutral' };

function Insights() {
  const navigate = useNavigate();
  const [{ busy, error, data }, run] = useAi(aiInsights);
  const r = data?.insights;
  return (
    <>
      <p className="ai-lead">{t('A review of your whole farm: crops, pests and disease, stock, money and harvests, with the next best actions.')}</p>
      <button className="btn btn-primary" onClick={run} disabled={busy}>
        <i className="fas fa-wand-magic-sparkles" /> {r ? t('Refresh insights') : t('Review my farm')}
      </button>
      {busy && <Thinking label="Reading your records…" />}
      <Failed message={error} />
      {r && (
        <div className="ai-result">
          <p className="ai-headline">{r.headline}</p>
          <div className="ai-cards">
            {r.items.map((it, i) => (
              <div key={i} className="ai-card">
                <div className="ai-card-top">
                  <span className={`badge ${PRIORITY[it.priority] || 'badge-neutral'}`}>{t(it.priority)}</span>
                  <span className="ai-area">{t(it.area)}</span>
                </div>
                <h4>{it.title}</h4>
                <p>{it.detail}</p>
                {it.module && it.module !== 'dashboard' && (
                  <button className="btn btn-outline btn-sm" onClick={() => navigate(`/${MODULE_ROUTE[it.module] || it.module}`)}>
                    {t('Open')}
                  </button>
                )}
              </div>
            ))}
          </div>
          {r.missing_records?.length > 0 && (
            <p className="ai-missing"><b>{t('Add these records for better advice')}:</b> {r.missing_records.join(' · ')}</p>
          )}
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------- plans */
const TOPICS = [
  { id: 'inputs', label: 'Inputs to buy' },
  { id: 'planting', label: 'Planting plan' },
  { id: 'fertiliser', label: 'Fertiliser plan' },
  { id: 'irrigation', label: 'Water and irrigation' },
  { id: 'protection', label: 'Pests, disease and weeds' },
  { id: 'harvest', label: 'Harvest and storage' },
];

function Plans() {
  const [topic, setTopic] = useState('inputs');
  const [question, setQuestion] = useState('');
  const [{ busy, error, data }, run] = useAi(aiAdvice);
  const a = data?.advice;
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('What do you need a plan for?')}</label>
          <select className="form-control" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('Anything specific? (optional)')}</label>
          <input className="form-control" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={() => run(topic, question)} disabled={busy}>
        <i className="fas fa-wand-magic-sparkles" /> {t('Make my plan')}
      </button>
      {busy && <Thinking label="Planning…" />}
      <Failed message={error} />
      {a && (
        <div className="ai-result">
          <p className="ai-headline">{a.headline}</p>
          <ol className="ai-steps">
            {a.steps.map((s, i) => (
              <li key={i}>
                <b>{s.action}</b> <span className="ai-when">{s.when}</span>
                {s.detail && <div>{s.detail}</div>}
              </li>
            ))}
          </ol>
          {a.shopping_list?.length > 0 && (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>{t('Input')}</th><th>{t('Quantity')}</th><th>{t('In stock')}</th></tr></thead>
                <tbody>
                  {a.shopping_list.map((x, i) => (
                    <tr key={i}><td>{x.item}</td><td>{x.quantity}</td><td>{x.have_in_stock || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {a.watch_outs?.length > 0 && (
            <div className="ai-note"><b>{t('Watch out')}:</b> {a.watch_outs.join(' · ')}</div>
          )}
          {a.based_on && <p className="ai-missing">{a.based_on}</p>}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ summary */
function Summary() {
  const toast = useToast();
  const [scope, setScope] = useState('');
  const [{ busy, error, data }, run] = useAi(aiSeasonSummary);
  const s = data?.summary;
  const text = s
    ? [s.title, '', s.overview, '', `${t('Production')}\n${s.production}`, '', `${t('Finances')}\n${s.finances}`, '',
        `${t('Risks and how they were handled')}\n${s.risks_and_controls}`, '', `${t('Outlook')}\n${s.outlook}`, '', `${t('Quality of records')}\n${s.record_quality}`].join('\n')
    : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast(t('Summary copied'));
    } catch {
      toast(t('Could not copy. Select the text and copy it.'), 'error');
    }
  };
  return (
    <>
      <p className="ai-lead">{t('A clear summary of production, income, costs and risks that you can share with a bank or lender.')}</p>
      <div className="form-group">
        <label className="form-label">{t('What should it cover? (optional)')}</label>
        <input className="form-control" value={scope} maxLength={200} onChange={(e) => setScope(e.target.value)} placeholder={t('For example: maize, season A 2026')} />
      </div>
      <button className="btn btn-primary" onClick={() => run(scope)} disabled={busy}>
        <i className="fas fa-wand-magic-sparkles" /> {t('Write my summary')}
      </button>
      {busy && <Thinking label="Writing…" />}
      <Failed message={error} />
      {s && (
        <div className="ai-result ai-summary">
          <h3>{s.title}</h3>
          <p>{s.overview}</p>
          {s.highlights?.length > 0 && <ul>{s.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>}
          <h4>{t('Production')}</h4><p>{s.production}</p>
          <h4>{t('Finances')}</h4><p>{s.finances}</p>
          <h4>{t('Risks and how they were handled')}</h4><p>{s.risks_and_controls}</p>
          <h4>{t('Outlook')}</h4><p>{s.outlook}</p>
          <h4>{t('Quality of records')}</h4><p>{s.record_quality}</p>
          <div className="ai-actions no-print">
            <button className="btn btn-secondary" onClick={copy}><i className="fas fa-copy" /> {t('Copy')}</button>
            <button className="btn btn-secondary" onClick={() => window.print()}><i className="fas fa-print" /> {t('Print')}</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------- quick record */
const TARGET = { expenses: 'Expense', sales: 'Sale', 'harvest-records': 'Harvest record' };

function QuickRecord() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [{ busy, error, data }, run] = useAi(aiParseRecord);
  const [saved, setSaved] = useState(false);
  const resource = data?.resource && data.resource !== 'none' ? data.resource : 'expenses';
  const { create } = useResourceMutations(resource);
  const rec = data?.record;
  const blocked = !rec || data.missing.length > 0;

  const save = async () => {
    try {
      await create.mutateAsync(rec);
      setSaved(true);
      toast(t('Record saved'));
    } catch (err) {
      toast(err.message || t('Failed to save'), 'error');
    }
  };

  return (
    <>
      <p className="ai-lead">{t('Type what happened the way you would say it, and the assistant fills in the record for you to check.')}</p>
      <textarea
        className="form-control"
        rows={3}
        value={text}
        maxLength={800}
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        placeholder={t('For example: Bought 5 bags of fertilizer for 90,000 from Agro Shop yesterday')}
      />
      <div className="ai-actions">
        <button className="btn btn-primary" onClick={() => run(text)} disabled={busy || !text.trim()}>
          <i className="fas fa-wand-magic-sparkles" /> {t('Understand')}
        </button>
      </div>
      {busy && <Thinking label="Reading…" />}
      <Failed message={error} />
      {data && (
        <div className="ai-result">
          <p className="ai-headline">{data.summary}</p>
          {rec && (
            <div className="table-responsive">
              <table className="data-table">
                <tbody>
                  <tr><th>{t('Record')}</th><td>{t(TARGET[data.resource])}</td></tr>
                  {Object.entries(rec).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                    <tr key={k}>
                      <th>{t(k.replace(/_/g, ' '))}</th>
                      <td>
                        {k === 'crop_id' ? data.crop_name : k === 'farm_id' ? data.farm_name : k === 'amount' || k === 'unit_price' ? formatCurrency(v, rec.currency) : String(v)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.missing.length > 0 && (
            <div className="ai-note"><b>{t('Still needed')}:</b> {data.missing.map((m) => t(m)).join(' · ')}. {t('Add it to your message and try again.')}</div>
          )}
          {rec && (
            <div className="ai-actions">
              <button className="btn btn-primary" onClick={save} disabled={blocked || saved || create.isPending}>
                <i className="fas fa-check" /> {saved ? t('Saved') : t('Save record')}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------------- page */
function PlantCheck() {
  const [mode, setMode] = useState(null); // null | 'camera' | 'files'
  return (
    <>
      <p className="ai-lead">{t('Take a photo of the sick leaf, stem or fruit. The assistant finds the infected part, names the problem and tells you how to treat it.')}</p>
      <div className="ai-actions">
        <button className="btn btn-primary" onClick={() => setMode('camera')}><i className="fas fa-camera" /> {t('Take a photo')}</button>
        <button className="btn btn-secondary" onClick={() => setMode('files')}><i className="fas fa-image" /> {t('Choose photos')}</button>
      </div>
      {mode && <DiagnoseModal key={mode} open onClose={() => setMode(null)} input={{}} autoCamera={mode === 'camera'} />}
    </>
  );
}

const VIEWS = { ask: Ask, insights: Insights, plans: Plans, summary: Summary, record: QuickRecord, photo: PlantCheck };

export default function Assistant() {
  const [tab, setTab] = useState('ask');
  const View = VIEWS[tab];
  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Advice from your own farm records, in your language." />
      <AiStatusBar />
      <div className="report-tabs no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {TABS.map((x) => (
          <button key={x.id} className={`btn btn-sm ${tab === x.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(x.id)}>
            <i className={`fas ${x.icon}`} /> {t(x.label)}
          </button>
        ))}
      </div>
      <div className="chart-card full-width">
        <div className="chart-card-body ai-panel">
          <View key={tab} />
        </div>
      </div>
      <AiDisclaimer />
    </>
  );
}
