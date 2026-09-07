import { describe, expect, it } from 'vitest';

import {
  canConfirm,
  needsReason,
  qtyProblemOf,
  queuedReceiptsFor,
  toReceiptDraft,
  varianceOf,
  type DraftLine,
  type GoodsIssue,
} from './receipt';

const issue = (goodsIssueId = 500): GoodsIssue => ({
  goodsIssueId,
  goodsIssueNo: `GI-2026-000${String(goodsIssueId)}`,
  issueTypeCode: 'PRODUCTION',
  sourceDocumentTypeCode: 'PICKING_ORDER',
  sourceDocumentId: 300,
  sourceWarehouseId: 5,
  issuedAt: '2026-09-07T09:00:00+09:00',
  statusCode: 'POSTED',
});

const line = (overrides: Partial<DraftLine> = {}): DraftLine => ({
  goodsIssueLineId: 1,
  itemId: 100,
  lotId: 1000,
  issuedQty: 500,
  uomId: 9,
  receivedQty: '',
  reasonCode: '',
  ...overrides,
});

describe('수령 수량 검사', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf(line({ receivedQty: '열' }))).toBe('notNumber');
  });

  it('음수를 막는다', () => {
    expect(qtyProblemOf(line({ receivedQty: '-1' }))).toBe('negative');
  });

  /* 하나도 못 받은 라인이 있을 수 있고 그것도 수령 결과다. */
  it('0 은 막지 않는다', () => {
    expect(qtyProblemOf(line({ receivedQty: '0' }))).toBeNull();
  });

  /* 데이터베이스가 초과를 막는다. 화면이 통과시키면 확정이 서버에서 되돌아온다. */
  it('출고한 것보다 많이 받을 수 없다', () => {
    expect(qtyProblemOf(line({ receivedQty: '500' }))).toBeNull();
    expect(qtyProblemOf(line({ receivedQty: '501' }))).toBe('overIssued');
  });

  it('안 적은 라인은 문제로 보지 않는다', () => {
    expect(qtyProblemOf(line())).toBeNull();
  });
});

describe('차이와 사유', () => {
  it('모자란 만큼을 차이로 낸다', () => {
    expect(varianceOf(line({ receivedQty: '480' }))).toBe(20);
  });

  it('전량 받으면 차이가 없다', () => {
    expect(varianceOf(line({ receivedQty: '500' }))).toBe(0);
  });

  it('차이가 있는데 사유가 비면 물어야 한다', () => {
    expect(needsReason(line({ receivedQty: '480' }))).toBe(true);
  });

  it('사유를 고르면 더 묻지 않는다', () => {
    expect(needsReason(line({ receivedQty: '480', reasonCode: 'DAMAGED' }))).toBe(false);
  });

  it('차이가 없으면 사유를 묻지 않는다', () => {
    expect(needsReason(line({ receivedQty: '500' }))).toBe(false);
  });

  /* 안 적은 라인은 이번 수령에 없다. 없는 것에 사유를 물으면 확정이 영영 막힌다. */
  it('안 적은 라인에는 사유를 묻지 않는다', () => {
    expect(needsReason(line())).toBe(false);
  });
});

describe('확정 가능 여부', () => {
  const lines = [line({ receivedQty: '500' })];

  it('사번이 없으면 확정할 수 없다', () => {
    expect(canConfirm(issue(), lines, false, false, 0)).toBe(false);
  });

  it('출고 전표가 없으면 확정할 수 없다', () => {
    expect(canConfirm(null, lines, true, false, 0)).toBe(false);
  });

  it('한 라인도 적지 않으면 확정할 수 없다', () => {
    expect(canConfirm(issue(), [line()], true, false, 0)).toBe(false);
  });

  it('수량이 잘못된 라인이 있으면 확정할 수 없다', () => {
    expect(canConfirm(issue(), [line({ receivedQty: '501' })], true, false, 0)).toBe(false);
  });

  it('사유 없는 차이가 있으면 확정할 수 없다', () => {
    expect(canConfirm(issue(), [line({ receivedQty: '480' })], true, false, 0)).toBe(false);
  });

  it('사유를 고르면 모자라도 확정한다', () => {
    const short = [line({ receivedQty: '480', reasonCode: 'DAMAGED' })];

    expect(canConfirm(issue(), short, true, false, 0)).toBe(true);
  });

  it('전량 받으면 확정한다', () => {
    expect(canConfirm(issue(), lines, true, false, 0)).toBe(true);
  });
});

