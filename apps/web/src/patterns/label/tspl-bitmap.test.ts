import { describe, expect, it } from 'vitest';

import { createBitmap, fillRect } from './bitmap';
import { toTsplBitmap } from './tspl-bitmap';

const decode = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

describe('toTsplBitmap', () => {
  it('80 × 30 mm 대지에 점판을 BITMAP 으로 싣는다 — 검은 점은 비트 0', () => {
    const bitmap = createBitmap(639, 240);
    fillRect(bitmap, 0, 0, 1, 1);
    fillRect(bitmap, 9, 1, 1, 1);

    const text = decode(toTsplBitmap(bitmap));
    const head = 'BITMAP 0,0,80,240,0,';
    const start = text.indexOf(head) + head.length;

    expect(text.startsWith('SIZE 80 mm,30 mm\r\n')).toBe(true);
    expect(text.charCodeAt(start)).toBe(0x7f);
    expect(text.charCodeAt(start + 80 + 1)).toBe(0xbf);
    /* 폭(639)을 넘는 끝 비트는 흰색이다 — 검게 두면 오른쪽 끝에 세로줄이 찍힌다. */
    expect(text.charCodeAt(start + 79)).toBe(0xff);
    expect(text.slice(start + 80 * 240)).toBe('\r\nPRINT 1,1\r\n');
  });
});
