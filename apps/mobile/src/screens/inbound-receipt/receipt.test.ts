import { describe, expect, it } from 'vitest';

import {
  businessDateOf,
  canSubmit,
  DEFAULT_SUBSTITUTE_LOT_REASON,
  defaultSubstituteLotReason,
  isExpiryBeforeManufactured,
  LINE_SCOPED_BLANK,
  NORMAL,
  openLinesFirst,
  OVER,
  packageProblem,
  qtyProblem,
  queuedQtyOf,
  recordedOf,
  recordedPartsOf,
  remainingQtyOf,
  RECEIPT_PATH,
  splitQuantitiesOf,
  SPLIT_RECEIPT_PATH,
  submitLockOf,
  toOutboxDraft,
  toSplitOutboxDraft,
  UNDER,
  verdictOf,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptDraft,
  type SubmitGate,
} from './receipt';

const SCANNED = '7770001118880002229901015554447777';

const poLine = (overrides: Partial<PurchaseOrderLine> = {}): PurchaseOrderLine =>
  ({
    purchaseOrderLineId: 41,
    purchaseOrderId: 7,
    lineNo: 1,
    itemId: 31,
    orderedQty: 500,
    uomId: 9,
    receivedQty: 0,
    toleranceOverQty: 10,
    toleranceUnderQty: 5,
    ...overrides,
  }) as PurchaseOrderLine;

const po = (): PurchaseOrder =>
  ({
    purchaseOrderId: 7,
    purchaseOrderNo: 'PO-2026-0003',
    supplierId: 2,
    businessUnitId: 1,
    plantId: 1,
    orderDate: '2026-08-20',
    statusCode: 'OPEN',
  }) as PurchaseOrder;

const draft = (overrides: Partial<ReceiptDraft> = {}): ReceiptDraft => ({
  supplierLotNo: SCANNED,
  supplierLotMissing: false,
  supplierLotLabelAttached: true,
  substituteLotReasonCode: '',
  unordered: false,
  supplierId: null,
  itemId: null,
  uomId: null,
  exceptionTypeCode: '',
  exceptionReason: '',
  purchaseOrder: po(),
  purchaseOrderLine: poLine(),
  deliveryNoteNo: 'DN-2026-000045',
  vehicleNo: '',
  receivedQty: '500',
  packageCount: '10',
  manufacturedDate: '2026-07-20',
  expiryDate: '2027-07-19',
  ...overrides,
});

describe('입하 검증 세 갈래', () => {
  /* 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. */
  it('허용치 안이면 정상이다', () => {
    expect(verdictOf(poLine(), 500)).toBe(NORMAL);
    expect(verdictOf(poLine(), 510)).toBe(NORMAL);
    expect(verdictOf(poLine(), 495)).toBe(NORMAL);
  });

  it('초과 허용치를 넘으면 초과다', () => {
    expect(verdictOf(poLine(), 511)).toBe(OVER);
  });

  it('부족 허용치를 넘어 모자라면 부족이다', () => {
    expect(verdictOf(poLine(), 494)).toBe(UNDER);
  });

  it('허용치가 0이면 예정과 같아야 정상이다', () => {
    const strict = poLine({ toleranceOverQty: 0, toleranceUnderQty: 0 });

    expect(verdictOf(strict, 500)).toBe(NORMAL);
    expect(verdictOf(strict, 501)).toBe(OVER);
    expect(verdictOf(strict, 499)).toBe(UNDER);
  });

  /*
   * 한 발주에 여러 번 도착한다. 발주 총량과 견주면 마지막 회차가 부족으로 읽히고, 누적이
   * 총량을 넘긴 것도 부족으로 읽힌다. 뒤엣것은 서버가 거부할 초과인데 화면이 입하 오류
   * 등록으로 보낸다 - 가야 할 곳은 초과 입하 분리다.
   */
  describe('여러 번 도착하는 발주', () => {
    const split = (received: number) => poLine({ orderedQty: 300, receivedQty: received });

    it('분할 납품의 마지막 회차는 정상이다', () => {
      expect(verdictOf(split(200), 100)).toBe(NORMAL);
    });

    it('누적이 발주를 넘기면 초과다', () => {
      expect(verdictOf(split(200), 150)).toBe(OVER);
    });

    it('남은 예정이 얼마 없는데 많이 오면 초과다', () => {
      expect(verdictOf(split(280), 200)).toBe(OVER);
    });

    it('마지막 회차가 남은 예정에 모자라면 부족이다', () => {
      expect(verdictOf(split(200), 90)).toBe(UNDER);
    });
  });
});

