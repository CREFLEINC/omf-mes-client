import { describe, expect, it } from 'vitest';

import {
  NORMAL,
  OVER,
  UNDER,
  businessDateOf,
  canSubmit,
  isExpiryBeforeManufactured,
  packageProblem,
  qtyProblem,
  queuedQtyOf,
  remainingQtyOf,
  toOutboxDraft,
  verdictOf,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type ReceiptDraft,
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
  substituteLotReasonCode: '',
  unordered: false,
  supplierId: null,
  itemId: null,
  uomId: null,
  purchaseOrder: po(),
  purchaseOrderLine: poLine(),
  deliveryNoteNo: 'DN-2026-000045',
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
    const missing = draft({ supplierLotNo: '', supplierLotMissing: true });

    expect(canSubmit(missing, true)).toBe(false);
    expect(canSubmit({ ...missing, substituteLotReasonCode: 'NO_LABEL' }, true)).toBe(true);
  });

  /* 발주 없이 진행하는 경로는 이 화면에 없다. 고르지 않으면 등록이 서지 않는다. */
  it('발주를 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ purchaseOrder: null, purchaseOrderLine: null }), true)).toBe(false);
  });

  it('발주를 골랐는데 라인을 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ purchaseOrderLine: null }), true)).toBe(false);
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
    const conflicting = draft({ supplierLotMissing: true, substituteLotReasonCode: 'NO_LABEL' });
    const body = toOutboxDraft(conflicting, 31, 9, 1, 2, NOW, '900028').body as {
      lines: Record<string, unknown>[];
    };

    expect(body.lines[0]?.supplierLotNo).toBeNull();
  });

  it('비워 둔 항목은 빈 문자가 아니라 비운 값으로 싣는다', () => {
    const bare = draft({ deliveryNoteNo: '', packageCount: '', manufacturedDate: '', expiryDate: '' });
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
});

describe('담긴 입하 셈', () => {
  const queued = (purchaseOrderLineId: number | null, receivedQty: number) => ({
    path: '/logistics/inbound-receipts',
    body: { lines: [{ purchaseOrderLineId, receivedQty }] },
  });

  it('같은 발주 라인의 담긴 수량만 더한다', () => {
    expect(queuedQtyOf([queued(41, 120), queued(99, 500), queued(41, 30)], 41)).toBe(150);
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
