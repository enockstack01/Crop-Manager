import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { t } from '../i18n';
import { folderLabel } from './fileName';

/*
 * What happens to a finished PDF, Excel or CSV file. Sharing alone was not enough: a farmer who wants the file ON the phone (to open later or
 * to copy to a computer) had to find a "save" option inside the share list, which many phones do not offer. So on Android the person chooses:
 *
 *   Save to phone   asks once for a folder (for example Documents) with the phone's own folder chooser, remembers it, and writes the file there.
 *                   Android does not let an app write straight into the Downloads folder, hence the one-time choice.
 *   Share           the share list: WhatsApp, e-mail, Drive, "Save to Files"...
 *
 * On iPhone the share sheet already contains "Save to Files", so it goes straight there.
 */
const FOLDER_KEY = 'export-folder';

export type Delivered = 'saved' | 'shared' | 'cancelled';

async function rememberedFolder(): Promise<Directory | null> {
  try {
    const uri = await AsyncStorage.getItem(FOLDER_KEY);
    if (!uri) return null;
    const dir = new Directory(uri);
    return dir.exists ? dir : null;
  } catch {
    return null;
  }
}

/** Writes the file into the chosen folder. Returns the folder's name, or null if the person closed the folder chooser. */
async function saveToPhone(fromUri: string, name: string, mime: string): Promise<string | null> {
  const bytes = await new File(fromUri).bytes();
  let dir = await rememberedFolder();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!dir) {
      try {
        dir = await Directory.pickDirectoryAsync();
      } catch {
        return null; // the chooser was closed
      }
      try { await AsyncStorage.setItem(FOLDER_KEY, dir.uri); } catch { /* chosen again next time */ }
    }
    try {
      const out = dir.createFile(name, mime);
      out.write(bytes);
      return folderLabel(dir.name) || t('the folder you chose');
    } catch (e) {
      if (attempt === 1) throw e;
      dir = null; // the remembered folder is gone or no longer allowed: ask again
      try { await AsyncStorage.removeItem(FOLDER_KEY); } catch { /* nothing to forget */ }
    }
  }
  return null;
}

async function share(uri: string, name: string, mime: string, uti?: string): Promise<Delivered> {
  if (!(await Sharing.isAvailableAsync())) throw new Error(t('Sharing is not available on this phone.'));
  await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name, UTI: uti });
  return 'shared';
}

/** Offers "Save to phone" and "Share" for a finished file (Android) or opens the share sheet (iPhone). */
export function deliverFile(uri: string, name: string, mime: string, uti?: string): Promise<Delivered> {
  if (Platform.OS !== 'android') return share(uri, name, mime, uti);
  return new Promise<Delivered>((resolve, reject) => {
    Alert.alert(
      t('Your file is ready'),
      name,
      [
        {
          text: t('Save to phone'),
          onPress: () => {
            saveToPhone(uri, name, mime)
              .then((folder) => {
                if (folder === null) return resolve('cancelled');
                Alert.alert(t('Saved'), t('{{name}} is in the folder "{{folder}}".', { name, folder }));
                return resolve('saved');
              })
              .catch((e) => reject(new Error(e?.message || t('Could not save the file.'))));
          },
        },
        { text: t('Share'), onPress: () => { share(uri, name, mime, uti).then(resolve, reject); } },
        { text: t('Cancel'), style: 'cancel', onPress: () => resolve('cancelled') },
      ],
      { cancelable: true, onDismiss: () => resolve('cancelled') },
    );
  });
}
