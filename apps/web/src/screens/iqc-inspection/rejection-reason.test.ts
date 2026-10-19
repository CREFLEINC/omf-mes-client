import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { EMPTY_REJECTION, resolveDefectCode } from './rejection-reason';

const t = messages.iqcInspection.result.rejection;
const codes = [
  { defectCodeId: 1, defectCode: 'A', defectName: '대분류-상세있음', isActive: true },
  { defectCodeId: 2, defectCode: 'A-1', defectName: '상세', parentDefectCodeId: 1, isActive: true },
  { defectCodeId: 3, defectCode: 'B', defectName: '대분류-상세없음', isActive: true },
];

describe('resolveDefectCode (omf-all-around#106)', () => {
  it('대분류를 고르지 않으면 막는다', () => {
    expect(resolveDefectCode(codes, EMPTY_REJECTION)).toEqual({ blocked: t.required });
  });

  it('상세가 있는 대분류는 상세까지 골라야 한다', () => {
    expect(resolveDefectCode(codes, { ...EMPTY_REJECTION, majorId: '1' })).toEqual({
      blocked: t.minorRequired,
    });
    expect(resolveDefectCode(codes, { ...EMPTY_REJECTION, majorId: '1', minorId: '2' })).toEqual({
      defectCodeId: 2,
    });
  });

  it('상세가 없는 대분류는 그 자체를 기록한다', () => {
    expect(resolveDefectCode(codes, { ...EMPTY_REJECTION, majorId: '3' })).toEqual({
      defectCodeId: 3,
    });
  });
});
