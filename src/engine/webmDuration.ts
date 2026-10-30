/**
 * MediaRecorder writes WebM files without a Duration, so players can't seek them or show length.
 * This inserts (or overwrites) Segment > Info > Duration. Chrome/Firefox recordings use an
 * unknown-size Segment and no SeekHead offsets that would need patching, so a local splice is safe.
 */
const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_DURATION = 0x4489;

function readVint(b: Uint8Array, pos: number, keepMarker: boolean): { value: number; len: number } | null {
  const first = b[pos];
  if (first === undefined || first === 0) return null;
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  if (len > 8 || pos + len > b.length) return null;
  let value = keepMarker ? first : first & (0xff >> len);
  let allOnes = value === (0xff >> len);
  for (let i = 1; i < len; i++) {
    value = value * 256 + b[pos + i];
    if (b[pos + i] !== 0xff) allOnes = false;
  }
  return { value: !keepMarker && allOnes ? -1 : value, len };
}

function sizeVint8(n: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(8);
  out[0] = 0x01;
  for (let i = 7; i >= 1; i--) {
    out[i] = n % 256;
    n = Math.floor(n / 256);
  }
  return out;
}

export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const b: Uint8Array<ArrayBuffer> = new Uint8Array(await blob.arrayBuffer());
    // Skip the EBML header.
    const ebmlId = readVint(b, 0, true);
    const ebmlSize = ebmlId && readVint(b, ebmlId.len, false);
    if (!ebmlId || !ebmlSize || ebmlSize.value < 0) return blob;
    let pos = ebmlId.len + ebmlSize.len + ebmlSize.value;

    const segId = readVint(b, pos, true);
    if (!segId || segId.value !== ID_SEGMENT) return blob;
    const segSize = readVint(b, pos + segId.len, false);
    if (!segSize) return blob;
    pos += segId.len + segSize.len;

    // Find Info among the Segment's first children.
    for (let guard = 0; guard < 16 && pos < b.length; guard++) {
      const id = readVint(b, pos, true);
      const size = id && readVint(b, pos + id.len, false);
      if (!id || !size || size.value < 0) return blob;
      const bodyStart = pos + id.len + size.len;
      const bodyEnd = bodyStart + size.value;
      if (id.value !== ID_INFO) {
        pos = bodyEnd;
        continue;
      }
      const durBytes = new Uint8Array(8);
      new DataView(durBytes.buffer).setFloat64(0, durationMs);
      // Overwrite an existing 8-byte Duration in place.
      let p = bodyStart;
      while (p < bodyEnd) {
        const cid = readVint(b, p, true);
        const csize = cid && readVint(b, p + cid.len, false);
        if (!cid || !csize || csize.value < 0) break;
        const cbody = p + cid.len + csize.len;
        if (cid.value === ID_DURATION && csize.value === 8) {
          b.set(durBytes, cbody);
          return new Blob([b], { type: blob.type });
        }
        p = cbody + csize.value;
      }
      // Otherwise append a Duration element and rewrite Info's size.
      const durEl = new Uint8Array([0x44, 0x89, 0x88, ...durBytes]);
      const newSize = size.value + durEl.length;
      const head = b.subarray(0, pos + id.len);
      const body = b.subarray(bodyStart, bodyEnd);
      const tail = b.subarray(bodyEnd);
      return new Blob([head, sizeVint8(newSize), body, durEl, tail], { type: blob.type });
    }
    return blob;
  } catch {
    return blob;
  }
}
