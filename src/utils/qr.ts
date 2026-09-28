/**
 * Lightweight, zero-dependency QR Code SVG Generator for Connected TV.
 * Generates pure vector SVG markup directly without network requests or external libs.
 */

// Galois Field GF(256) tables for QR Reed-Solomon error correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p: Uint8Array, q: Uint8Array): Uint8Array {
  const r = new Uint8Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] ^= gfMul(p[i], q[j]);
    }
  }
  return r;
}

function rsGenPoly(n: number): Uint8Array {
  let g = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    g = polyMul(g, new Uint8Array([1, GF256_EXP[i]]));
  }
  return g;
}

function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGenPoly(ecCount);
  const res = new Uint8Array(data.length + ecCount);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// QR Version table for Byte mode with Medium EC (suitable for TV URLs)
interface QrVersionSpec {
  version: number;
  size: number;
  totalBytes: number;
  dataBytes: number;
  ecBytes: number;
  blocks: number;
  alignments: number[];
}

const QR_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, totalBytes: 26, dataBytes: 16, ecBytes: 10, blocks: 1, alignments: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 28, ecBytes: 16, blocks: 1, alignments: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 44, ecBytes: 26, blocks: 1, alignments: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 64, ecBytes: 36, blocks: 2, alignments: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 86, ecBytes: 48, blocks: 2, alignments: [6, 30] },
  { version: 6, size: 41, totalBytes: 172, dataBytes: 108, ecBytes: 64, blocks: 4, alignments: [6, 34] },
  { version: 7, size: 45, totalBytes: 196, dataBytes: 124, ecBytes: 72, blocks: 4, alignments: [6, 22, 38] },
  { version: 8, size: 49, totalBytes: 242, dataBytes: 154, ecBytes: 88, blocks: 4, alignments: [6, 24, 42] },
  { version: 9, size: 53, totalBytes: 292, dataBytes: 182, ecBytes: 110, blocks: 5, alignments: [6, 26, 46] },
  { version: 10, size: 57, totalBytes: 346, dataBytes: 216, ecBytes: 130, blocks: 5, alignments: [6, 28, 50] },
];

class BitBuffer {
  private buffer: number[] = [];
  private length = 0;

  put(num: number, length: number): void {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean): void {
    const byteIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= byteIndex) this.buffer.push(0);
    if (bit) this.buffer[byteIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  getLength(): number {
    return this.length;
  }
}

function encodeQrData(text: string, spec: QrVersionSpec): Uint8Array {
  const utf8 = new TextEncoder().encode(text);
  const bb = new BitBuffer();

  // Mode: Byte (0100)
  bb.put(0x4, 4);

  // Character count indicator (8 bits for version 1-9, 16 bits for version 10+)
  const countBits = spec.version < 10 ? 8 : 16;
  bb.put(utf8.length, countBits);

  // Data
  for (let i = 0; i < utf8.length; i++) {
    bb.put(utf8[i], 8);
  }

  // Terminator
  const totalDataBits = spec.dataBytes * 8;
  const remainingBits = totalDataBits - bb.getLength();
  bb.put(0, Math.min(4, Math.max(0, remainingBits)));

  // Pad to 8-bit boundary
  while (bb.getLength() % 8 !== 0) {
    bb.putBit(false);
  }

  // Pad bytes (0xEC, 0x11)
  const bytes = bb.getBytes();
  const res = new Uint8Array(spec.dataBytes);
  res.set(bytes.slice(0, spec.dataBytes));
  let padToggle = 0;
  for (let i = bytes.length; i < spec.dataBytes; i++) {
    res[i] = padToggle === 0 ? 0xec : 0x11;
    padToggle ^= 1;
  }

  // Interleave blocks and compute EC
  const blockSize = Math.floor(spec.dataBytes / spec.blocks);
  const ecPerBlock = spec.ecBytes / spec.blocks;
  const finalData = new Uint8Array(spec.totalBytes);

  const blockData: Uint8Array[] = [];
  const blockEc: Uint8Array[] = [];

  for (let b = 0; b < spec.blocks; b++) {
    const start = b * blockSize;
    const sub = res.slice(start, start + blockSize);
    blockData.push(sub);
    blockEc.push(rsCompute(sub, ecPerBlock));
  }

  let ptr = 0;
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalData[ptr++] = blockData[b][i];
    }
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      finalData[ptr++] = blockEc[b][i];
    }
  }

  return finalData;
}