/*
 * 수령 전표는 출고 전표 하나에 하나다. 단말이 기억하는 것으로는 재시작을 넘지 못해, 앱을 다시
 * 켜거나 다른 단말로 같은 전표를 열면 같은 물건을 두 번 받은 것이 된다.
 */
describe('이미 받은 출고 전표', () => {
  const lines = [line({ receivedQty: '500' })];

  it('서버가 이미 받았다고 하면 확정할 수 없다', () => {
    expect(canConfirm(issue(), lines, true, true, 0)).toBe(false);
  });

  /* 서버 응답에는 아직 안 간 건이 없다. 큐를 세지 않으면 오프라인에서 둘 다 통과한다. */
  it('큐에 이 전표의 입고가 담겨 있으면 확정할 수 없다', () => {
    expect(canConfirm(issue(), lines, true, false, 1)).toBe(false);
  });

  it('큐에서 이 전표의 입고만 센다', () => {
    const entries = [
      { body: { goodsIssueId: 500 } },
      { body: { goodsIssueId: 501 } },
      { body: { goodsIssueId: 500 } },
    ];

    expect(queuedReceiptsFor(entries, 500)).toBe(2);
    expect(queuedReceiptsFor(entries, 502)).toBe(0);
  });

  it('본문이 없는 건은 세지 않는다', () => {
    expect(queuedReceiptsFor([{}], 500)).toBe(0);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-07T09:12:00+09:00');

  it('적은 라인만 싣는다', () => {
    const draft = toReceiptDraft(
      issue(),
      700,
      42,
      [line({ receivedQty: '500' }), line({ goodsIssueLineId: 2, lotId: 1001 })],
      now,
      '900028',
    );
    const body = draft.body as { lines: { goodsIssueLineId: number }[] };

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.goodsIssueLineId).toBe(1);
  });

  it('작업지시와 도착 위치를 함께 싣는다', () => {
    const draft = toReceiptDraft(issue(), 700, 42, [line({ receivedQty: '500' })], now, '900028');
    const body = draft.body as { workOrderId: number; destinationLocationId: number };

    expect(body.workOrderId).toBe(700);
    expect(body.destinationLocationId).toBe(42);
  });

  /* 서버가 저장 시점에 스스로 만드는 값이라 본문에 실으면 계약이 받지 않는다. */
  it('차이 수량은 싣지 않는다', () => {
    const draft = toReceiptDraft(
      issue(),
      700,
      42,
      [line({ receivedQty: '480', reasonCode: 'DAMAGED' })],
      now,
      '900028',
    );
    const body = draft.body as { lines: Record<string, unknown>[] };

    expect(body.lines[0]).not.toHaveProperty('varianceQty');
    expect(body.lines[0]?.varianceReasonCode).toBe('DAMAGED');
  });

  it('사유가 비면 값을 비워 보낸다', () => {
    const draft = toReceiptDraft(issue(), 700, 42, [line({ receivedQty: '500' })], now, '900028');
    const body = draft.body as { lines: { varianceReasonCode: string | null }[] };

    expect(body.lines[0]?.varianceReasonCode).toBeNull();
  });

  /* 오프라인에서 늦게 닿아도 언제 한 일인지가 남아야 수불이 그날로 선다. */
  it('업무일자를 함께 싣는다', () => {
    const draft = toReceiptDraft(issue(), 700, 42, [line({ receivedQty: '500' })], now, '900028');
    const body = draft.body as { businessDate: string };

    expect(body.businessDate).toBe(now.toISOString().slice(0, 10));
  });
});
