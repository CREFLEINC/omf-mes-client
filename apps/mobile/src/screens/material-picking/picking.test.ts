import { describe, expect, it } from 'vitest';

import {
  SOURCE_DOCUMENT_TYPE,
  pickedQtyOf,
  queuedPicksOf,
  queuedQtyOf,
  canConfirmIssue,
  canPick,
  isOutOfSequence,
  isScannedLotOf,
  lineProblemOf,
  qtyProblemOf,
  remainingQtyOf,
  toIssueDraft,
  toPickDraft,
  type PickingLine,
  type PickingOrder,
} from './picking';

const LOT_NO = '0001234500000012002607310001230007';

const line = (overrides: Partial<PickingLine> = {}): PickingLine =>
  ({
    pickingLineId: 41,
    pickingOrderId: 7,
    lineNo: 1,
    itemId: 31,
    lotId: 4,
    locationId: 21,
    plannedQty: 200,
    pickedQty: 0,
    uomId: 9,
    statusCode: 'ASSIGNED',
    held: false,
    itemCode: 'ABC-123',
    itemName: '하우징 커버 A',
    lotNo: LOT_NO,
    locationCode: 'A-01-03',
    pickSequenceRank: 1,
    ...overrides,
  }) as PickingLine;

const order = (): PickingOrder =>
  ({
    pickingOrderId: 7,
    pickingOrderNo: 'PK-2026-000077',
    pickingTypeCode: 'PRODUCTION',
    sourceDocumentTypeCode: 'MATERIAL_ISSUE_REQUEST',
    sourceDocumentId: 3,
    warehouseId: 11,
    statusCode: 'ASSIGNED',
  }) as PickingOrder;

describe('집을 수 있는 라인인가', () => {
  it('아직 안 집었으면 집을 수 있다', () => {
    expect(lineProblemOf(line())).toBeNull();
  });

  /* 보류는 서버가 표시해 내려준다. 화면이 따로 재면 오프라인에서 판단이 갈린다. */
  it('서버가 보류로 표시했으면 막는다', () => {
    expect(lineProblemOf(line({ held: true }))).toBe('held');
  });

  it('계획만큼 다 집었으면 더 집지 않는다', () => {
    expect(lineProblemOf(line({ pickedQty: 200 }))).toBe('done');
  });

  it('남은 요청은 계획에서 집은 만큼을 뺀 것이다', () => {
    expect(remainingQtyOf(line({ pickedQty: 80 }))).toBe(120);
  });
});

describe('스캔한 LOT', () => {
  /* 라인이 가리키는 번호를 응답이 함께 준다. 되짚어 부르지 않는다. */
  it('라인의 LOT 과 같아야 한다', () => {
    expect(isScannedLotOf(line(), LOT_NO)).toBe(true);
    expect(isScannedLotOf(line(), '0001234500000012002607310001230008')).toBe(false);
  });
});

describe('선출 순서', () => {
  /* 서버가 매긴 순위다. 화면이 다시 계산하지 않는다. */
  it('같은 품목에 앞선 순위가 남아 있으면 어긋난 것이다', () => {
    const second = line({ pickingLineId: 42, pickSequenceRank: 2 });
    const first = line({ pickingLineId: 41, pickSequenceRank: 1 });

    expect(isOutOfSequence(second, [first, second])).toBe(true);
    expect(isOutOfSequence(first, [first, second])).toBe(false);
  });

  it('앞선 것을 이미 집었으면 어긋나지 않는다', () => {
    const second = line({ pickingLineId: 42, pickSequenceRank: 2 });
    const first = line({ pickingLineId: 41, pickSequenceRank: 1, pickedQty: 200 });

    expect(isOutOfSequence(second, [first, second])).toBe(false);
  });

  /* 정렬 근거가 없으면 비어 온다 — 1순위가 아니다. */
  it('순위가 없으면 판정하지 않는다', () => {
    expect(isOutOfSequence(line({ pickSequenceRank: null }), [line()])).toBe(false);
  });
});

