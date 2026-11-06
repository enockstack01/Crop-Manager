/*
 * Content Security Policy for the web app. It lists the only outside places the page may load from or talk to:
 * Clerk (sign-in; its address is inside the publishable key), Google Fonts, Font Awesome on cdnjs, OpenStreetMap map tiles and
 * Cloudflare's bot check that Clerk uses. Everything else is refused, including inline scripts, plugins, framing and form posts
 * to other sites. If a new outside service is added to the client, add it here.
 */
export function clerkHost(publishableKey = '') {
  try {
    const raw = Buffer.from(String(publishableKey).split('_').slice(2).join('_'), 'base64').toString('utf8');
    const host = raw.replace(/\$.*/, '').trim();
    return /^[a-z0-9.-]+$/i.test(host) ? host : '';
  } catch {
    return '';
  }
}

export function cspDirectives(publishableKey, { isProd = true } = {}) {
  const clerk = clerkHost(publishableKey);
  const clerkHosts = [clerk && `https://${clerk}`, 'https://*.clerk.accounts.dev', 'https://*.clerk.com'].filter(Boolean);
  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", ...clerkHosts, 'https://challenges.cloudflare.com'],
    scriptSrcAttr: ["'none'"],
    // React sets style attributes while rendering, which needs 'unsafe-inline' for styles (not for scripts)
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: ["'self'", ...clerkHosts, 'https://clerk-telemetry.com', 'https://challenges.cloudflare.com'],
    frameSrc: ["'self'", ...clerkHosts, 'https://challenges.cloudflare.com'],
    workerSrc: ["'self'", 'blob:'],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (isProd) directives.upgradeInsecureRequests = [];
  return directives;
}
