import { describe, expect, it } from 'vitest';

import { toConcessionCardinality } from './conditions';
import type { Concession, ConcessionListResponse } from './types';

const concession = (approvalRequestId = 31, concessionId = 501): Concession => ({
  concessionId,
  concessionNo: 'SYNTH-CN-501',
  nonconformanceId: 701,
  lotId: 801,
  approvedQty: 10,
  consumedQty: 2,
  uomId: 901,
  validFrom: '2026-08-22',
  approvalRequestId,
  statusCode: 'SYNTH-ACTIVE',
  usable: true,
});

const response = (items: Concession[], total: number): ConcessionListResponse => ({
  items,
  page: { page: 1, size: 2, total },
});

describe('toConcessionCardinality', () => {
  it('total과 items가 모두 0일 때만 연결 없음으로 판정한다', () => {
    expect(toConcessionCardinality(31, response([], 0))).toEqual({ kind: 'none' });
    expect(toConcessionCardinality(31, response([], 1))).toEqual({ kind: 'unsafe' });
    expect(toConcessionCardinality(31, response([concession()], 0))).toEqual({ kind: 'unsafe' });
  });

  it('정확히 한 건이고 요청 번호가 일치할 때만 특채 번호를 노출한다', () => {
    const source = response([concession()], 1);
    const before = structuredClone(source);

    expect(toConcessionCardinality(31, source)).toEqual({ kind: 'one', concessionId: 501 });
    expect(source).toEqual(before);
  });

  it.each([
    response([concession(99)], 1),
    response([concession(), concession(31, 502)], 2),
    response([concession()], 2),
  ])('불일치·중복·개수 모순은 안전하게 특정하지 않는다', (source) => {
    expect(toConcessionCardinality(31, source)).toEqual({ kind: 'unsafe' });
  });
});
