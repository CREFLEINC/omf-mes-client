import { describe, expect, it } from 'vitest';

import type { Lot } from '../../patterns/lots';
import {
  FEFO,
  FIFO,
  canPick,
  isRecommended,
  isShelfLifeUnknown,
  lotProblem,
  qtyProblem,
  rankCandidates,
  remainingAllocated,
  remainingDays,
  sortFieldOf,
  toPickBody,
  type Candidate,
  type ShipmentRequestLine,
} from './picking';

const TODAY = new Date('2026-09-01T00:00:00.000Z');

const lot = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: 11,
  lotNo: 'FG-2026-0311',
  itemId: 31,
  lotTypeCode: 'PRODUCT',
  plantId: 1,
  initialQty: 500,
  uomId: 9,
  sourceTypeCode: 'PRODUCTION',
  sourceId: 1,
  statusCode: 'NORMAL',
  expiryDate: '2027-03-03',
  manufacturedAt: '2026-03-03T00:00:00+09:00',
  ...overrides,
});

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  lot: lot(),
  availableQty: 500,
  held: false,
  ...overrides,
});

const line = (overrides: Partial<ShipmentRequestLine> = {}): ShipmentRequestLine => ({
  shipmentRequestLineId: 77,
  lineNo: 1,
  itemId: 31,
  requestedQty: 300,
  allocatedQty: 300,
  pickedQty: 120,
  shippedQty: 0,
  uomId: 9,
  shippingInspectionRequired: false,
  picks: [],
  ...overrides,
});

describe('잔여 유효기간', () => {
  it('오늘부터 유효기간까지 남은 날을 센다', () => {
    expect(remainingDays(lot({ expiryDate: '2026-09-11' }), TODAY)).toBe(10);
  });

  /* 유효기간이 비어도 되게 돼 있다. 없는 것을 넉넉한 것으로 두지 않는다. */
  it('유효기간이 없으면 셀 수 없다', () => {
    expect(remainingDays(lot({ expiryDate: null }), TODAY)).toBeNull();
    expect(remainingDays(lot({ expiryDate: '알 수 없음' }), TODAY)).toBeNull();
  });
});

describe('선출 정책', () => {
  it('정책마다 줄 세우는 축이 다르다', () => {
    expect(sortFieldOf(FEFO)).toBe('expiryDate');
    expect(sortFieldOf(FIFO)).toBe('manufacturedAt');
  });

  /* 값 목록이 확정 전이다. 모르는 값을 아는 것처럼 다루면 엉뚱한 순서를 권장으로 낸다. */
  it('모르는 정책이면 세울 축이 없다', () => {
    expect(sortFieldOf('LIFO')).toBeNull();
  });
});

describe('권장 순서', () => {
  const early = candidate({ lot: lot({ lotId: 1, expiryDate: '2027-02-01' }) });
  const late = candidate({ lot: lot({ lotId: 2, expiryDate: '2027-02-06' }) });
  const undated = candidate({ lot: lot({ lotId: 3, expiryDate: null }) });

  it('유효기간이 이른 것부터 세운다', () => {
    const ranked = rankCandidates([late, early], FEFO);

    expect(ranked.ordered.map((each) => each.lot.lotId)).toEqual([1, 2]);
  });

  /* 섞으면 잘못된 순서를 권장으로 내놓고, 빼면 재고가 사라진 것처럼 보인다. */
  it('축의 값이 없는 것은 섞지 않고 따로 둔다', () => {
    const ranked = rankCandidates([late, undated, early], FEFO);

    expect(ranked.ordered.map((each) => each.lot.lotId)).toEqual([1, 2]);
    expect(ranked.unordered.map((each) => each.lot.lotId)).toEqual([3]);
  });

  it('FIFO는 제조 시각으로 세운다', () => {
    const older = candidate({ lot: lot({ lotId: 4, manufacturedAt: '2026-01-01T00:00:00+09:00' }) });
    const newer = candidate({ lot: lot({ lotId: 5, manufacturedAt: '2026-06-01T00:00:00+09:00' }) });
    const ranked = rankCandidates([newer, older], FIFO);

    expect(ranked.ordered.map((each) => each.lot.lotId)).toEqual([4, 5]);
  });

  it('모르는 정책이면 아무 줄도 세우지 않는다', () => {
    const ranked = rankCandidates([late, early], 'LIFO');

    expect(ranked.ordered).toEqual([]);
    expect(ranked.unordered).toHaveLength(2);
  });

  it('권장 1순위는 세운 것의 맨 앞이다', () => {
    const ranked = rankCandidates([late, early], FEFO);

    expect(isRecommended(ranked, 1)).toBe(true);
    expect(isRecommended(ranked, 2)).toBe(false);
  });
});

