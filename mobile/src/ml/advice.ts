import { t } from '../i18n';

/*
 * General advice per type of problem, shown with an offline (on-phone) result, where there is no AI report.
 * Source: logistack/advice_pack.json of the Crop-models project, version 2026-11-02. It is NOT crop-specific and has
 * NOT been reviewed by an agronomist; the screen says so. The sentences go through t() so they are translated.
 */
export type Family = 'healthy' | 'fungal' | 'bacterial' | 'viral' | 'pest' | 'general';
export type FamilyAdvice = { about: string; act: string[]; prevent: string[] };

const ADVICE: Record<Family, () => FamilyAdvice> = {
  healthy: () => ({
    about: t('No disease signs detected.'),
    act: [
      t('Keep scouting the field every week.'),
      t('Keep tools and hands clean when moving between plots.'),
    ],
    prevent: [
      t('Use certified, disease-free seed.'),
      t('Rotate crops and avoid water-logging.'),
    ],
  }),
  fungal: () => ({
    about: t('Fungal diseases spread in humid, wet conditions.'),
    act: [
      t('Remove and destroy badly affected leaves or plants; do not compost them.'),
      t('Avoid watering the leaves; water at the base in the morning.'),
      t('Ask your extension officer which registered fungicide suits this crop, and follow the label.'),
    ],
    prevent: [
      t('Space plants for air flow.'),
      t('Rotate with a non-host crop.'),
      t('Plant resistant varieties where available.'),
    ],
  }),
  bacterial: () => ({
    about: t('Bacterial diseases spread by rain splash, tools and infected seed.'),
    act: [
      t('Remove infected plants and keep them away from healthy ones.'),
      t('Disinfect tools between plants.'),
      t('Avoid working in the field when leaves are wet.'),
    ],
    prevent: [
      t('Use clean seed.'),
      t('Rotate crops.'),
      t('Control weeds and insects that carry bacteria.'),
    ],
  }),
  viral: () => ({
    about: t('Viral diseases cannot be cured and are carried by insects, tools and cuttings.'),
    act: [
      t('Uproot and destroy infected plants early.'),
      t('Control the insects (whiteflies, aphids, leafhoppers) that spread it.'),
    ],
    prevent: [
      t('Plant virus-free planting material.'),
      t('Use resistant varieties.'),
      t('Remove weeds that host the virus.'),
    ],
  }),
  pest: () => ({
    about: t('Insects, mites or nematodes are damaging the crop.'),
    act: [
      t('Check leaf undersides and stems for the pest.'),
      t('Hand-pick or prune badly affected parts.'),
      t('Ask your extension officer about safe, registered control options.'),
    ],
    prevent: [
      t('Encourage natural enemies.'),
      t('Rotate crops.'),
      t('Keep field edges and weeds under control.'),
    ],
  }),
  general: () => ({
    about: t('The cause is uncertain.'),
    act: [
      t('Take a clear close-up photo of the affected leaf in daylight and try again.'),
      t('Show the plant to a local extension officer before spraying anything.'),
    ],
    prevent: [
      t('Scout weekly.'),
      t('Keep records of what you see and when.'),
    ],
  }),
};

export const familyAdvice = (family: string): FamilyAdvice => (ADVICE[family as Family] || ADVICE.general)();

export const extensionOfficerNote = (): string =>
  t('If the problem is spreading quickly, affects more than a small part of the field, or you are not sure what it is, show the plant to a local extension officer before spraying anything.');