describe('수량 입력', () => {
  it('적지 않았거나 숫자가 아니거나 0 이하면 쓸 수 없다', () => {
    expect(qtyProblem('')).toBe('empty');
    expect(qtyProblem('오백')).toBe('notNumber');
    expect(qtyProblem('0')).toBe('notPositive');
    expect(qtyProblem('500')).toBeNull();
  });

  /* 포장 수는 비워도 되지만 적었다면 0보다 커야 한다. */
  it('포장 수는 비울 수 있고 적었다면 0보다 커야 한다', () => {
    expect(packageProblem('')).toBeNull();
    expect(packageProblem('  ')).toBeNull();
    expect(packageProblem('0')).toBe('notPositive');
    expect(packageProblem('10')).toBeNull();
  });
});

describe('제조일과 유효기한', () => {
  /* 둘 다 있을 때만 순서를 본다. 한쪽이 비면 견줄 것이 없다. */
  it('둘 다 있을 때만 순서를 본다', () => {
    expect(isExpiryBeforeManufactured('2026-07-20', '2026-07-19')).toBe(true);
    expect(isExpiryBeforeManufactured('2026-07-20', '2026-07-20')).toBe(false);
    expect(isExpiryBeforeManufactured('', '2026-07-19')).toBe(false);
    expect(isExpiryBeforeManufactured('2026-07-20', '')).toBe(false);
  });
});

describe('업무 기준일', () => {
  /* 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
  it('단말의 날짜를 그대로 낸다', () => {
    expect(businessDateOf(new Date(2026, 8, 1, 23, 40))).toBe('2026-09-01');
    expect(businessDateOf(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });
});

describe('등록 조건', () => {
  it('사번과 수량과 발주 라인이 있으면 등록할 수 있다', () => {
    expect(canSubmit(draft(), true)).toBe(true);
    expect(canSubmit(draft(), false)).toBe(false);
  });

  it('수량이 쓸 수 없으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ receivedQty: '0' }), true)).toBe(false);
    expect(canSubmit(draft({ packageCount: '0' }), true)).toBe(false);
  });

  it('유효기한이 제조일보다 앞서면 등록할 수 없다', () => {
    expect(canSubmit(draft({ expiryDate: '2026-07-19' }), true)).toBe(false);
  });

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  it('LOT 미부착이면 대체 사유가 있어야 등록할 수 있다', () => {
    const missing = draft({
      supplierLotNo: '',
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
    });

    expect(canSubmit(missing, true)).toBe(false);
    expect(canSubmit({ ...missing, substituteLotReasonCode: 'NO_LABEL' }, true)).toBe(true);
  });

  it('번호가 없으면 부착됨을 함께 보낼 수 없다', () => {
    expect(
      canSubmit(
        draft({
          supplierLotNo: '',
          supplierLotMissing: true,
          supplierLotLabelAttached: true,
          substituteLotReasonCode: 'NO_LABEL',
        }),
        true,
      ),
    ).toBe(false);
  });

  /* 발주 없이 진행하는 경로는 이 화면에 없다. 고르지 않으면 등록이 서지 않는다. */
  it('발주를 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ purchaseOrder: null, purchaseOrderLine: null }), true)).toBe(false);
  });

  it('발주를 골랐는데 라인을 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ purchaseOrderLine: null }), true)).toBe(false);
  });

  it('무발주 입하는 공급사·품목·단위와 예외 유형·사유를 모두 받아야 한다', () => {
    const unordered = draft({
      unordered: true,
      purchaseOrder: null,
      purchaseOrderLine: null,
      supplierId: 2,
      itemId: 31,
      uomId: 9,
    });

    expect(canSubmit(unordered, true)).toBe(false);
    expect(canSubmit({ ...unordered, exceptionTypeCode: 'URGENT_RECEIPT' }, true)).toBe(false);
    expect(
      canSubmit(
        {
          ...unordered,
          exceptionTypeCode: 'URGENT_RECEIPT',
          exceptionReason: '발주서 도착 전 긴급 입하',
        },
        true,
      ),
    ).toBe(true);
  });
});

/**
 * 잠긴 등록 단추는 «왜» 잠겼는지 말해야 한다(공유계약 G-1).
 *
 * 현장에서 「다 채웠는데 눌리지 않는다」가 나왔다(2026-09-20). 막는 조건은 여럿인데 그중
 * 공장 없음만 발주 경로에서 아무 말도 하지 않았고, 화면만 보아서는 고칠 것을 알 수 없었다.
 */
