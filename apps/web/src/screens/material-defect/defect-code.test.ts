import { describe, expect, it } from 'vitest';

import { minorsOf, type DefectCode } from './defect-code';

/** 담당자 검증 #108 ② — 대분류를 고르기 전에는 「불량 상세」에 아무것도 없다(대분류가 상세로 새지 않는다). */
const CODES: DefectCode[] = [
  {
    defectCodeId: 1,
    defectCode: 'APP',
    defectName: '외관',
    parentDefectCodeId: null,
    isActive: true,
  },
  {
    defectCodeId: 2,
    defectCode: 'APP-SCR',
    defectName: '스크래치',
    parentDefectCodeId: 1,
    isActive: true,
  },
] as DefectCode[];

describe('minorsOf', () => {
  it('대분류를 고르기 전에는 빈 목록이다', () => {
    expect(minorsOf(CODES, '')).toEqual([]);
  });

  it('대분류를 고르면 그 상세만 낸다', () => {
    expect(minorsOf(CODES, '1').map((code) => code.defectCodeId)).toEqual([2]);
  });
});
