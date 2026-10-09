import { deflateRaw, inflateRaw } from "pako";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encodeName(file.name);
    const data = file.data;
    const crc = crc32(data);
    const compressed = deflateRaw(data);
    const useStore = compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
      payload,
    ]);
    const central = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const localBlob = concat(locals);
  const centralBlob = concat(centrals);
  const eocd = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBlob.length),
    u32(localBlob.length),
    u16(0),
  ]);
  return concat([localBlob, centralBlob, eocd]);
}

function readU16(bytes: Uint8Array, i: number): number {
  return bytes[i] | (bytes[i + 1] << 8);
}

function readU32(bytes: Uint8Array, i: number): number {
  return (bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0;
}

export function zipRead(bytes: Uint8Array): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  let i = 0;
  while (i + 30 <= bytes.length) {
    if (readU32(bytes, i) !== 0x04034b50) break;
    const method = readU16(bytes, i + 8);
    const compSize = readU32(bytes, i + 18);
    const uncompSize = readU32(bytes, i + 22);
    const nameLen = readU16(bytes, i + 26);
    const extraLen = readU16(bytes, i + 28);
    const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extraLen;
    const payload = bytes.slice(start, start + compSize);
    try {
      out[name] = method === 8 ? inflateRaw(payload) : method === 0 ? payload : payload;
      if (method === 0 && out[name].length !== uncompSize && uncompSize) {
        out[name] = payload.slice(0, uncompSize);
      }
    } catch {
      out[name] = payload;
    }
    i = start + compSize;
  }
  return out;
}