/**
 * 등록한 값을 등록 «뒤»에 확인할 수 있어야 한다(현장 요청 2026-09-21).
 *
 * 같은 자재 P/O 의 자재를 여러 번 넣을 때, 앞 자재를 무엇으로 얼마나 넣었는지 되짚을 곳이
 * 화면에 없었다. 요약은 담아 보낸 본문에서 되읽는다 - 따로 셈하면 보낸 것과 갈린다.
 */
describe('등록한 내용 요약', () => {
  const source = { itemId: 31, uomId: 9, supplierId: 2 };

  it('한 건은 보낸 수량 하나를 낸다', () => {
    const body = { lines: [{ receivedQty: 500, packageCount: 10 }] };

    expect(recordedPartsOf(RECEIPT_PATH, body)).toEqual([
      { part: null, receivedQty: 500, packageCount: 10 },
    ]);
  });

  /* 합만 보이면 어느 쪽이 얼마인지 알 수 없다. 두 몫을 갈라 낸다. */
  it('초과 분리는 정량분과 초과분을 갈라 낸다', () => {
    const body = {
      normal: { lines: [{ receivedQty: 510, packageCount: null }] },
      excess: { lines: [{ receivedQty: 40, packageCount: null }] },
    };

    expect(recordedPartsOf(SPLIT_RECEIPT_PATH, body)).toEqual([
      { part: 'normal', receivedQty: 510, packageCount: null },
      { part: 'excess', receivedQty: 40, packageCount: null },
    ]);
  });

  /* 없는 파트를 0 으로 보이면 보내지 않은 것을 보낸 것처럼 말한다. */
  it('실리지 않은 파트는 내지 않는다', () => {
    const body = { normal: { lines: [{ receivedQty: 510, packageCount: null }] } };

    expect(recordedPartsOf(SPLIT_RECEIPT_PATH, body)).toEqual([
      { part: 'normal', receivedQty: 510, packageCount: null },
    ]);
  });

  it('자재 P/O 와 라인과 LOT 을 적은 그대로 낸다', () => {
    const recorded = recordedOf(
      draft({ receivedQty: '500', manufacturedDate: '2026-07-01' }),
      source,
      RECEIPT_PATH,
      { lines: [{ receivedQty: 500, packageCount: null }] },
    );

    expect(recorded.purchaseOrderNo).toBe('PO-2026-0003');
    expect(recorded.lineNo).toBe(1);
    expect(recorded.supplierLotNo).toBe(SCANNED);
    expect(recorded.supplierLotMissing).toBe(false);
    expect(recorded.manufacturedDate).toBe('2026-07-01');
    expect(recorded.expiryDate).toBe(draft().expiryDate);
  });

  /* 번호가 없는 건은 번호 자리에 빈 글자를 두지 않는다 - 미부착이라는 사실과 사유가 남는다. */
  it('LOT 번호 없음은 사유를 함께 남긴다', () => {
    const recorded = recordedOf(
      draft({
        supplierLotNo: '',
        supplierLotMissing: true,
        supplierLotLabelAttached: false,
        substituteLotReasonCode: 'NO_LABEL',
        receivedQty: '500',
      }),
      source,
      RECEIPT_PATH,
      { lines: [{ receivedQty: 500, packageCount: null }] },
    );

    expect(recorded.supplierLotNo).toBeNull();
    expect(recorded.supplierLotMissing).toBe(true);
    expect(recorded.substituteLotReasonCode).toBe('NO_LABEL');
  });
});

/**
 * 자재를 바꾸면 그 자재에 딸린 칸을 비운다(현장 보고 2026-09-21).
 *
 * 남겨 두면 앞 자재에 적은 수량이 다음 자재에 붙은 채 판정까지 다시 선다.
 */
describe('자재가 바뀔 때 비우는 칸', () => {
  it('수량·포장 수·제조일·유효기한 넷만 비운다', () => {
    expect(LINE_SCOPED_BLANK).toEqual({
      receivedQty: '',
      packageCount: '',
      manufacturedDate: '',
      expiryDate: '',
    });
  });

  /* 공급사 LOT·대체 사유·자재 P/O 는 이 도착의 것이다. 비우면 자재마다 다시 스캔한다. */
  it('이 도착의 것은 건드리지 않는다', () => {
    const keys = Object.keys(LINE_SCOPED_BLANK);

    expect(keys).not.toContain('supplierLotNo');
    expect(keys).not.toContain('supplierLotMissing');
    expect(keys).not.toContain('substituteLotReasonCode');
    expect(keys).not.toContain('purchaseOrder');
  });
});

