/**
 * Minimal QR Code encoder (byte mode, ISO/IEC 18004), dependency-free. It is loaded lazily by the
 * desktop chat popover only, so it never ships in the first page load. The algorithm follows the
 * public-domain reference design by Project Nayuki (tables, Reed-Solomon, masking and penalties).
 */

type Ecc = 0 | 1 | 2 | 3; // L, M, Q, H
const FORMAT_BITS: Record<Ecc, number> = { 0: 1, 1: 0, 2: 3, 3: 2 };

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(version: number, ecc: Ecc): number {
  return Math.floor(rawDataModules(version) / 8) - ECC_CODEWORDS_PER_BLOCK[ecc][version] * NUM_ERROR_CORRECTION_BLOCKS[ecc][version];
}

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const value of data) {
    const factor = value ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coefficient, index) => { result[index] ^= gfMultiply(coefficient, factor); });
  }
  return result;
}

export type QrMatrix = { size: number; modules: boolean[][] };

/** Encodes UTF-8 text as a QR code, choosing the smallest version and the strongest ECC that fits. */
export function encodeQr(text: string, minimumEcc: Ecc = 0): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 1;
  for (; version <= 40; version++) {
    const countBits = version <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version, minimumEcc) * 8) break;
  }
  if (version > 40) throw new Error("qr-data-too-long");
  const countBits = version <= 9 ? 8 : 16;
  const used = 4 + countBits + bytes.length * 8;
  let ecc = minimumEcc;
  for (const higher of [1, 2, 3] as Ecc[]) if (higher > ecc && used <= dataCodewords(version, higher) * 8) ecc = higher;

  const bits: number[] = [];
  const append = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  append(0b0100, 4);
  append(bytes.length, countBits);
  for (const value of bytes) append(value, 8);
  const capacity = dataCodewords(version, ecc) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFunction = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; isFunction[y][x] = true; };

  for (let i = 0; i < size; i++) { setFunction(6, i, i % 2 === 0); setFunction(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFunction(x, y, distance !== 2 && distance !== 4);
    }
  }
  const alignment: number[] = [];
  if (version > 1) {
    const count = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
    alignment.push(6);
    for (let position = size - 7; alignment.length < count; position -= step) alignment.splice(1, 0, position);
  }
  alignment.forEach((ay, i) => alignment.forEach((ax, j) => {
    const last = alignment.length - 1;
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));

  const drawFormat = (mask: number) => {
    const value = (FORMAT_BITS[ecc] << 3) | mask;
    let remainder = value;
    for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    const format = ((value << 10) | remainder) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(format, i));
    setFunction(8, 7, bit(format, 6));
    setFunction(8, 8, bit(format, 7));
    setFunction(7, 8, bit(format, 8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(format, i));
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(format, i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(format, i));
    setFunction(8, size - 8, true);
  };
  drawFormat(0);
  if (version >= 7) {
    let remainder = version;
    for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
    const versionBits = (version << 12) | remainder;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setFunction(a, b, bit(versionBits, i));
      setFunction(b, a, bit(versionBits, i));
    }
  }

  // Error correction and interleaving.
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[ecc][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = blockCount - (rawCodewords % blockCount);
  const shortLength = Math.floor(rawCodewords / blockCount);
  const divisor = reedSolomonDivisor(eccLength);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const block = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1));
    k += block.length;
    const remainder = reedSolomonRemainder(block, divisor);
    if (i < shortBlocks) block.push(0);
    blocks.push(block.concat(remainder));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => {
    if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]);
  });

  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vertical : vertical;
      if (!isFunction[y][x] && index < codewords.length * 8) {
        modules[y][x] = bit(codewords[index >>> 3], 7 - (index & 7));
        index++;
      }
    }
  }

  const masked = (mask: number, x: number, y: number) => {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  };
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && masked(mask, x, y)) modules[y][x] = !modules[y][x];
  };

  let best = 0, bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules, size);
    if (score < bestPenalty) { best = mask; bestPenalty = score; }
    applyMask(mask);
  }
  applyMask(best);
  drawFormat(best);
  return { size, modules };
}

function penalty(modules: boolean[][], size: number): number {
  let result = 0, dark = 0;
  const finderLike = (line: boolean[], start: number) => {
    // 1:1:3:1:1 dark pattern with four light modules on one side.
    const pattern = [true, false, true, true, true, false, true];
    for (let i = 0; i < 7; i++) if (line[start + i] !== pattern[i]) return false;
    const before = start >= 4 && [1, 2, 3, 4].every((d) => !line[start - d]);
    const after = start + 11 <= line.length && [7, 8, 9, 10].every((d) => !line[start + d]);
    return before || after;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      const line = Array.from({ length: size }, (_, b) => pass === 0 ? modules[a][b] : modules[b][a]);
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && line[b] === line[b - 1]) run++;
        else { if (run >= 5) result += run - 2; run = 1; }
      }
      for (let b = 0; b + 7 <= size; b++) if (finderLike(line, b)) result += 40;
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (modules[y][x]) dark++;
    if (x + 1 < size && y + 1 < size) {
      const color = modules[y][x];
      if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += 3;
    }
  }
  const total = size * size;
  result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return result;
}

/** One SVG path for the dark modules, with the standard four-module quiet zone. */
export function qrSvgPath({ size, modules }: QrMatrix, quiet = 4): { viewBox: string; path: string } {
  let path = "";
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
  const extent = size + quiet * 2;
  return { viewBox: `0 0 ${extent} ${extent}`, path };
}
