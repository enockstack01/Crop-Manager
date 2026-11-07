/*
 * SHA-256 that can be fed a file piece by piece and can be saved and restored. The offline assistant is a 769 MB download that may take
 * several sittings: each 4 MB piece is added to the running checksum as it arrives, the running state is saved next to the partial file, and
 * a resumed download carries on from it instead of reading gigabytes again. At the end the result is compared with the published checksum.
 * Plain arithmetic with no phone code, so it is tested on a computer against Node's own SHA-256 (mobile/scripts/test-checksum.mjs).
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const START = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
const W = new Uint32Array(64);

export type Sha256State = { h: number[]; buf: number[]; total: number };

export class Sha256 {
  private h = new Uint32Array(START);
  private buf = new Uint8Array(64);
  private len = 0; // bytes waiting in buf
  private total = 0; // bytes fed in so far

  /** How many bytes have been fed in. */
  get bytes() { return this.total; }

  private block(b: Uint8Array, at: number) {
    for (let i = 0; i < 16; i += 1) {
      const j = at + i * 4;
      W[i] = ((b[j] << 24) | (b[j + 1] << 16) | (b[j + 2] << 8) | b[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i += 1) {
      const a = W[i - 15];
      const c = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((c >>> 17) | (c << 15)) ^ ((c >>> 19) | (c << 13)) ^ (c >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b2, c, d, e, f, g, h] = this.h;
    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b2) ^ (a & c) ^ (b2 & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b2; b2 = a; a = (t1 + t2) >>> 0;
    }
    const s = this.h;
    s[0] = (s[0] + a) >>> 0; s[1] = (s[1] + b2) >>> 0; s[2] = (s[2] + c) >>> 0; s[3] = (s[3] + d) >>> 0;
    s[4] = (s[4] + e) >>> 0; s[5] = (s[5] + f) >>> 0; s[6] = (s[6] + g) >>> 0; s[7] = (s[7] + h) >>> 0;
  }

  update(data: Uint8Array): this {
    let i = 0;
    this.total += data.length;
    if (this.len) {
      const take = Math.min(64 - this.len, data.length);
      this.buf.set(data.subarray(0, take), this.len);
      this.len += take;
      i = take;
      if (this.len === 64) { this.block(this.buf, 0); this.len = 0; }
    }
    for (; i + 64 <= data.length; i += 64) this.block(data, i);
    if (i < data.length) { this.buf.set(data.subarray(i), 0); this.len = data.length - i; }
    return this;
  }

  /** The checksum of everything fed in so far, as 64 hexadecimal characters. Feeding can go on afterwards. */
  digestHex(): string {
    const copy = new Sha256();
    copy.h.set(this.h);
    copy.buf.set(this.buf);
    copy.len = this.len;
    copy.total = this.total;
    const bits = copy.total * 8;
    const padLen = (copy.len < 56 ? 56 : 120) - copy.len;
    const pad = new Uint8Array(padLen + 8);
    pad[0] = 0x80;
    const hi = Math.floor(bits / 0x100000000);
    const lo = bits >>> 0;
    for (let k = 0; k < 4; k += 1) { pad[padLen + k] = (hi >>> (24 - 8 * k)) & 255; pad[padLen + 4 + k] = (lo >>> (24 - 8 * k)) & 255; }
    const total = copy.total;
    copy.update(pad);
    copy.total = total;
    return Array.from(copy.h, (x) => x.toString(16).padStart(8, '0')).join('');
  }

  toState(): Sha256State {
    return { h: Array.from(this.h), buf: Array.from(this.buf.subarray(0, this.len)), total: this.total };
  }

  static fromState(s: Sha256State): Sha256 {
    const x = new Sha256();
    x.h.set(s.h);
    x.buf.set(s.buf);
    x.len = s.buf.length;
    x.total = s.total;
    return x;
  }
}
