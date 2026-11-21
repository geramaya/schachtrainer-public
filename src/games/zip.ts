/** Minimal ZIP writer (PKZIP appnote 6.3.x): STORE only, UTF-8 names (flag bit 11), DOS date/time, no ZIP64 (limit 65535 files / 4 GiB). */
export interface ZipFile { name: string; data: Uint8Array; date: Date }

const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (const b of data) c = TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Local time as MS-DOS time and date words; years before 1980 are clamped to 1980-01-01. */
function dosStamp(d: Date): { time: number; date: number } {
  if (d.getFullYear() < 1980) return { time: 0, date: (0 << 9) | (1 << 5) | 1 }
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

export function makeZip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder()
  const entries = files.map((f) => ({ f, name: enc.encode(f.name), crc: crc32(f.data), stamp: dosStamp(f.date) }))
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.f.data.length, 0)
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0)
  const out = new Uint8Array(localSize + centralSize + 22)
  const v = new DataView(out.buffer)
  let p = 0
  const offsets: number[] = []
  for (const e of entries) {
    offsets.push(p)
    v.setUint32(p, 0x04034b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 0x0800, true); v.setUint16(p + 8, 0, true)
    v.setUint16(p + 10, e.stamp.time, true); v.setUint16(p + 12, e.stamp.date, true)
    v.setUint32(p + 14, e.crc, true); v.setUint32(p + 18, e.f.data.length, true); v.setUint32(p + 22, e.f.data.length, true)
    v.setUint16(p + 26, e.name.length, true); v.setUint16(p + 28, 0, true)
    out.set(e.name, p + 30); out.set(e.f.data, p + 30 + e.name.length)
    p += 30 + e.name.length + e.f.data.length
  }
  const centralStart = p
  entries.forEach((e, i) => {
    v.setUint32(p, 0x02014b50, true); v.setUint16(p + 4, 20, true); v.setUint16(p + 6, 20, true); v.setUint16(p + 8, 0x0800, true); v.setUint16(p + 10, 0, true)
    v.setUint16(p + 12, e.stamp.time, true); v.setUint16(p + 14, e.stamp.date, true)
    v.setUint32(p + 16, e.crc, true); v.setUint32(p + 20, e.f.data.length, true); v.setUint32(p + 24, e.f.data.length, true)
    v.setUint16(p + 28, e.name.length, true) // extra, comment, disk, attributes stay 0
    v.setUint32(p + 42, offsets[i]!, true)
    out.set(e.name, p + 46)
    p += 46 + e.name.length
  })
  v.setUint32(p, 0x06054b50, true)
  v.setUint16(p + 8, entries.length, true); v.setUint16(p + 10, entries.length, true)
  v.setUint32(p + 12, centralSize, true); v.setUint32(p + 16, centralStart, true)
  return out
}