describe('등록 단추가 잠긴 이유', () => {
  const gate = (overrides: Partial<SubmitGate> = {}): SubmitGate => ({
    loaded: true,
    hasWorker: true,
    plantId: 1,
    label: 'ok',
    verdict: NORMAL,
    continueUnder: false,
    ...overrides,
  });

  it('채울 것이 없으면 이유가 없다', () => {
    expect(submitLockOf(draft({ receivedQty: '500' }), gate())).toBeNull();
  });

  /* 담긴 것을 읽기 전에는 초과가 초과로 보이지 않는다. 그 사이는 잠그되 잠깐이라고 말한다. */
  it('담긴 기록을 읽기 전에는 그 사실을 말한다', () => {
    expect(submitLockOf(draft({ receivedQty: '500' }), gate({ loaded: false }))).toBe('loading');
  });

  /*
   * ⭐ 공장을 모르면 발주 경로에서도 말한다. 전에는 무발주 구획에서만 띠가 섰고, 발주에서
   *    승계하지 못한 경우에는 단추가 아무 말 없이 잠겨 있었다.
   */
  it('발주 경로에서도 공장을 모르면 그 사실을 말한다', () => {
    expect(submitLockOf(draft({ receivedQty: '500' }), gate({ plantId: null }))).toBe('noPlant');
  });

  it('화면에 선 차례대로 처음 비어 있는 것을 가리킨다', () => {
    const empty = draft({ purchaseOrder: null, purchaseOrderLine: null, receivedQty: '' });

    expect(submitLockOf(empty, gate())).toBe('noOrder');
    expect(submitLockOf({ ...empty, purchaseOrder: po() }, gate())).toBe('noOrderLine');
    expect(
      submitLockOf({ ...empty, purchaseOrder: po(), purchaseOrderLine: poLine() }, gate()),
    ).toBe('qtyEmpty');
  });

  /* 사번이 없으면 무엇을 채워도 담을 수 없다. 가장 먼저 말한다. */
  it('사번이 없으면 그것부터 말한다', () => {
    expect(submitLockOf(draft({ receivedQty: '' }), gate({ hasWorker: false }))).toBe('noWorker');
  });

  it('LOT 번호 없음인데 대체 사유가 비면 그 사유를 말한다', () => {
    const missing = draft({
      supplierLotNo: '',
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      receivedQty: '500',
    });

    expect(submitLockOf(missing, gate())).toBe('noSubstituteReason');
    expect(submitLockOf({ ...missing, substituteLotReasonCode: 'NO_LABEL' }, gate())).toBeNull();
  });

  /*
   * 사유는 등록 단추 바로 위에 있고 공장은 고칠 수 없는 것이다. 사유가 비었다고 먼저 말하면
   * 그것을 고른 뒤에야 고칠 수 없는 것이 나와, 두 번 헛걸음한다.
   */
  it('고칠 수 없는 공장을 대체 사유보다 먼저 말한다', () => {
    const missing = draft({
      supplierLotNo: '',
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      receivedQty: '500',
    });

    expect(submitLockOf(missing, gate({ plantId: null }))).toBe('noPlant');
  });

  it('부족 판정에 답하기 전에는 그 사실을 말한다', () => {
    const under = draft({ receivedQty: '100' });

    expect(submitLockOf(under, gate({ verdict: UNDER }))).toBe('underUnanswered');
    expect(submitLockOf(under, gate({ verdict: UNDER, continueUnder: true }))).toBeNull();
  });

  it('라벨을 확인하는 중과 라벨이 다른 것을 갈라 말한다', () => {
    const ready = draft({ receivedQty: '500' });

    expect(submitLockOf(ready, gate({ label: 'checking' }))).toBe('labelChecking');
    expect(submitLockOf(ready, gate({ label: 'mismatch' }))).toBe('labelMismatch');
  });

  it('수량이 잘못된 갈래를 갈라 말한다', () => {
    expect(submitLockOf(draft({ receivedQty: 'abc' }), gate())).toBe('qtyNotNumber');
    expect(submitLockOf(draft({ receivedQty: '0' }), gate())).toBe('qtyNotPositive');
    expect(submitLockOf(draft({ receivedQty: '500', packageCount: '0' }), gate())).toBe(
      'packageCount',
    );
    expect(
      submitLockOf(
        draft({ receivedQty: '500', manufacturedDate: '2026-07-20', expiryDate: '2026-07-19' }),
        gate(),
      ),
    ).toBe('expiryBeforeManufactured');
  });

  it('무발주는 고를 것을 차례로 가리킨다', () => {
    const unordered = draft({
      unordered: true,
      purchaseOrder: null,
      purchaseOrderLine: null,
      receivedQty: '40',
    });

    expect(submitLockOf(unordered, gate({ verdict: null }))).toBe('noSupplier');
    expect(submitLockOf({ ...unordered, supplierId: 2 }, gate({ verdict: null }))).toBe('noItem');
    expect(submitLockOf({ ...unordered, supplierId: 2, itemId: 31 }, gate({ verdict: null }))).toBe(
      'noUom',
    );
    expect(
      submitLockOf({ ...unordered, supplierId: 2, itemId: 31, uomId: 9 }, gate({ verdict: null })),
    ).toBe('noExceptionType');
    expect(
      submitLockOf(
        { ...unordered, supplierId: 2, itemId: 31, uomId: 9, exceptionTypeCode: 'URGENT_RECEIPT' },
        gate({ verdict: null }),
      ),
    ).toBe('noExceptionReason');
  });

  /* 판정과 그 이유가 갈리면 단추는 잠긴 채 화면은 고칠 것이 없다고 말한다. */
  it('잠긴 이유가 없는 것과 등록 조건이 갈리지 않는다', () => {
    const cases: ReceiptDraft[] = [
      draft({ receivedQty: '500' }),
      draft({ receivedQty: '' }),
      draft({ receivedQty: '0' }),
      draft({ purchaseOrderLine: null }),
      draft({ supplierLotNo: '', supplierLotMissing: true, supplierLotLabelAttached: false }),
    ];

    for (const each of cases) {
      expect(submitLockOf(each, gate()) === null).toBe(canSubmit(each, true));
    }
  });
});

