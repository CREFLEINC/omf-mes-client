import { describe, expect, it } from 'vitest';

import { buildTestLabel } from './serial-diagnostic';

describe('실기 진단 라벨', () => {
  it.each([
    ['80x30', 'SIZE 80 mm,30 mm'],
    ['100x60', 'SIZE 100 mm,60 mm'],
  ] as const)('%s 는 그 규격의 대지를 잡는다', (size, expected) => {
    expect(buildTestLabel(size)).toContain(expected);
  });

  // ⚠ `\n` 만으로는 끊기지 않는 기종이 있다.
  it('명령을 CRLF 로 끊는다', () => {
    const label = buildTestLabel('80x30');

    expect(label).toContain('\r\n');
    expect(label).not.toMatch(/[^\r]\n/);
    expect(label.endsWith('\r\n')).toBe(true);
  });

  /* ⭐ 규격과 스캔을 한 장으로 함께 본다 — 완료 조건이 둘 다 요구한다. */
  it('글자와 바코드가 함께 있고 인쇄로 끝난다', () => {
    const label = buildTestLabel('80x30');

    expect(label).toContain('TEXT ');
    expect(label).toContain('BARCODE ');
    expect(label.trimEnd().endsWith('PRINT 1')).toBe(true);
  });

  /*
   * ⛔ 시험 라벨에 업무 자료가 실리면 그것이 곧 「셸이 서식을 갖는다」가 된다(결정 18).
   *    바코드 내용은 영문·숫자로 둔다 — 라벨 사양이 그 범위다.
   */
  it('영문·숫자만 싣는다', () => {
    expect(buildTestLabel('100x60')).toMatch(/^[\x20-\x7e\r\n]+$/);
  });
});
