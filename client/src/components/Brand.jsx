import { t } from '../i18n/index.js';

/*
 * Agricoders brand lockups (Brand and Template Guidelines v1.0, sections 3 and 6).
 * Official master files only: the logo is never redrawn or recoloured. On the dark Pine panel the
 * master logo sits inside its white disc, and the wordmark is AGRICODERS in spaced capitals.
 */

export const TAGLINE = 'Plan, track and grow: your whole farm in one place';

/** Pine brand panel for the sign-in and request pages. */
export function BrandPanel() {
  return (
    <div className="auth-split-brand">
      <img className="auth-brand-logo" src="/brand/agricoders-logo-disc.png" alt="Agricoders" width="112" height="112" />
      <div className="auth-brand-wordmark">AGRICODERS</div>
      <h1>{t('CropManager')}</h1>
      <p className="auth-brand-tagline">{t(TAGLINE)}</p>
      <p>
        {t('Streamline your crop production. Track farms, fields, crop cycles, activities, harvests, inventory and finances, all in one place.')}
      </p>
      <div className="auth-brand-footer">CropManager · by Agricoders</div>
    </div>
  );
}

/** Compact lockup shown above the form on small screens, where the panel is hidden. */
export function MobileBrand() {
  return (
    <div className="auth-split-mobile-brand">
      <img src="/brand/cropmanager-glyph.png" alt="" width="42" height="42" />
      <span>
        {t('CropManager')}
        <small>by Agricoders</small>
      </span>
    </div>
  );
}
