import AsyncStorage from '@react-native-async-storage/async-storage';

/*
 * Remembers that this phone holds a signed-in account with its data saved, so that with no internet the app opens that account and works as usual
 * (records, lists and dashboards from the saved copy; changes wait on the phone and are sent when the connection returns). When there is no saved
 * account (a fresh install, or after signing out) there is nothing to open, so the offline tools page is shown instead.
 */
const KEY = 'offline-account-ready';

export async function hasSavedAccount(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return false; }
}
export function rememberAccount() { AsyncStorage.setItem(KEY, '1').catch(() => {}); }
export function forgetAccount() { AsyncStorage.removeItem(KEY).catch(() => {}); }