function buildQrMatrix(data: Uint8Array, spec: QrVersionSpec): boolean[][] {
  const n = spec.size;
  const matrix: (boolean | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const isFunction: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));

  const markFn = (r: number, c: number, v: boolean) => {
    matrix[r][c] = v;
    isFunction[r][c] = true;
  };

  // 1. Finder patterns (top-left, top-right, bottom-left)
  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBlack = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          markFn(nr, nc, isBlack);
        } else {
          markFn(nr, nc, false); // Separator
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, n - 7);
  addFinder(n - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < n - 8; i++) {
    if (!isFunction[6][i]) markFn(6, i, i % 2 === 0);
    if (!isFunction[i][6]) markFn(i, 6, i % 2 === 0);
  }

  // 3. Dark module
  markFn(4 * spec.version + 9, 8, true);

  // 4. Alignment patterns
  const aligns = spec.alignments;
  for (let i = 0; i < aligns.length; i++) {
    for (let j = 0; j < aligns.length; j++) {
      const ar = aligns[i];
      const ac = aligns[j];
      if (isFunction[ar][ac]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          markFn(ar + r, ac + c, isBlack);
        }
      }
    }
  }

  // Reserve format bits
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) markFn(8, i, false);
    if (!isFunction[i][8]) markFn(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][n - 1 - i]) markFn(8, n - 1 - i, false);
    if (!isFunction[n - 1 - i][8]) markFn(n - 1 - i, 8, false);
  }

  // 5. Data bits placement
  let byteIndex = 0;
  let bitIndex = 7;
  let upwards = true;

  for (let right = n - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    for (let vert = 0; vert < n; vert++) {
      const r = upwards ? n - 1 - vert : vert;
      for (let c = right; c > right - 2; c--) {
        if (!isFunction[r][c]) {
          let bit = false;
          if (byteIndex < data.length) {
            bit = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            bitIndex--;
            if (bitIndex < 0) {
              bitIndex = 7;
              byteIndex++;
            }
          }
          // Mask pattern 0: (row + col) % 2 === 0
          if ((r + c) % 2 === 0) bit = !bit;
          matrix[r][c] = bit;
        }
      }
    }
    upwards = !upwards;
  }

  // Format bits for Medium Error Correction + Mask 0: 0b101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[n - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][n - 15 + i] = formatBits[i] === 1;

  return matrix.map(row => row.map(cell => Boolean(cell)));
}

export interface QrDataModel {
  path: string;
  totalModules: number;
}

/**
 * Generates the SVG path and module count for native template rendering.
 */
export function generateQrDataModel(text: string, margin = 2): QrDataModel | null {
  if (!text) return null;

  const byteLength = new TextEncoder().encode(text).length;
  const spec = QR_SPECS.find(s => s.dataBytes >= byteLength + (s.version < 10 ? 2 : 3)) ?? QR_SPECS[QR_SPECS.length - 1];

  try {
    const encoded = encodeQrData(text, spec);
    const matrix = buildQrMatrix(encoded, spec);
    const modules = matrix.length;
    const totalModules = modules + margin * 2;

    let path = '';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        if (matrix[r][c]) {
          const x = c + margin;
          const y = r + margin;
          path += `M${x},${y}h1v1h-1z `;
        }
      }
    }

    return {
      path: path.trim(),
      totalModules,
    };
  } catch {
    return null;
  }
}

/**
 * Generates an SVG string representation of a QR Code.
 * @param text The URL or string to encode.
 * @param size Desired SVG pixel width/height (default 180).
 * @param margin Margin in modules around the QR (default 2).
 */
export function generateQrSvg(text: string, size = 180, margin = 2): string {
  const model = generateQrDataModel(text, margin);
  if (!model) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${model.totalModules} ${model.totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <path d="${model.path}" fill="#000000"/>
  </svg>`;
}

