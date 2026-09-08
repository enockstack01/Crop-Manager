import { env } from '../config/env.js';
import { SystemSetting } from '../models/index.js';

const KEY = 'admin_emails';
const norm = (e) => String(e || '').trim().toLowerCase();

/** DB-managed admin emails (added via the admin UI). */
export async function getDbAdminEmails() {
  const doc = await SystemSetting.findOne({ key: KEY }).lean();
  return Array.isArray(doc?.value) ? doc.value.map(norm).filter(Boolean) : [];
}

/** All admin emails: env (immutable) + DB (managed). */
export async function getAdminEmails() {
  return [...new Set([...env.adminEmails, ...(await getDbAdminEmails())])];
}

export async function isAllowlistedAdmin(email) {
  if (!email) return false;
  return (await getAdminEmails()).includes(norm(email));
}

export async function addAdminEmail(email, updatedBy) {
  const list = await getDbAdminEmails();
  if (!list.includes(norm(email))) list.push(norm(email));
  await SystemSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: list, updated_by: updatedBy || null } },
    { upsert: true }
  );
  return list;
}

export async function removeAdminEmail(email, updatedBy) {
  const list = (await getDbAdminEmails()).filter((e) => e !== norm(email));
  await SystemSetting.findOneAndUpdate(
    { key: KEY },
    { $set: { value: list, updated_by: updatedBy || null } },
    { upsert: true }
  );
  return list;
}
