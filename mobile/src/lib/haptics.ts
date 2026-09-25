import * as Haptics from 'expo-haptics';

/**
 * Thin, never-throwing wrappers around expo-haptics so every interaction can give
 * tactile feedback without each call site handling unsupported devices.
 */
const safe = (fn: () => Promise<unknown>) => () => {
  fn().catch(() => {});
};

export const haptics = {
  /** light tap — buttons, list rows */
  tap: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** firmer tap — primary actions such as the FAB */
  press: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** selection tick — toggles, filters, pickers */
  select: safe(() => Haptics.selectionAsync()),
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
