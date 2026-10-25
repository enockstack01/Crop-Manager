import sharp from 'sharp';
import heicConvert from 'heic-convert';
import bmp from 'bmp-js';

/*
 * Any picture a farmer can take or save becomes one clean JPEG: the AI reads JPEG, PNG, WebP and GIF but not
 * HEIC (iPhones), AVIF, TIFF or BMP, and big camera photos waste time and money. The kind of file is found
 * from its first bytes, not from its name or the type the browser claims.
 *   JPEG, PNG, WebP, GIF (first frame), AVIF, TIFF, SVG  -> read directly
 *   HEIC / HEIF (iPhone, many Androids)                    -> decoded, then handled like the rest
 *   BMP                                                    -> decoded to pixels
 * The result is turned upright (EXIF rotation), flattened on white (transparent PNGs), at most 2000 px on the
 * long side, saved as JPEG.
 */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif', '.avif', '.heic', '.heif', '.hif', '.tif', '.tiff', '.bmp', '.svg'];
const MAX_SIDE = 2000;

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

/** What the bytes say the file is. */
export function sniff(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  const head = buf.slice(0, 4).toString('latin1');
  if (head === 'GIF8') return 'gif';
  if (head === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  if ((head === 'II*\0') || (head === 'MM\0*')) return 'tiff';
  if (buf.slice(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (HEIF_BRANDS.includes(brand)) return 'heif';
    return 'heif'; // other ISO media brands used by phone photos
  }
  const text = buf.slice(0, 512).toString('utf8').trimStart().toLowerCase();
  if (text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))) return 'svg';
  return null;
}

/** Any supported picture in, JPEG buffer out. Throws a plain Error('unreadable') when it is not a picture we can open. */
export async function toJpeg(input) {
  const kind = sniff(input);
  if (!kind) throw new Error('unreadable');
  let source = input;
  let raw = null;
  if (kind === 'heif') {
    source = Buffer.from(await heicConvert({ buffer: input, format: 'JPEG', quality: 0.92 }));
  } else if (kind === 'bmp') {
    const d = bmp.decode(input); // BGRA-ish: bmp-js returns ABGR bytes
    const rgba = Buffer.alloc(d.width * d.height * 4);
    for (let i = 0; i < d.width * d.height; i += 1) {
      rgba[i * 4] = d.data[i * 4 + 3];
      rgba[i * 4 + 1] = d.data[i * 4 + 2];
      rgba[i * 4 + 2] = d.data[i * 4 + 1];
      rgba[i * 4 + 3] = 255;
    }
    raw = { width: d.width, height: d.height, channels: 4 };
    source = rgba;
  }
  const img = raw ? sharp(source, { raw }) : sharp(source, { failOn: 'none', animated: false, limitInputPixels: 268_000_000 });
  return img
    .rotate() // follow the EXIF orientation
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
