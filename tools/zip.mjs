// A minimal zip writer (stored, not compressed): enough for the extension download, with no dependency.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

async function walk(dir, base = dir, skip = () => false) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(base, p).split(path.sep).join('/');
    if (skip(rel)) continue;
    if (e.isDirectory()) out.push(...await walk(p, base, skip));
    else out.push({ rel, data: await readFile(p) });
  }
  return out;
}

/** Zip every file under `dir` (paths inside the zip start at `prefix/`), except those `skip(relativePath)` refuses. */
export async function zipDir(dir, file, { prefix = '', skip = () => false } = {}) {
  const files = await walk(dir, dir, skip);
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(prefix ? `${prefix}/${f.rel}` : f.rel, 'utf8');
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(f.data.length, 18); local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(0, 10);
    head.writeUInt32LE(0, 12); head.writeUInt32LE(crc, 16); head.writeUInt32LE(f.data.length, 20); head.writeUInt32LE(f.data.length, 24);
    head.writeUInt16LE(name.length, 28); head.writeUInt16LE(0, 30); head.writeUInt16LE(0, 32); head.writeUInt16LE(0, 34); head.writeUInt16LE(0, 36);
    head.writeUInt32LE(0, 38); head.writeUInt32LE(offset, 42);
    central.push(head, name);
    offset += local.length + name.length + f.data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.concat([...parts, ...central, end]));
  return files.map(f => f.rel);
}
