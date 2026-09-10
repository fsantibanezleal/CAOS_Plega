import type { ExportFile, ExportResult } from "./types";
const encoder = new TextEncoder();
const crc = (bytes: Uint8Array): number => {
  let value = 0xffffffff;
  for (const b of bytes) {
    value ^= b;
    for (let i = 0; i < 8; i++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
};
const join = (parts: readonly Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
};

/** Deterministic ZIP STORE: only our bounded named exports, never archive imports. */
export function bundleFiles(
  files: readonly ExportFile[],
  name = "plega-files.zip",
): ExportResult<ExportFile> {
  if (
    !files.length ||
    files.length > 256 ||
    new Set(files.map((f) => f.name)).size !== files.length ||
    files.some(
      (f) =>
        !f.name ||
        f.name.length > 240 ||
        /[\/\\:"<>|?*\u0000-\u001f]/u.test(f.name) ||
        new TextDecoder().decode(encoder.encode(f.name)) !== f.name ||
        f.name === "." ||
        f.name === "..",
    ) ||
    files.reduce((n, f) => n + f.bytes.length, 0) > 128 * 1024 * 1024
  )
    return {
      ok: false,
      errors: [
        {
          code: "ARCHIVE_LIMIT",
          message:
            "The file set is empty, duplicated, unsafe or exceeds the 128 MiB archive limit.",
          entityIds: [],
        },
      ],
    };
  const local: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const filename = encoder.encode(file.name),
      checksum = crc(file.bytes);
    const header = new Uint8Array(30 + filename.length),
      h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint16(12, 33, true);
    h.setUint32(14, checksum, true);
    h.setUint32(18, file.bytes.length, true);
    h.setUint32(22, file.bytes.length, true);
    h.setUint16(26, filename.length, true);
    header.set(filename, 30);
    local.push(header, file.bytes);
    const entry = new Uint8Array(46 + filename.length),
      c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(14, 33, true);
    c.setUint32(16, checksum, true);
    c.setUint32(20, file.bytes.length, true);
    c.setUint32(24, file.bytes.length, true);
    c.setUint16(28, filename.length, true);
    c.setUint32(42, offset, true);
    entry.set(filename, 46);
    central.push(entry);
    offset += header.length + file.bytes.length;
  }
  const directory = join(central),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, directory.length, true);
  e.setUint32(16, offset, true);
  return {
    ok: true,
    value: {
      name: name.replace(/[\/\\\u0000-\u001f]/gu, "-"),
      mime: "application/zip",
      bytes: join([...local, directory, end]),
    },
  };
}
