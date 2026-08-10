import { describe, expect, it } from 'vitest';

import { inboundReceipt, inboundReceiptLine } from './fixtures';
import {
  toBusinessDate,
  toGoodsReceiptRequest,
  toOffsetDateTime,
  toReceiptLines,
  type GoodsReceiptInput,
} from './gr-request';
import type { ReceiptDraft } from './types';

/** 제출 순간. **인자로 넘긴다** — 함수 안에서 시각을 읽으면 고정 시각으로 검사할 수 없다. */
const NOW = new Date('2026-08-11T14:30:00+09:00');

const DRAFT: ReceiptDraft = {
  warehouse: '9701',
  location: '9802',
  codes: {
    receiptType: 'SAMPLE_RECEIPT_TYPE_A',
    sourceDocumentType: 'SAMPLE_SOURCE_TYPE_A',
    qualityStatus: 'SAMPLE_QUALITY_A',
    inventoryStatus: 'SAMPLE_INVENTORY_A',
    reason: '',
  },
  receiptDatetime: '2026-08-06T09:12',
  remarks: '',
};

const input = (overrides: Partial<GoodsReceiptInput> = {}): GoodsReceiptInput => ({
  inboundReceipt: inboundReceipt(),
  lines: toReceiptLines([inboundReceiptLine()]),
  draft: DRAFT,
  now: NOW,
  ...overrides,
});

describe('toReceiptLines — 입하 라인을 요청 라인으로 옮긴다', () => {
  /* **M29** — 수량·품목·단위·LOT을 화면이 고치지 않는다. 전량 입고라 입력칸도 없다. */
  it('입하 라인의 값을 그대로 옮긴다', () => {
    expect(toReceiptLines([inboundReceiptLine()])).toEqual([
      {
        inboundReceiptLineId: 9401,
        itemId: 9301,
        lotId: 9601,
        receiptQty: 100,
        uomId: 9501,
      },
    ]);
  });

  /*
   * **`inboundReceiptLineId`를 싣는다.** 계약상 선택이지만 만들어진 입고 라인을 원천 입하
   * 라인에 잇는 **유일한 값**이라 빼면 추적이 끊긴다.
   */
  it('원천 입하 라인 번호를 뺀 채로 만들지 않는다', () => {
    expect(toReceiptLines([inboundReceiptLine()])[0]?.inboundReceiptLineId).toBe(9401);
  });

  /*
   * 계약이 입고 라인의 `lotId`를 **필수**로 두는데 입하 라인의 `lotId`는 nullable이다.
   * 값이 없으면 보낼 것이 없다 — 고르지 못하게 막는 것은 `line-select.ts`이고,
   * 여기서는 타입을 좁히려고 값으로 한 번 더 본다.
   */
  it('자재 LOT이 없는 줄은 옮기지 않는다', () => {
    expect(toReceiptLines([inboundReceiptLine({ lotId: null })])).toEqual([]);
  });

  /* 여러 줄을 그대로 다룬다 — 계약이 라인마다 위치를 받으므로 나중에 늘어도 구조가 안 흔들린다. */
  it('여러 줄을 차례대로 옮긴다', () => {
    const lines = toReceiptLines([
      inboundReceiptLine(),
      inboundReceiptLine({ inboundReceiptLineId: 9402, lotId: 9602, receivedQty: 12.5 }),
    ]);

    expect(lines.map((line) => line.receiptQty)).toEqual([100, 12.5]);
  });
});

describe('toOffsetDateTime — 입력칸 값에 offset을 붙인다', () => {
  /*
   * **M46** — `datetime-local`은 분까지만 주고 offset이 없다. 그대로 보내면 같은 글자가
   * 지역마다 다른 순간을 가리킨다.
   */
  it('초와 실행 환경 offset을 붙인다', () => {
    const value = toOffsetDateTime('2026-08-06T09:12', NOW);

    expect(value.startsWith('2026-08-06T09:12:00')).toBe(true);
    expect(/[+-]\d{2}:\d{2}$/.test(value)).toBe(true);
  });

  it('초가 이미 있으면 덧붙이지 않는다', () => {
    expect(toOffsetDateTime('2026-08-06T09:12:30', NOW).startsWith('2026-08-06T09:12:30')).toBe(
      true,
    );
  });
});

describe('toBusinessDate — 영업일은 입고 일시의 날짜다', () => {
  /*
   * **M44** — 실행 시각의 날짜를 쓰면 어제 받은 자재를 오늘 등록할 때 영업일이 어긋난다.
   * 산출 규칙(야간조 경계 등)이 어디에도 정의돼 있지 않아 별도 입력칸을 두지 않았다.
   */
  it('입고 일시의 날짜를 쓴다', () => {
    expect(toBusinessDate('2026-08-06T09:12')).toBe('2026-08-06');
  });

  it('자정 직전과 직후가 서로 다른 날이다', () => {
    expect(toBusinessDate('2026-08-06T23:59')).toBe('2026-08-06');
    expect(toBusinessDate('2026-08-07T00:00')).toBe('2026-08-07');
  });
});