describe('등록 본문', () => {
  const NOW = new Date(2026, 8, 1, 9, 12);

  it('헤더와 라인을 한 건에 담는다', () => {
    const body = toOutboxDraft(draft(), 31, 9, 1, 2, NOW, '900028').body as {
      supplierId: number;
      plantId: number;
      businessDate: string;
      lines: Record<string, unknown>[];
    };

    expect(body.supplierId).toBe(2);
    expect(body.plantId).toBe(1);
    expect(body.businessDate).toBe('2026-09-01');
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.purchaseOrderLineId).toBe(41);
    expect(body.lines[0]?.receivedQty).toBe(500);
    expect(body.lines[0]?.supplierLotNo).toBe(SCANNED);
    expect(body.lines[0]?.supplierLotMissing).toBe(false);
    expect(body.lines[0]?.supplierLotLabelAttached).toBe(true);
  });

  it('번호는 있으나 라벨이 미부착이면 원문과 부착 상태를 함께 보낸다', () => {
    const supplierLotNo = '납품서-LOT/A-01';
    const body = toOutboxDraft(
      draft({ supplierLotNo, supplierLotLabelAttached: false }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
    ).body as { lines: Record<string, unknown>[] };

    expect(body.lines[0]).toMatchObject({
      supplierLotNo,
      supplierLotMissing: false,
      supplierLotLabelAttached: false,
      substituteLotReasonCode: null,
    });
  });

  /* 검사 대상 여부는 서버가 라인마다 정한다. 화면이 실으면 두 곳에 규칙이 생긴다. */
  it('검사 대상 여부를 싣지 않는다', () => {
    const body = toOutboxDraft(draft(), 31, 9, 1, 2, NOW, '900028').body as {
      lines: Record<string, unknown>[];
    };

    expect(Object.keys(body.lines[0] ?? {})).not.toContain('inspectionRequired');
  });

  it('미부착이면 공급사 LOT을 비우고 사유를 싣는다', () => {
    const missing = draft({
      supplierLotNo: '',
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      substituteLotReasonCode: 'NO_LABEL',
    });
    const body = toOutboxDraft(missing, 31, 9, 1, 2, NOW, '900028').body as {
      lines: Record<string, unknown>[];
    };

    expect(body.lines[0]?.supplierLotNo).toBeNull();
    expect(body.lines[0]?.supplierLotMissing).toBe(true);
    expect(body.lines[0]?.substituteLotReasonCode).toBe('NO_LABEL');
  });

  /* 미부착이라고 말하면서 번호를 함께 실으면 서버가 어느 쪽을 믿을지 정할 수 없다. */
  it('미부착이면 번호가 남아 있어도 싣지 않는다', () => {
    const conflicting = draft({
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      substituteLotReasonCode: 'NO_LABEL',
    });
    const body = toOutboxDraft(conflicting, 31, 9, 1, 2, NOW, '900028').body as {
      lines: Record<string, unknown>[];
    };

    expect(body.lines[0]?.supplierLotNo).toBeNull();
    expect(body.lines[0]?.supplierLotLabelAttached).toBe(false);
  });

  it('비워 둔 항목은 빈 문자가 아니라 비운 값으로 싣는다', () => {
    const bare = draft({
      deliveryNoteNo: '',
      packageCount: '',
      manufacturedDate: '',
      expiryDate: '',
    });
    const body = toOutboxDraft(bare, 31, 9, 1, 2, NOW, '900028').body as {
      deliveryNoteNo: unknown;
      lines: Record<string, unknown>[];
    };

    expect(body.deliveryNoteNo).toBeNull();
    expect(body.lines[0]?.packageCount).toBeNull();
    expect(body.lines[0]?.manufacturedDate).toBeNull();
    expect(body.lines[0]?.expiryDate).toBeNull();
  });

  it('담을 때의 사번을 들고 있고 담긴 것을 확정으로 보지 않는다', () => {
    const entry = toOutboxDraft(draft(), 31, 9, 1, 2, NOW, '900028');

    expect(entry.workerNo).toBe('900028');
    expect(entry.confirmation).toBe('pending');
    expect(entry.path).toBe('/logistics/inbound-receipts');
  });

  it('무발주는 예외 유형과 사유를 함께 싣고 승인 값을 만들지 않는다', () => {
    const unordered = draft({
      unordered: true,
      purchaseOrder: null,
      purchaseOrderLine: null,
      supplierId: 2,
      itemId: 31,
      uomId: 9,
      exceptionTypeCode: 'URGENT_RECEIPT',
      exceptionReason: '발주서 도착 전 긴급 입하',
    });
    const body = toOutboxDraft(unordered, 31, 9, 1, 2, NOW, '900028').body as Record<
      string,
      unknown
    >;

    expect(body.exceptionTypeCode).toBe('URGENT_RECEIPT');
    expect(body.exceptionReason).toBe('발주서 도착 전 긴급 입하');
    expect(body).not.toHaveProperty('approvalRequestId');
  });
});

