import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as b64decode } from 'base64-arraybuffer';
import jpeg from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import i18n from '../i18n';
import { familyAdvice, extensionOfficerNote, FamilyAdvice } from './advice';

/*
 * The crop-disease model on the phone (MobileNetV3, 229 classes, about 9 MB), used when the server cannot be
 * reached. Ported from the image branch of the PlantDx app in the Crop-models project. It is less accurate than
 * the model on the server (84.8% against 90.8% top-1 on held-out photos), so every result is shown as such.
 *
 * It needs a native build (development build, EAS or a release APK); it does not run in Expo Go.
 */
const CLASSES: string[] = require('../../assets/model/classes.json').image;
const CONFIG: OfflineConfig = require('../../assets/model/config.json');
const LABELS: Label[] = require('../../assets/model/labels.json').labels;
const MODEL_ASSET = require('../../assets/model/image.onnx');

type OfflineConfig = {
  image_version: string;
  image_size: number;
  image_temperature: number;
  image_ood_floor: number | null;
  confident: number;
  unsure: number;
  min_margin_for_confident: number;
  image_val_acc: number;
};
type Label = {
  key: string; crop: string; part: string; disease: string; family: string; healthy: boolean;
  names: Record<string, { crop: string; part: string; disease: string }>;
};

export type OfflinePrediction = {
  label: string; confidence: number; crop: string; part: string; disease: string; healthy: boolean; family: string;
};
export type OfflineResult = {
  source: 'offline';
  model_version: string;
  confident: boolean;
  unrecognised: boolean;
  predictions: OfflinePrediction[];
  advice: FamilyAdvice | null;
  officer: string;
};

export const SIZE = CONFIG.image_size; // 224
const RESIZE_TO = 256;

/** "Maize___Gray leaf spot" -> "maize_gray_leaf_spot" (the rule used to build labels.json). */
export const slug = (cls: string) => cls.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const BY_KEY = new Map(LABELS.map((l) => [l.key, l]));

/* ---------------------------------------------------------------- model files */

let installing: Promise<string> | null = null;

/**
 * ONNX Runtime needs a real file path, not a bundled asset, so the model is copied once to the app's document
 * folder (and again if an app update ships a different file).
 */
export function installModel(): Promise<string> {
  installing ||= (async () => {
    const asset = Asset.fromModule(MODEL_ASSET);
    await asset.downloadAsync();
    const src = asset.localUri || asset.uri;
    const dir = new Directory(Paths.document, 'cropmodel');
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
    const dest = new File(dir, `image-${CONFIG.image_version}.onnx`);
    const from = new File(src);
    if (!dest.exists || dest.size !== from.size) {
      if (dest.exists) dest.delete();
      await from.copy(dest);
    }
    return dest.uri.replace(/^file:\/\//, '');
  })().catch((e) => { installing = null; throw e; });
  return installing;
}

/* ----------------------------------------------------------- session (kept briefly) */

let session: InferenceSession | null = null;
let loading: Promise<InferenceSession> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
const KEEP_MS = 60_000;

async function getSession(): Promise<InferenceSession> {
  if (session) return session;
  loading ||= (async () => {
    const path = await installModel();
    session = await InferenceSession.create(path, { executionProviders: ['cpu'], graphOptimizationLevel: 'all' });
    return session;
  })().finally(() => { loading = null; });
  return loading;
}

/** Frees the model's memory a minute after the last scan, so a low-memory phone is not left holding it. */
function scheduleRelease() {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => {
    const s = session;
    session = null;
    s?.release().catch(() => {});
  }, KEEP_MS);
}

/* ---------------------------------------------------------------- photo -> tensor */

const sizeOf = (uri: string) => new Promise<{ w: number; h: number }>((resolve, reject) => Image.getSize(uri, (w, h) => resolve({ w, h }), reject));

/**
 * Photo -> NCHW float32 [1,3,224,224], RGB, 0..1 (the ImageNet normalisation is inside the model).
 * Exactly as in training: shorter side to 256, then a centre crop of 224. The resize and crop are native, so a
 * 12 MP photo is never decoded in JavaScript.
 */