describe('toGoodsReceiptRequest — 되돌릴 수 없는 쓰기의 본문', () => {
  /*
   * **M28** — 창고에도 `plantId`가 있어 두 값이 다를 수 있다. 창고에서 끌어오면
   * 사용자가 모르는 채 공장이 바뀐다 — 원천 문서가 이 입고의 근거다(계획 결정 8).
   */
  it('공장은 고른 입하 전표의 값이다', () => {
    expect(toGoodsReceiptRequest(input()).plantId).toBe(9201);
  });

  it('원천은 고른 입하 전표를 가리킨다', () => {
    expect(toGoodsReceiptRequest(input()).sourceDocumentId).toBe(9001);
  });

  it('창고와 위치를 번호로 옮긴다', () => {
    const body = toGoodsReceiptRequest(input());

    expect(body.warehouseId).toBe(9701);
    expect(body.lines[0]?.destinationLocationId).toBe(9802);
  });

  it('머리 코드와 라인 코드가 제자리에 실린다', () => {
    const body = toGoodsReceiptRequest(input());

    expect(body.receiptTypeCode).toBe('SAMPLE_RECEIPT_TYPE_A');
    expect(body.sourceDocumentTypeCode).toBe('SAMPLE_SOURCE_TYPE_A');
    expect(body.lines[0]?.qualityStatusCode).toBe('SAMPLE_QUALITY_A');
    expect(body.lines[0]?.inventoryStatusCode).toBe('SAMPLE_INVENTORY_A');
  });

  it('영업일이 입고 일시에서 나온다', () => {
    expect(toGoodsReceiptRequest(input()).businessDate).toBe('2026-08-06');
  });

  /*
   * **M45** — `GoodsReceiptCreate`에는 `occurredAt`이 **없다**(실측 — `InboundReceiptCreate`에는
   * 있다). 계약에 없는 키를 보내지 않는다.
   */
  it('발생 시각을 싣지 않는다', () => {
    expect(Object.keys(toGoodsReceiptRequest(input()))).not.toContain('occurredAt');
    /* 짝 방향 — 영업일은 실제로 실린다. */
    expect(Object.keys(toGoodsReceiptRequest(input()))).toContain('businessDate');
  });

  it('입고 일시에 offset이 붙는다', () => {
    expect(/[+-]\d{2}:\d{2}$/.test(toGoodsReceiptRequest(input()).receiptDatetime)).toBe(true);
  });

  /* 빈 칸은 키 자체를 싣지 않는다 — 빈 문자열은 「빈 값을 넣었다」로 전표에 남는다. */
  it('사유와 비고가 비면 키를 싣지 않는다', () => {
    const keys = Object.keys(toGoodsReceiptRequest(input()));

    expect(keys).not.toContain('reasonCode');
    expect(keys).not.toContain('remarks');
  });

  it('사유와 비고를 넣으면 다듬어 싣는다', () => {
    const body = toGoodsReceiptRequest(
      input({
        draft: {
          ...DRAFT,
          codes: { ...DRAFT.codes, reason: 'SAMPLE_REASON_A' },
          remarks: '  합성 비고  ',
        },
      }),
    );

    expect(body.reasonCode).toBe('SAMPLE_REASON_A');
    expect(body.remarks).toBe('합성 비고');
  });

  it('코드의 앞뒤 공백을 다듬어 싣는다', () => {
    const body = toGoodsReceiptRequest(
      input({
        draft: { ...DRAFT, codes: { ...DRAFT.codes, receiptType: '  SAMPLE_RECEIPT_TYPE_A  ' } },
      }),
    );

    expect(body.receiptTypeCode).toBe('SAMPLE_RECEIPT_TYPE_A');
  });

  /* 라인은 배열로 만든다(계획 결정 3) — 이번엔 길이 1이지만 부품도 요청도 배열을 다룬다. */
  it('라인을 배열로 만든다', () => {
    const body = toGoodsReceiptRequest(
      input({
        lines: toReceiptLines([
          inboundReceiptLine(),
          inboundReceiptLine({ inboundReceiptLineId: 9402, lotId: 9602 }),
        ]),
      }),
    );

    expect(body.lines).toHaveLength(2);
    expect(body.lines.every((line) => line.destinationLocationId === 9802)).toBe(true);
  });
});