describe('라인 차례', () => {
  const line = (id: number, ordered: number, received: number) =>
    poLine({ purchaseOrderLineId: id, orderedQty: ordered, receivedQty: received });

  /*
   * 후보 목록은 발주 단위라 그 품목의 라인이 다 찬 발주도 선다. 다 받은 줄이 맨 위에 서면
   * 작업자가 그것부터 고르고 초과 판정을 받는다 - 실기기에서 그 차례로 나왔다.
   */
  it('남은 것이 있는 줄을 위로 올린다', () => {
    const lines = [line(1, 100, 100), line(2, 50, 0), line(3, 20, 20), line(4, 30, 10)];

    expect(openLinesFirst(lines, () => 0).map((each) => each.purchaseOrderLineId)).toEqual([
      2, 4, 1, 3,
    ]);
  });

  /* 같은 무리 안에서는 서버가 준 차례를 지킨다. 흔들면 고르던 자리가 매번 바뀐다. */
  it('같은 무리 안에서는 받은 차례를 지킨다', () => {
    const lines = [line(1, 50, 0), line(2, 60, 0), line(3, 70, 0)];

    expect(openLinesFirst(lines, () => 0).map((each) => each.purchaseOrderLineId)).toEqual([
      1, 2, 3,
    ]);
  });

  /* 담아 둔 것까지 빼고 센다. 카드가 보이는 수와 차례를 가르는 수가 다르면 안 된다. */
  it('담아 둔 수량으로 다 찬 줄은 아래로 내린다', () => {
    const lines = [line(1, 100, 0), line(2, 50, 0)];
    const queued = (id: number) => (id === 1 ? 100 : 0);

    expect(openLinesFirst(lines, queued).map((each) => each.purchaseOrderLineId)).toEqual([2, 1]);
  });

  /* 원본을 흔들지 않는다. 조회가 준 배열을 제자리에서 뒤집으면 캐시가 함께 바뀐다. */
  it('받은 배열을 제자리에서 바꾸지 않는다', () => {
    const lines = [line(1, 100, 100), line(2, 50, 0)];

    openLinesFirst(lines, () => 0);

    expect(lines.map((each) => each.purchaseOrderLineId)).toEqual([1, 2]);
  });
});

