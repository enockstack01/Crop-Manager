import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { api } from './api';
import { t } from '../i18n';

/*
 * Files the server builds (records and reports as PDF, Excel or CSV): downloaded to the app's cache and
 * handed to the share sheet, so they can be saved to Files, sent on WhatsApp or e-mailed.
 */
export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
const MIME: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};
const UTI: Record<ExportFormat, string> = { pdf: 'com.adobe.pdf', xlsx: 'org.openxmlformats.spreadsheetml.sheet', csv: 'public.comma-separated-values-text' };

const nameFrom = (headers: any, fallback: string) => {
  const raw = String(headers?.['content-disposition'] || '');
  return /filename="?([^";]+)"?/i.exec(raw)?.[1] || fallback;
};

async function saveAndShare(data: ArrayBuffer, name: string, format: ExportFormat) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(data));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: MIME[format], dialogTitle: t('Export'), UTI: UTI[format] });
  }
  return file.uri;
}

/** Every record of one kind (the list filters apply), as pdf, xlsx or csv. */
export async function shareExport(resource: string, format: ExportFormat, params: Record<string, any> = {}) {
  const res = await api.get(resource ? `/export/${resource}` : '/export', { params: { format, ...params }, responseType: 'arraybuffer', timeout: 120000 });
  return saveAndShare(res.data, nameFrom(res.headers, `${resource || 'cropmanager-all-records'}.${format}`), format);
}

/** Tables built in the app (a report) as xlsx or csv. */
export async function shareTables(
  format: Exclude<ExportFormat, 'pdf'>,
  body: { title: string; subtitle?: string; kind?: string; tables: { title: string; headers: string[]; rows: any[][] }[] },
  fallback: string,
) {
  const res = await api.post('/export/tables', { format, ...body }, { responseType: 'arraybuffer', timeout: 120000 });
  return saveAndShare(res.data, nameFrom(res.headers, fallback), format);
}
