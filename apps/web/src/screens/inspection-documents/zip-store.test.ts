import { describe, expect, it } from 'vitest';

import { uniqueNames, zipStore } from './zip-store';

const bytes = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);

describe('zipStore', () => {
  it('파일마다 머리 · 이름 · 내용을 싣고 끝 레코드에 건수를 적는다', async () => {
    const blob = zipStore([
      { name: '검사사진-01.png', data: bytes('abc') },
      { name: 'b.txt', data: bytes('hello') },
    ]);
    const view = new DataView(await blob.arrayBuffer());

    expect(blob.type).toBe('application/zip');
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    /* 이름은 UTF-8 표시를 켠다. */
    expect(view.getUint16(6, true)).toBe(0x0800);
    /* 「abc」의 CRC-32. */
    expect(view.getUint32(14, true)).toBe(0x352441c2);
    const end = view.byteLength - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
  });
});

describe('uniqueNames', () => {
  it('같은 이름의 뒤 파일에 번호를 붙인다', () => {
    expect(uniqueNames(['a.png', 'a.png', 'b', 'b', 'a.png'])).toEqual([
      'a.png',
      'a (2).png',
      'b',
      'b (2)',
      'a (3).png',
    ]);
  });
});