describe('초과 입하 분리 본문', () => {
  const NOW = new Date(2026, 8, 1, 9, 12);

  it('허용 가능한 수량과 비귀속 초과분을 가른다', () => {
    expect(splitQuantitiesOf(poLine(), 511)).toEqual({ remaining: 500, normal: 510, excess: 1 });
    expect(splitQuantitiesOf(poLine({ receivedQty: 490 }), 30)).toEqual({
      remaining: 10,
      normal: 20,
      excess: 10,
    });
  });

  /*
   * 실기기에서 나온 값이다 - 안료 7.5 에 허용 0.5, 도착 8.01 이면 초과분이
   * 0.009999999999999787 로 나왔다. 그 값은 화면에만 머물지 않고 요청 본문의 수량으로
   * 나가는데, 서버는 6자리로 반올림해 받으므로 거르지 못한다.
   */
  it('소수 수량에서 초과분이 부동소수 꼬리를 달지 않는다', () => {
    expect(
      splitQuantitiesOf(poLine({ orderedQty: 7.5, receivedQty: 0, toleranceOverQty: 0.5 }), 8.01),
    ).toEqual({ remaining: 7.5, normal: 8, excess: 0.01 });
  });

  /* 남은 예정도 뺄셈이 셋이라 같은 자리에서 샌다. */
  it('남은 예정이 소수 뺄셈에서 꼬리를 달지 않는다', () => {
    expect(remainingQtyOf(poLine({ orderedQty: 8.01, receivedQty: 8 }))).toBe(0.01);
    expect(remainingQtyOf(poLine({ orderedQty: 2.3, receivedQty: 0.1 }), 0.1)).toBe(2.1);
  });

  it('BOTH는 정량과 초과를 한 본문에 싣고 초과분의 발주 귀속을 끊는다', () => {
    const entry = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'BOTH',
      'OVER_DELIVERY',
      '허용치 초과',
    );
    const body = entry.body as {
      mode: string;
      normal: { lines: Record<string, unknown>[] };
      excess: {
        exceptionTypeCode: string;
        exceptionReason: string;
        lines: Record<string, unknown>[];
      };
    };

    expect(entry.path).toBe('/logistics/inbound-receipts:split');
    expect(entry.workerNo).toBe('900028');
    expect(body.mode).toBe('BOTH');
    expect(body.normal.lines[0]).toMatchObject({ purchaseOrderLineId: 41, receivedQty: 510 });
    expect(body.excess.lines[0]).toMatchObject({ purchaseOrderLineId: null, receivedQty: 1 });
    expect(body.excess.exceptionTypeCode).toBe('OVER_DELIVERY');
    expect(body.excess.exceptionReason).toBe('허용치 초과');
  });

  /*
   * omf-all-around#21 — 두 파트가 같은 사전부착 LOT 을 실으면 서버가 「한 요청 안에서 겹칩니다」로
   * 거부해 사전부착 라벨이면 분리 등록이 늘 400 이었다. 초과분만 미부착으로 보낸다.
   */
  it('BOTH에서 사전부착 LOT은 정량분만 부착이고 초과분은 미부착이다', () => {
    const body = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'BOTH',
      'OVER_DELIVERY',
      '허용치 초과',
    ).body as {
      normal: { lines: Record<string, unknown>[] };
      excess: { lines: Record<string, unknown>[] };
    };
    const [normalLine] = body.normal.lines;
    const [excessLine] = body.excess.lines;

    expect(normalLine?.supplierLotLabelAttached).toBe(true);
    expect(excessLine?.supplierLotLabelAttached).toBe(false);
    // 공급사 LOT 번호는 추적용으로 두 파트 모두 남고, 대체 사유가 필요 없는 상태 그대로다.
    expect(excessLine?.supplierLotNo).toBe(normalLine?.supplierLotNo);
    expect(excessLine?.supplierLotMissing).toBe(false);
    expect(excessLine?.substituteLotReasonCode).toBeNull();
  });

  it('EXCESS_ONLY도 초과분을 미부착으로 보내고, NORMAL_ONLY는 부착 그대로다', () => {
    const excessOnly = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'EXCESS_ONLY',
      'OVER_DELIVERY',
      '허용치 초과',
    ).body as { excess: { lines: Record<string, unknown>[] } };
    const normalOnly = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'NORMAL_ONLY',
      '',
      '',
    ).body as { normal: { lines: Record<string, unknown>[] } };

    expect(excessOnly.excess.lines[0]?.supplierLotLabelAttached).toBe(false);
    expect(normalOnly.normal.lines[0]?.supplierLotLabelAttached).toBe(true);
  });

  it('선택한 모드에 없는 part는 요청에 싣지 않는다', () => {
    const normalOnly = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'NORMAL_ONLY',
      '',
      '',
    ).body as Record<string, unknown>;
    const excessOnly = toSplitOutboxDraft(
      draft({ receivedQty: '511' }),
      31,
      9,
      1,
      2,
      NOW,
      '900028',
      'EXCESS_ONLY',
      'OVER_DELIVERY',
      '허용치 초과',
    ).body as Record<string, unknown>;

    expect(normalOnly).toHaveProperty('normal');
    expect(normalOnly).not.toHaveProperty('excess');
    expect(excessOnly).toHaveProperty('excess');
    expect(excessOnly).not.toHaveProperty('normal');
  });
});

