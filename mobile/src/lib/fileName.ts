/*
 * A readable file name for a report or export ("season-report-2026-11-10.pdf") instead of a random one. Pure, tested on a computer
 * (mobile/scripts/test-files.mjs).
 */
const MARKS = /[\u0300-\u036f]/g; // accents left over after splitting "é" into "e" and a mark

export function fileNameFor(title: string, ext: string, now: Date = new Date()): string {
  const slug = String(title || '')
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${slug || 'cropmanager'}-${day}.${ext.replace(/^\./, '')}`;
}

/** Android names a chosen folder "primary:Documents" (storage:path); a farmer should read "Documents". */
export const folderLabel = (name?: string | null): string => String(name || '').split(':').pop()?.trim() || '';
