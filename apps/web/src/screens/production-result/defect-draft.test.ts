import { describe, expect, it } from 'vitest';

import {
  areDefectRowsReady,
  checkDefectRows,
  defectLabelOf,
  groupDefectCodes,
  toDefectInputs,
  type ProcessDefectCode,
} from './defect-draft';

const code = (
  defectCodeId: number,
  defectName: string,
  parentDefectCodeId: number | null = null,
  extra: Partial<ProcessDefectCode> = {},
): ProcessDefectCode => ({
  defectCodeId,
  defectCode: `D${String(defectCodeId)}`,
  defectName,
  parentDefectCodeId,
  isActive: true,
  ...extra,
});

describe('groupDefectCodes', () => {
  it('상세를 대분류로 묶고, 상세 없는 대분류·비활성은 내지 않는다', () => {
    const majors = groupDefectCodes([
      code(1, '외관'),
      code(11, '긁힘', 1),
      code(12, '찍힘', 1, { isActive: false }),
      code(2, '치수'),
      /* 쓰지 않는 대분류도 상세가 있으면 머리 이름이 된다. */
      code(4, '포장', null, { isActive: false }),
      code(41, '오염', 4),
      /* 대분류 줄 없이 상세만 오면 상세에 실린 대분류 이름을 쓴다. */
      code(31, '미성형', 3, { parentDefectName: '성형' }),
    ]);

    expect(
      majors.map((major) => [major.name, major.minors.map((minor) => minor.defectName)]),
    ).toEqual([
      ['외관', ['긁힘']],
      ['포장', ['오염']],
      ['성형', ['미성형']],
    ]);
    expect(defectLabelOf(majors, 31)).toBe('성형 › 미성형');
    expect(defectLabelOf(majors, 2)).toBeNull();
  });
});

describe('불량 줄 검사', () => {
  it('같은 유형은 뒤 줄을 막고, 수량은 0 보다 커야 하며, 다 찬 줄만 보낸다', () => {
    const rows = [
      { key: 'a', defectCodeId: 11, qty: '3' },
      { key: 'b', defectCodeId: 11, qty: '1' },
      { key: 'c', defectCodeId: 12, qty: '0' },
      { key: 'd', defectCodeId: null, qty: '' },
    ];
    const checks = checkDefectRows(rows);

    expect(checks.get('a')).toEqual({ duplicate: false, qtyInvalid: false, complete: true });
    expect(checks.get('b')?.duplicate).toBe(true);
    expect(checks.get('c')?.qtyInvalid).toBe(true);
    expect(checks.get('d')?.complete).toBe(false);
    expect(areDefectRowsReady(rows)).toBe(false);
    expect(areDefectRowsReady([])).toBe(true);
    expect(toDefectInputs([{ key: 'a', defectCodeId: 11, qty: '3' }])).toEqual([
      { defectCodeId: 11, qty: 3 },
    ]);
  });
});
