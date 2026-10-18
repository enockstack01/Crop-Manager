import { api } from './api';
import i18n, { t } from '../i18n';

/* The CropManager AI assistant (server: /api/ai). Answers come back in the interface language. */
const post = (path: string, body: Record<string, unknown> = {}) =>
  api.post(`/ai/${path}`, { language: i18n.language, ...body }, { timeout: 90000 }).then((r) => r.data);

export const aiStatus = () => api.get('/ai/status').then((r) => r.data);
export const aiDiagnose = (body: Record<string, unknown>) => post('diagnose', body);
export const aiInsights = () => post('insights');
export const aiAdvice = (topic: string, question: string) => post('advice', { topic, question });
export const aiSeasonSummary = (scope: string) => post('season-summary', { scope });
export const aiParseRecord = (text: string) => post('parse-record', { text });
export const aiChat = (messages: { role: string; content: string }[]) => post('chat', { messages });

/** The diagnosis report as plain text for the scouting "Recommendation" field. */
export function reportToText(r: any): string {
  return [
    `${r.title} (${t(r.problem_type)}, ${t('Severity')}: ${t(r.severity)})`,
    `${t('Cause')}: ${r.cause}`,
    `${t('Treatment')}: ${r.treatment}`,
    `${t('Medication')}: ${r.medication}`,
    `${t('How to give it')}: ${r.how_to_give}`,
    r.prevention ? `${t('Prevention')}: ${r.prevention}` : '',
    r.when_to_get_help ? `${t('When to get expert help')}: ${r.when_to_get_help}` : '',
  ].filter(Boolean).join('\n');
}