describe('출고 수량', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf('', line())).toBe('notNumber');
    expect(qtyProblemOf('스물', line())).toBe('notNumber');
  });

  it('0 이하를 막는다', () => {
    expect(qtyProblemOf('0', line())).toBe('notPositive');
  });

  it('남은 요청을 넘지 못한다', () => {
    expect(qtyProblemOf('200', line())).toBeNull();
    expect(qtyProblemOf('201', line())).toBe('overPlanned');
  });

  it('이미 집은 만큼은 남은 요청에서 빠진다', () => {
    const half = line({ pickedQty: 150 });

    expect(qtyProblemOf('50', half)).toBeNull();
    expect(qtyProblemOf('51', half)).toBe('overPlanned');
  });
});

describe('피킹 가능 여부', () => {
  it('사번이 없으면 집을 수 없다', () => {
    expect(canPick(line(), LOT_NO, '100', false)).toBe(false);
  });

  it('스캔 전에는 집을 수 없다', () => {
    expect(canPick(line(), null, '100', true)).toBe(false);
  });

  it('보류 라인은 집을 수 없다', () => {
    expect(canPick(line({ held: true }), LOT_NO, '100', true)).toBe(false);
  });

  /* 계획과 다른 LOT 을 집으면 서버도 막는다. 눌러 보고 알게 두지 않는다. */
  it('다른 LOT 을 스캔하면 집을 수 없다', () => {
    expect(canPick(line(), '0001234500000012002607310001230009', '100', true)).toBe(false);
  });

  it('다 갖추면 집는다', () => {
    expect(canPick(line(), LOT_NO, '200', true)).toBe(true);
  });
});

