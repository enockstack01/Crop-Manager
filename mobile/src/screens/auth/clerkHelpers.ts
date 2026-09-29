import { useClerk } from '@clerk/clerk-expo';

/** Turn a Clerk (or network) error into a message that says what to do. */
export function clerkMessage(e: any, fallback = 'Something went wrong. Please try again.'): string {
  const err = e?.errors?.[0];
  const code = err?.code || e?.code;
  if (code === 'requires_captcha' || code === 'captcha_invalid' || code === 'captcha_client_attempts_exceeded') {
    return 'This sign-up was blocked by bot protection. An administrator must allow native apps in the Clerk dashboard (Native applications / Bot sign-up protection).';
  }
  if (code === 'network_error') {
    return `Could not reach the sign-in service (${e?.message || 'network error'}). Check your internet connection and try again.`;
  }
  if (code === 'form_identifier_not_found') return 'No account uses this email. Check it, or create an account.';
  if (code === 'form_password_incorrect') return 'Incorrect password. Try again, or use an email code instead.';
  if (code === 'form_code_incorrect') return 'That code is incorrect. Check the email and try again.';
  if (code === 'verification_expired') return 'That code has expired. Request a new one.';
  if (code === 'form_password_pwned') {
    return 'This password has appeared in a data breach. Please choose a different password.';
  }
  return err?.longMessage || err?.message || e?.message || fallback;
}

/**
 * Password rules configured on the Clerk instance (the same ones the web form
 * enforces), with a readable hint for the password field.
 */
export function usePasswordRules() {
  const clerk = useClerk() as any;
  const s = clerk?.__unstable__environment?.userSettings?.passwordSettings;
  const minLength: number = s?.min_length || 8;
  const parts = [`At least ${minLength} characters`];
  if (s?.require_uppercase) parts.push('an uppercase letter');
  if (s?.require_lowercase) parts.push('a lowercase letter');
  if (s?.require_numbers) parts.push('a number');
  if (s?.require_special_char) parts.push('a special character');
  const hint = parts.length > 1 ? `${parts[0]}, with ${parts.slice(1).join(', ')}` : parts[0];

  const check = (pw: string): string | null => {
    if (pw.length < minLength) return `Password must be at least ${minLength} characters.`;
    if (s?.require_uppercase && !/[A-Z]/.test(pw)) return 'Password needs an uppercase letter.';
    if (s?.require_lowercase && !/[a-z]/.test(pw)) return 'Password needs a lowercase letter.';
    if (s?.require_numbers && !/\d/.test(pw)) return 'Password needs a number.';
    if (s?.require_special_char && !/[^A-Za-z0-9]/.test(pw)) return 'Password needs a special character.';
    return null;
  };

  return { minLength, hint, check };
}