describe('담긴 입하 셈', () => {
  const queued = (purchaseOrderLineId: number | null, receivedQty: number) => ({
    path: '/logistics/inbound-receipts',
    body: { lines: [{ purchaseOrderLineId, receivedQty }] },
  });

  it('같은 발주 라인의 담긴 수량만 더한다', () => {
    expect(queuedQtyOf([queued(41, 120), queued(99, 500), queued(41, 30)], 41)).toBe(150);
  });

  it('분리 요청은 원 발주에 귀속되는 정량분만 센다', () => {
    expect(
      queuedQtyOf(
        [
          {
            path: '/logistics/inbound-receipts:split',
            body: {
              mode: 'BOTH',
              normal: { lines: [{ purchaseOrderLineId: 41, receivedQty: 510 }] },
              excess: { lines: [{ purchaseOrderLineId: null, receivedQty: 1 }] },
            },
          },
        ],
        41,
      ),
    ).toBe(510);
  });

  /* 큐는 화면을 가리지 않고 한 줄로 쌓인다. 다른 화면의 기록이 입하 셈에 들어가면 안 된다. */
  it('다른 경로의 기록은 세지 않는다', () => {
    expect(
      queuedQtyOf(
        [
          {
            path: '/logistics/goods-issues',
            body: { lines: [{ purchaseOrderLineId: 41, receivedQty: 200 }] },
          },
        ],
        41,
      ),
    ).toBe(0);
  });

  /* 발주 없이 들어온 라인은 어느 발주에도 매이지 않는다. 아무 라인 셈에나 붙으면 안 된다. */
  it('발주 라인이 없는 기록은 세지 않는다', () => {
    expect(queuedQtyOf([queued(null, 300)], 41)).toBe(0);
  });

  it('담긴 만큼 남은 예정이 줄고 그만큼 초과 판정이 앞당겨진다', () => {
    const line = poLine();

    expect(remainingQtyOf(line, 500)).toBe(0);
    expect(verdictOf(line, 500, 0)).toBe(NORMAL);
    expect(verdictOf(line, 500, 500)).toBe(OVER);
  });
});

/**
 * ⭐ **사유 선택칸의 기본값은 「라벨 미부착」이다**(사용자 지시 2026-09-19 · omf-all-around#34).
 *
 * ⛔ 값을 지어내지 않는다 — 고객이 값 목록을 늘리고 줄이므로, 서버가 준 목록에 그 값이 실제로
 *    있을 때만 고른다.
 */
describe('defaultSubstituteLotReason', () => {
  const reasons = [{ code: 'NO_LABEL' }, { code: 'LABEL_DAMAGED' }, { code: 'OTHER' }];

  it('아직 고르지 않았으면 라벨 미부착을 고른다', () => {
    expect(defaultSubstituteLotReason(reasons, '')).toBe(DEFAULT_SUBSTITUTE_LOT_REASON);
  });

  /** ⛔ 사람이 고른 값을 덮으면 무엇을 보낼지가 조용히 바뀐다 — 목록은 다시 오기도 한다. */
  it('이미 고른 값은 덮지 않는다', () => {
    expect(defaultSubstituteLotReason(reasons, 'OTHER')).toBeNull();
  });

  it('목록에 없는 값을 고르지 않는다 — 고객이 뺀 자리다', () => {
    expect(defaultSubstituteLotReason([{ code: 'OTHER' }], '')).toBeNull();
    expect(defaultSubstituteLotReason([], '')).toBeNull();
  });
});