describe('출고 확정 가능 여부', () => {
  /* 모자라면 부분 출고로 두고 부족분을 남긴다. */
  it('한 건이라도 집었으면 확정한다', () => {
    expect(canConfirmIssue([line({ pickedQty: 50 }), line({ pickingLineId: 42 })], true)).toBe(true);
  });

  it('아무것도 안 집었으면 확정할 수 없다', () => {
    expect(canConfirmIssue([line(), line({ pickingLineId: 42 })], true)).toBe(false);
  });

  it('사번이 없으면 확정할 수 없다', () => {
    expect(canConfirmIssue([line({ pickedQty: 50 })], false)).toBe(false);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-02T10:00:00+09:00');

  it('피킹은 그 라인을 가리키고 LOT 을 함께 싣는다', () => {
    const draft = toPickDraft(order(), line(), '120', 'batch-1', now, '100027');

    expect(draft.path).toBe('/logistics/picking-orders/7/lines/41:pick');
    expect(draft.body).toEqual({
      pickedQty: 120,
      lotId: 4,
      businessDate: '2026-09-02',
      occurredAt: now.toISOString(),
    });
  });

  /* 집은 만큼만 나간다. 안 집은 라인은 부족분으로 남는다. */
  it('출고에는 집은 라인만 싣는다', () => {
    const picked = line({ pickedQty: 120 });
    const untouched = line({ pickingLineId: 42, pickedQty: 0 });
    const draft = toIssueDraft(order(), [picked, untouched], [], 'PRODUCTION', 'batch-1', now, '100027');
    const body = draft.body as { lines: { pickingLineId: number; issueQty: number }[] };

    expect(body.lines).toEqual([
      { pickingLineId: 41, itemId: 31, lotId: 4, issueQty: 120, uomId: 9, sourceLocationId: 21 },
    ]);
  });

  /* 둘로 나누면 오프라인 큐에 중간 상태가 남는다. */
  it('등록과 전기를 한 요청으로 보낸다', () => {
    const draft = toIssueDraft(order(), [line({ pickedQty: 1 })], [], 'PRODUCTION', 'b', now, '100027');
    const body = draft.body as { postImmediately: boolean };

    expect(body.postImmediately).toBe(true);
  });

  it('원천 문서로 피킹 지시를 가리킨다', () => {
    const draft = toIssueDraft(order(), [line({ pickedQty: 1 })], [], 'PRODUCTION', 'b', now, '100027');
    const body = draft.body as { sourceDocumentTypeCode: string; sourceDocumentId: number };

    expect(body.sourceDocumentTypeCode).toBe(SOURCE_DOCUMENT_TYPE);
    expect(body.sourceDocumentId).toBe(7);
  });

  /* 그 위치를 받을 경로가 이 화면에 없다. 지어낸 값을 실으면 엉뚱한 자리로 기록된다. */
  it('도착지를 비운다', () => {
    const draft = toIssueDraft(order(), [line({ pickedQty: 1 })], [], 'PRODUCTION', 'b', now, '100027');

    expect(draft.body).not.toHaveProperty('destinationId');
  });
});

/*
 * 큐에 담긴 건은 서버 응답에 없다. 그 만큼을 셈에 넣지 않으면 화면이 안 집은 것으로 보여
 * 같은 라인을 다시 집게 되고, 큐에 두 건이 쌓여 둘 다 나간다 - 되돌릴 수 없는 재고 차감이다.
 */
describe('담긴 피킹', () => {
  const entry = (pickingOrderId: number, pickingLineId: number, pickedQty: number) => ({
    path: `/logistics/picking-orders/${String(pickingOrderId)}/lines/${String(pickingLineId)}:pick`,
    body: { pickedQty },
  });

  it('이 지시의 것만 골라 낸다', () => {
    const picks = queuedPicksOf([entry(7, 41, 50), entry(9, 99, 30)], 7);

    expect(picks).toEqual([{ pickingLineId: 41, pickedQty: 50 }]);
  });

  it('같은 라인에 여러 번 담겼으면 더한다', () => {
    expect(queuedQtyOf(line(), queuedPicksOf([entry(7, 41, 50), entry(7, 41, 30)], 7))).toBe(80);
  });

  it('피킹이 아닌 큐 항목은 세지 않는다', () => {
    expect(queuedPicksOf([{ path: '/logistics/goods-issues', body: {} }], 7)).toEqual([]);
  });

  it('서버가 아는 것과 담아 둔 것을 합친다', () => {
    const picks = queuedPicksOf([entry(7, 41, 50)], 7);

    expect(pickedQtyOf(line({ pickedQty: 30 }), picks)).toBe(80);
    expect(remainingQtyOf(line({ pickedQty: 30 }), picks)).toBe(120);
  });

  it('담아 둔 것까지 계획을 채웠으면 더 집지 않는다', () => {
    const picks = queuedPicksOf([entry(7, 41, 200)], 7);

    expect(lineProblemOf(line(), picks)).toBe('done');
    expect(canPick(line(), LOT_NO, '1', true, picks)).toBe(false);
  });

  /* 서버가 아는 것만 세면 오프라인에서 확정이 영영 열리지 않는다. */
  it('담아 둔 것만 있어도 출고를 확정할 수 있다', () => {
    const picks = queuedPicksOf([entry(7, 41, 50)], 7);

    expect(canConfirmIssue([line()], true)).toBe(false);
    expect(canConfirmIssue([line()], true, picks)).toBe(true);
  });

  it('출고에 담아 둔 만큼을 합쳐 싣는다', () => {
    const picks = queuedPicksOf([entry(7, 41, 50)], 7);
    const draft = toIssueDraft(
      order(),
      [line({ pickedQty: 30 })],
      picks,
      'PRODUCTION',
      'b',
      new Date('2026-09-02T10:00:00+09:00'),
      '100027',
    );
    const body = draft.body as { lines: { issueQty: number }[] };

    expect(body.lines[0]?.issueQty).toBe(80);
  });
});
