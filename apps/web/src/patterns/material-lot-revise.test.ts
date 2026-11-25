import { describe, expect, it } from 'vitest';

import {
  checkRevise,
  lotNoAfterRevise,
  reviseDraftOf,
  reviseRejectionOf,
  toReviseBody,
} from './material-lot-revise';

const ROLL = { uomId: 31, uomCode: 'ROLL', uomName: '롤', count: 10, qtyPerPackage: 10 };

describe('US3 출력 전 수정 — 칸 · 본문(피처 014 FR-016)', () => {
  it('US3-1 100 EA · ROLL 10 × 10 → 80 · ROLL 8 × 10 이면 본문이 qty 80 · package 8 × 10', () => {
    const draft = { ...reviseDraftOf({ lotQty: 100, package: ROLL }, null), packageCount: '8' };
    const check = checkRevise(draft, true);

    expect(check.ok).toBe(true);
    expect(toReviseBody(check)).toEqual({
      qty: 80,
      package: { uomId: 31, count: 8, qtyPerPackage: 10 },
    });
  });

  it('US3-2 패키징 수 × 패키징당 수량 ≠ 재고량이면 막는다', () => {
    const draft = {
      ...reviseDraftOf({ lotQty: 100, package: ROLL }, null),
      packageCount: '7',
      lotQty: '80',
      lotQtyEdited: true,
    };
    const check = checkRevise(draft, true);

    expect(check.ok).toBe(false);
    expect(check.errors.mismatch).toBe(true);
    expect(toReviseBody(check)).toBeNull();
  });

  it('US3-2 재고량 0 이하는 막고, 패키징 없음이면 package: null', () => {
    const none = reviseDraftOf({ lotQty: 50, package: null }, 31);

    expect(none.packageOn).toBe(false);
    expect(toReviseBody(checkRevise(none, true))).toEqual({ qty: 50, package: null });
    expect(checkRevise({ ...none, lotQty: '0' }, true).ok).toBe(false);
  });

  it('US3-1 수량이 바뀌면 저장 뒤 번호는 수량 자리가 바뀌고 일련은 새로(NNNN), 같으면 그대로', () => {
    const lotNo = '040101-00022S|100|261123|100019|0002';

    expect(lotNoAfterRevise(lotNo, 80)).toBe('040101-00022S|80|261123|100019|NNNN');
    expect(lotNoAfterRevise(lotNo, 100)).toBe(lotNo);
    expect(lotNoAfterRevise('LOT-X', 80)).toBeNull();
  });

  it('US3-3 409 ALREADY_PRINTED · STATE_LOCKED · LOT_NO_CONFLICT 를 가른다', () => {
    const of = (code: string) =>
      reviseRejectionOf({
        kind: 'validation',
        status: 409,
        errors: [{ scope: 'screen', code, message: code }],
      });

    expect(of('ALREADY_PRINTED')).toBe('alreadyPrinted');
    expect(of('STATE_LOCKED')).toBe('stateLocked');
    expect(of('LOT_NO_CONFLICT')).toBe('conflict');
    expect(of('INVALID')).toBe('other');
  });
});
