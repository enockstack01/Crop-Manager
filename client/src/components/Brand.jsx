import { t } from '../i18n/index.js';

/*
 * Agricoders brand lockups (Brand and Template Guidelines v1.0, sections 3 and 6).
 * The product leads with its own mark, the CropManager app icon (white leaf on Leaf Green), and is
 * always signed "by Agricoders" in the footer line.
 */

export const TAGLINE = 'Plan, track and grow: your whole farm in one place';

/** Pine brand panel for the sign-in and request pages. */
export function BrandPanel() {
  return (
    <div className="auth-split-brand">
      <img className="auth-brand-logo" src="/brand/cropmanager-icon.png" alt="CropManager" width="112" height="112" />
      <h1>{t('CropManager')}</h1>
      <p className="auth-brand-tagline">{t(TAGLINE)}</p>
    </div>
  );
}

/** Compact lockup shown above the form on small screens, where the panel is hidden. */
export function MobileBrand() {
  return (
    <div className="auth-split-mobile-brand">
      <img src="/brand/cropmanager-icon.png" alt="" width="42" height="42" />
      <span>
        {t('CropManager')}
      </span>
    </div>
  );
}
