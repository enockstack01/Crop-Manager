import { api } from './api.js';

/** Saves a Blob as a file in the browser. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const nameFrom = (res, fallback) => /filename="?([^";]+)"?/i.exec(res.headers['content-disposition'] || '')?.[1] || fallback;

/** Downloads a file the server builds (records as csv, xlsx or pdf). */
export async function downloadExport(path, params, fallback) {
  const res = await api.get(path, { params, responseType: 'blob', timeout: 120_000 });
  saveBlob(res.data, nameFrom(res, fallback));
}

/** Sends tables built on the page and downloads them as csv or xlsx. */
export async function downloadTables(format, body, fallback) {
  const res = await api.post('/export/tables', { format, ...body }, { responseType: 'blob', timeout: 120_000 });
  saveBlob(res.data, nameFrom(res, fallback));
}
