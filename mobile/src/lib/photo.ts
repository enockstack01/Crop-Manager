import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { planShrink } from './photoPlan';

/**
 * Makes a picked or camera photo small enough to send (see photoPlan.ts for why). Returns the address of the photo to use: the same one when it is
 * already small or when shrinking is not possible (a photo is never lost to a failed shrink; it is sent as it was).
 */
export async function shrinkPhoto(a: { uri: string; width?: number | null; height?: number | null; fileSize?: number | null; mimeType?: string | null }): Promise<{ uri: string; mimeType: string }> {
  const keep = { uri: a.uri, mimeType: a.mimeType || 'image/jpeg' };
  try {
    let { width, height } = a;
    if (!width || !height) {
      const size = await new Promise<{ w: number; h: number }>((res, rej) => Image.getSize(a.uri, (w, h) => res({ w, h }), rej));
      width = size.w;
      height = size.h;
    }
    const plan = planShrink(width, height, a.fileSize);
    if (!plan) return keep;
    const out = await manipulateAsync(a.uri, plan.resize ? [{ resize: plan.resize }] : [], { compress: 0.8, format: SaveFormat.JPEG });
    return { uri: out.uri, mimeType: 'image/jpeg' };
  } catch {
    return keep;
  }
}