describe('집을 수 없는 사유', () => {
  it('보류가 걸린 LOT은 집을 수 없다', () => {
    expect(lotProblem(candidate({ held: true }), line(), TODAY)).toBe('held');
  });

  it('가용이 없으면 집을 수 없다', () => {
    expect(lotProblem(candidate({ availableQty: 0 }), line(), TODAY)).toBe('noAvailable');
  });

  it('다른 품목의 LOT은 집을 수 없다', () => {
    expect(lotProblem(candidate({ lot: lot({ itemId: 99 }) }), line(), TODAY)).toBe('otherItem');
  });

  it('잔여 유효기간이 하한에 못 미치면 집을 수 없다', () => {
    const short = candidate({ lot: lot({ expiryDate: '2026-12-02' }) });

    expect(lotProblem(short, line({ minimumRemainingShelfLifeDays: 180 }), TODAY)).toBe(
      'shelfLifeShort',
    );
    expect(lotProblem(candidate(), line({ minimumRemainingShelfLifeDays: 180 }), TODAY)).toBeNull();
  });

  /* 셀 수 없는 것을 통과로도 차단으로도 두지 않는다. 판정의 정본은 서버다. */
  it('셀 수 없는 잔여 유효기간을 통과로도 차단으로도 두지 않는다', () => {
    const undated = candidate({ lot: lot({ expiryDate: null }) });
    const strict = line({ minimumRemainingShelfLifeDays: 180 });

    expect(lotProblem(undated, strict, TODAY)).toBeNull();
    expect(isShelfLifeUnknown(undated, strict, TODAY)).toBe(true);
    expect(isShelfLifeUnknown(candidate(), strict, TODAY)).toBe(false);
    expect(isShelfLifeUnknown(undated, line(), TODAY)).toBe(false);
  });

  /* 고객 LOT 요구는 자유 텍스트라 파싱하지 않는다. 사람이 읽고 고른다. */
  it('고객 LOT 요구 문장으로는 막지 않는다', () => {
    const demanding = line({ customerLotRequirement: '제조 90일 이내 · 동일 LOT 단일' });

    expect(lotProblem(candidate(), demanding, TODAY)).toBeNull();
  });
});

describe('수량', () => {
  it('적지 않았거나 숫자가 아니거나 0 이하면 쓸 수 없다', () => {
    expect(qtyProblem(candidate(), line(), '')).toBe('empty');
    expect(qtyProblem(candidate(), line(), '백')).toBe('notNumber');
    expect(qtyProblem(candidate(), line(), '0')).toBe('notPositive');
  });

  it('가용을 넘으면 쓸 수 없다', () => {
    expect(qtyProblem(candidate({ availableQty: 50 }), line(), '51')).toBe('overAvailable');
    expect(qtyProblem(candidate({ availableQty: 50 }), line(), '50')).toBeNull();
  });

  /* 배정 잔여는 배정에서 누적 피킹을 뺀 값이다. 누적은 서버가 유지한다. */
  it('배정 잔여를 넘으면 쓸 수 없다', () => {
    expect(remainingAllocated(line())).toBe(180);
    expect(qtyProblem(candidate(), line(), '181')).toBe('overAllocated');
    expect(qtyProblem(candidate(), line(), '180')).toBeNull();
  });
});

describe('확정 조건', () => {
  it('사번과 집을 수 있는 LOT과 쓸 수 있는 수량이 있어야 확정할 수 있다', () => {
    expect(canPick(candidate(), line(), '180', true, TODAY)).toBe(true);
    expect(canPick(candidate(), line(), '180', false, TODAY)).toBe(false);
    expect(canPick(candidate({ held: true }), line(), '180', true, TODAY)).toBe(false);
    expect(canPick(candidate(), line(), '181', true, TODAY)).toBe(false);
    expect(canPick(null, line(), '180', true, TODAY)).toBe(false);
  });

  /* 권장 1순위가 아니어도 물건은 맞다. 경고하되 막지 않는다. */
  it('권장 1순위가 아니어도 확정할 수 있다', () => {
    const other = candidate({ lot: lot({ lotId: 2, expiryDate: '2027-02-06' }) });
    const first = candidate({ lot: lot({ lotId: 1, expiryDate: '2027-02-01' }) });
    const ranked = rankCandidates([first, other], FEFO);

    expect(isRecommended(ranked, 2)).toBe(false);
    expect(canPick(other, line(), '180', true, TODAY)).toBe(true);
  });
});

describe('확정 본문', () => {
  it('라인의 단위를 그대로 옮긴다', () => {
    expect(toPickBody(candidate(), line(), ' 180 ')).toEqual({
      lotId: 11,
      pickedQty: 180,
      uomId: 9,
    });
  });

  /* 사유 칸을 만들지 않는다. 담을 자리가 없어 보내도 사라진다. */
  it('사유를 싣지 않는다', () => {
    expect(Object.keys(toPickBody(candidate(), line(), '180'))).toEqual([
      'lotId',
      'pickedQty',
      'uomId',
    ]);
  });
});
