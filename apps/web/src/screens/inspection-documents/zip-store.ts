/**
 * 여러 파일을 zip 하나로 묶는다 — 압축하지 않고(STORE) 담기만 한다(첨부 일괄 내려받기 · 사용자 지시 2026-10-27 · #185).
 * 첨부는 대개 이미 압축된 형식(PDF · 이미지 · 오피스)이라 다시 압축해도 크기가 거의 줄지 않는다 — 외부 묶음 없이 쓴다.
 * 파일 이름은 UTF-8 로 적고 그 표시(일반 목적 비트 11)를 켠다 — 한글 이름이 깨지지 않는다.
 * ⚠ zip64 를 쓰지 않는다 — 합이 4GB 를 넘으면 안 된다(첨부 한 건이 10MB 상한이라 닿지 않는다).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** MS-DOS 날짜 · 시각(zip 머리의 형식). */
const dosTime = (date: Date): { time: number; day: number } => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  day: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

/** 같은 이름이 둘이면 뒤의 것에 「 (2)」를 붙인다 — 풀 때 앞 파일을 덮지 않게. */
export const uniqueNames = (names: readonly string[]): string[] => {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
    let index = 2;
    while (used.has(`${base} (${String(index)})${ext}`)) index += 1;
    const next = `${base} (${String(index)})${ext}`;
    used.add(next);
    return next;
  });
};

export const zipStore = (
  files: readonly { name: string; data: Uint8Array<ArrayBuffer> }[],
  now: Date = new Date(),
): Blob => {
  const encoder = new TextEncoder();
  const { time, day } = dosTime(now);
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, file.data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + size;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
};
