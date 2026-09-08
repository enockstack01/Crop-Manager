import { clerkClient } from '@clerk/express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { serialize } from '../lib/serialize.js';
import { Profile } from '../models/index.js';

const EDITABLE = ['full_name', 'phone', 'location', 'role', 'onboarded'];

/** Upsert the local Profile from the Clerk user record, then return it. */
export const getMe = asyncHandler(async (req, res) => {
  let clerkUser = null;
  try {
    clerkUser = await clerkClient.users.getUser(req.userId);
  } catch {
    /* Clerk unreachable — fall back to whatever we already stored */
  }

  const derived = {};
  if (clerkUser) {
    derived.email =
      clerkUser.primaryEmailAddress?.emailAddress ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      undefined;
    derived.avatar_url = clerkUser.imageUrl || undefined;
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
    derived.fullNameFallback = name || clerkUser.username || undefined;
  }

  const profile = await Profile.findOneAndUpdate(
    { user_id: req.userId },
    {
      $set: {
        ...(derived.email ? { email: derived.email } : {}),
        ...(derived.avatar_url ? { avatar_url: derived.avatar_url } : {}),
      },
      $setOnInsert: {
        user_id: req.userId,
        full_name: derived.fullNameFallback || '',
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

  const profile = await Profile.findOneAndUpdate(
    { user_id: req.userId },
    { $set: patch, $setOnInsert: { user_id: req.userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.json(serialize(profile));
});
