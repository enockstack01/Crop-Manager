import { api } from './api.js';
import i18n from '../i18n/index.js';

/*
 * The CropManager AI assistant (server: /api/ai, powered by the Anthropic API). Every call
 * sends the interface language so the answer is written in it. Model calls can take a while,
 * so they get a longer timeout than the rest of the API.
 */
const AI_TIMEOUT = 90_000;
const post = (path, body = {}) =>
  api.post(`/ai/${path}`, { language: i18n.language, ...body }, { timeout: AI_TIMEOUT }).then((r) => r.data);

export const aiStatus = () => api.get('/ai/status').then((r) => r.data);
export const aiDiagnose = (body) => post('diagnose', body);
export const aiInsights = () => post('insights');
export const aiAdvice = (topic, question) => post('advice', { topic, question });
export const aiSeasonSummary = (scope) => post('season-summary', { scope });
export const aiParseRecord = (text) => post('parse-record', { text });
export const aiChat = (messages) => post('chat', { messages });

/** The diagnosis report as plain text for the scouting "Recommendation" field. */
export function reportToText(r, t) {
  const parts = [
    `${r.title} (${t(r.problem_type)}, ${t('Severity')}: ${t(r.severity)})`,
    `${t('Cause')}: ${r.cause}`,
    `${t('Treatment')}: ${r.treatment}`,
    `${t('Medication')}: ${r.medication}`,
    `${t('How to give it')}: ${r.how_to_give}`,
    r.prevention ? `${t('Prevention')}: ${r.prevention}` : '',
    r.when_to_get_help ? `${t('When to get expert help')}: ${r.when_to_get_help}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}