export async function prepare(uri: string): Promise<Float32Array> {
  const { w, h } = await sizeOf(uri);
  const scale = RESIZE_TO / Math.min(w, h);
  const nw = Math.max(SIZE, Math.round(w * scale));
  const nh = Math.max(SIZE, Math.round(h * scale));
  const out = await manipulateAsync(
    uri,
    [
      { resize: { width: nw, height: nh } },
      { crop: { originX: Math.floor((nw - SIZE) / 2), originY: Math.floor((nh - SIZE) / 2), width: SIZE, height: SIZE } },
    ],
    { compress: 0.95, format: SaveFormat.JPEG, base64: true },
  );
  if (!out.base64) throw new Error('Could not read the photo.');
  const { data, width, height } = jpeg.decode(new Uint8Array(b64decode(out.base64)), { useTArray: true, formatAsRGBA: true });
  const plane = SIZE * SIZE;
  const tensor = new Float32Array(3 * plane);
  // the crop is exactly SIZE x SIZE; if the platform returned another size, centre-crop what came back
  const x0 = Math.max(0, Math.floor((width - SIZE) / 2));
  const y0 = Math.max(0, Math.floor((height - SIZE) / 2));
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const s = ((y + y0) * width + (x + x0)) * 4;
      const d = y * SIZE + x;
      tensor[d] = data[s] / 255;
      tensor[plane + d] = data[s + 1] / 255;
      tensor[2 * plane + d] = data[s + 2] / 255;
    }
  }
  return tensor;
}

/* ---------------------------------------------------------------- inference */

export const softmax = (a: ArrayLike<number>, T = 1): number[] => {
  const v = Array.from(a);
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp((x - m) / T));
  const s = e.reduce((p, c) => p + c, 0);
  return e.map((x) => x / s);
};

/** Turns the model's raw scores into the top three, with the same confident / unfamiliar rules as the PlantDx app. */
export function interpret(logits: ArrayLike<number>, lang = i18n.language): OfflineResult {
  const raw = Array.from(logits);
  const probs = softmax(raw, CONFIG.image_temperature);
  const top = probs
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
  const unfamiliar = CONFIG.image_ood_floor != null && Math.max(...raw) < CONFIG.image_ood_floor;
  const best = top[0].p;
  const margin = best - (top[1]?.p ?? 0);
  const confident = !unfamiliar && best >= CONFIG.confident && margin >= CONFIG.min_margin_for_confident;

  const predictions: OfflinePrediction[] = top.map(({ p, i }) => {
    const label = slug(CLASSES[i]);
    const l = BY_KEY.get(label);
    const n = l?.names?.[lang] || l?.names?.en;
    // a class with no entry in labels.json is shown by its English class name
    const [cropName, ...rest] = CLASSES[i].split('___');
    return {
      label, confidence: p,
      crop: n?.crop || l?.crop || cropName,
      part: n?.part || l?.part || '',
      disease: n?.disease || l?.disease || rest.join(' '),
      healthy: !!l?.healthy,
      family: l?.family || 'general',
    };
  });
  const first = predictions[0];
  return {
    source: 'offline',
    model_version: CONFIG.image_version,
    confident,
    unrecognised: unfamiliar,
    predictions,
    advice: unfamiliar ? null : familyAdvice(first.family),
    officer: extensionOfficerNote(),
  };
}

/** Runs the on-phone model on a local photo. Throws if the phone cannot load the model (for example, too little memory). */
export async function diagnoseOffline(uri: string): Promise<OfflineResult> {
  const tensor = await prepare(uri);
  const s = await getSession();
  try {
    const out = await s.run({ [s.inputNames[0]]: new Tensor('float32', tensor, [1, 3, SIZE, SIZE]) });
    const logits = out[s.outputNames[0]].data as Float32Array;
    return interpret(logits);
  } finally {
    scheduleRelease();
  }
}

/** For tests and diagnostics: how many classes the bundled model knows. */
export const MODEL_INFO = { version: CONFIG.image_version, classes: CLASSES.length, valAccuracy: CONFIG.image_val_acc };
