import { clerkClient } from '@clerk/express';
import createHttpError from '../lib/httpError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { isAllowlistedAdmin } from '../lib/adminAllowlist.js';
import { CURRENCY_CODES } from '../lib/currencies.js';
import { notifyAdmins, statusPatch } from '../lib/accountStatus.js';
import { Profile } from '../models/index.js';

// role is deliberately absent: new users are Farmers and only an admin can change it
// (PATCH /api/admin/users/:id)
const EDITABLE = ['full_name', 'phone', 'location', 'onboarded', 'currency'];

// account types a user may request (Administrator is granted, never requested)
export const REQUESTABLE_ACCOUNT_TYPES = ['Farmer', 'Farm Manager', 'Agronomist', 'Cooperative Manager'];

const str = (v, max = 200) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));

function checkCurrency(code) {
  if (code !== undefined && !CURRENCY_CODES.includes(code)) throw createHttpError(400, `Unsupported currency: ${code}`);
}

/** Upsert the local Profile from the Clerk user record, then return it. */
export const getMe = asyncHandler(async (req, res) => {
  let clerkUser = null;
  try {
    clerkUser = await clerkClient.users.getUser(req.userId);
  } catch {
    /* Clerk unreachable — fall back to whatever we already stored */
  }

  const set = {};
  let email;
  if (clerkUser) {
    email =
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      undefined;
    if (email) set.email = email;
    if (clerkUser.imageUrl) set.avatar_url = clerkUser.imageUrl;
  }

  // bootstrap platform admins from the allowlist (env + DB-managed): they never
  // need to request access
  if (email && (await isAllowlistedAdmin(email))) {
    set.is_admin = true;
    set.is_active = true;
    set.account_status = 'active';
  }

  // until the person gives a name, the app shows their account type (e.g. "Farmer")
  const name = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim()
    : undefined;

  const profile = await Profile.findOneAndUpdate(
    { user_id: req.userId },
    {
      $set: set,
      $setOnInsert: {
        user_id: req.userId,
        full_name: name || '',
        role: 'Farmer',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.json(serialize(profile));
});

export const updateMe = asyncHandler(async (req, res) => {
  const patch = {};
  for (const key of EDITABLE) if (req.body[key] !== undefined) patch[key] = req.body[key];
  if (patch.currency !== undefined) patch.currency = String(patch.currency).toUpperCase();
  checkCurrency(patch.currency);

  const profile = await Profile.findOneAndUpdate(
    { user_id: req.userId },
    { $set: patch, $setOnInsert: { user_id: req.userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  ).lean();

  res.json(serialize(profile));
});

/**
 * POST /api/profile/access-request — the form a new user fills in after signing up.
 * Moves the account to `pending` and notifies the administrators, who approve or
 * reject it from the admin dashboard.
 */
export const submitAccessRequest = asyncHandler(async (req, res) => {
  const me = req.profile;
  if (me.is_admin || me.account_status === 'active') {
    throw createHttpError(400, 'Your account is already active');
  }
  if (!['new', 'rejected'].includes(me.account_status)) {
    throw createHttpError(400, 'Your account request has already been submitted');
  }

  const b = req.body || {};
  const request = {
    account_type: REQUESTABLE_ACCOUNT_TYPES.includes(b.account_type) ? b.account_type : 'Farmer',
    organization: str(b.organization),
    country: str(b.country, 100),
    farm_size: b.farm_size === '' || b.farm_size == null ? null : Number(b.farm_size),
    farm_size_unit: str(b.farm_size_unit, 20) || 'hectares',
    main_crops: str(b.main_crops, 300),
    message: str(b.message, 1000),
    submitted_at: new Date(),
  };
  if (!request.organization) throw createHttpError(400, 'Enter your farm or organisation name');
  if (!request.country) throw createHttpError(400, 'Enter your country');
  if (request.farm_size !== null && !(request.farm_size >= 0)) throw createHttpError(400, 'Farm size must be a positive number');

  const currency = b.currency ? String(b.currency).toUpperCase() : me.currency || 'USD';
  checkCurrency(currency);

  const profile = await Profile.findOneAndUpdate(
    { user_id: req.userId },
    {
      $set: {
        ...statusPatch('pending', req.userId),
        access_request: request,
        full_name: str(b.full_name, 120),
        phone: str(b.phone, 40),
        location: [str(b.location, 100), request.country].filter(Boolean).join(', '),
        currency,
        onboarded: true,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  const who = profile.full_name || profile.email || 'A new user';
  await notifyAdmins({
    type: 'info',
    title: 'New account request',
    message: `${who} (${request.account_type}, ${request.organization}) is waiting for approval.`,
  });

  res.json(serialize(profile));
});
