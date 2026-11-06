import { clerkClient } from '@clerk/express';
import { env } from '../../config/env.js';

/*
 * Invitation emails go out through Clerk, the service that already handles sign-up, so no mail server or extra key is needed.
 * The email carries a link to the sign-up page; the farmer is linked to the organization at the first sign-in with that address.
 * Nothing here throws: a refused email is reported to the caller, who keeps the invitation so it can be sent again.
 */
export const publicUrl = () => process.env.PUBLIC_APP_URL || (env.isProd ? 'https://crop.agricoders.com' : env.clientOrigin);

/** The test sign-in mode (AI_MOCK or ALLOW_DEV_AUTH) never sends real email. */
const dry = () => !env.isProd && (process.env.ALLOW_DEV_AUTH === '1' || process.env.AI_MOCK === '1') && process.env.INVITE_DRY_RUN !== '0';

export async function sendInvitationEmail(email, { publicMetadata = {} } = {}) {
  if (dry()) return { sent: false, dry: true, error: '' };
  try {
    await clerkClient.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${publicUrl()}/sign-up`,
      notify: true,
      ignoreExisting: true,
      publicMetadata,
    });
    return { sent: true, error: '' };
  } catch (err) {
    const msg = String(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'The email could not be sent').slice(0, 200);
    console.warn(`[invite] email not sent: ${msg}`);
    return { sent: false, error: msg };
  }
}
