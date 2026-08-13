import { describe, expect, it } from 'vitest';

import type { DisposalLineRow } from './disposal-selection';
import { goodsReceiptFixtures, receiptLineFixtures } from './fixtures';
import {
  POST_IMMEDIATELY,
  SEND_TO_ERP,
  toBusinessDate,
  toDestinationId,
  toDisposalLines,
  toGoodsIssueRequest,
  toIssuedLocal,
  toOccurredAt,
  toOffsetDateTime,
} from './issue-request';
import type { DisposalDraft } from './types';
import { EMPTY_DISPOSAL_DRAFT } from './types';

/** 값 목록이 확정됐다고 가정할 때 쓰는 합성 코드. **계약의 `@example` 값을 쓰지 않는다.** */
const FILLED_DRAFT: DisposalDraft = {
  codes: {
    issueType: 'SAMPLE_GI_TYPE_A',
    sourceDocumentType: 'SAMPLE_SRC_TYPE_A',
    destinationType: 'SAMPLE_DEST_TYPE_A',
    disposalAccount: '9561',
    reason: 'SAMPLE_GI_REASON_A',
  },
  issuedDate: '2026-08-11',
  issuedTime: '09:30',
  remarks: '합성 비고',
  reason: '합성 폐기 사유 첫 줄\n둘째 줄',
};

const row = (index: number, qtyText: string): DisposalLineRow => {
  const line = receiptLineFixtures[index];

  if (line === undefined) throw new Error('픽스처 줄이 없습니다.');

  return {
    line,
    ordinal: index + 1,
    select: { kind: 'selectable' },
    isSelected: true,
    qtyText,
    qty: qtyText === '' ? { kind: 'empty' } : { kind: 'qty', value: Number(qtyText) },
    onHand: { kind: 'known', qty: 100, uomId: line.uomId },
    error: undefined,
  };
};

const receipt = goodsReceiptFixtures[0];

if (receipt === undefined) throw new Error('픽스처 전표가 없습니다.');

const NOW = new Date('2026-08-12T14:05:09+09:00');

const build = (
  rows: DisposalLineRow[],
  draft: DisposalDraft = FILLED_DRAFT,
  destinationId = toDestinationId(draft.codes.disposalAccount),
) =>
  toGoodsIssueRequest({
    receipt,
    lines: toDisposalLines(rows),
    draft,
    destinationId,
    now: NOW,
  });

describe('POST_IMMEDIATELY', () => {
  /**
   * **이 화면에서 가장 무거운 한 줄이다**(감지기 M52).
   *
   * 참으로 새면 등록과 동시에 전기돼 **승인 없이 재고가 빠진다.** 계약의 `required`에 없고
   * 목이 생략을 201로 받으므로(실측) 기본값에 기대는 순간 서버 기본이 바뀌면 조용히 달라진다.
   */
  it('상수가 거짓이다', () => {
    expect(POST_IMMEDIATELY).toBe(false);
  });
});

describe('toDisposalLines', () => {
  it('고른 줄의 다섯 값을 그대로 옮긴다 — 적치 목적지가 출발 위치가 된다', () => {
    const [line] = toDisposalLines([row(0, '10')]);
    const source = receiptLineFixtures[0];

    expect(line).toEqual({
      itemId: source?.itemId,
      lotId: source?.lotId,
      issueQty: 10,
      uomId: source?.uomId,
      sourceLocationId: source?.destinationLocationId,
    });
  });

  /** 읽을 수 없는 수량인 줄은 옮기지 않는다 — 타입은 버튼이 막았다는 사실을 모른다. */
  it('수량을 읽을 수 없는 줄은 빠진다', () => {
    expect(toDisposalLines([row(0, ''), row(1, '5')])).toHaveLength(1);
  });

  it('입고 수량을 폐기 수량으로 쓰지 않는다', () => {
    const [line] = toDisposalLines([row(0, '3')]);

    expect(line?.issueQty).toBe(3);
    expect(line?.issueQty).not.toBe(receiptLineFixtures[0]?.receiptQty);
  });
});

describe('toDestinationId', () => {
  /**
   * **이 한 줄이 계획 §13-5의 가정이다.** 「폐기 계정」에 해당하는 필드가 계약에 없고 가장 가까운
   * 자리가 도착지 식별자다(계획 결정 8의 넷째 줄) — 답이 오면 고칠 자리가 여기 하나다.
   */
  it('고른 계정 값을 도착지 식별자로 옮긴다', () => {
    expect(toDestinationId('9561')).toBe(9561);
  });

  it.each(['', '  ', 'SAMPLE_ACCOUNT', '0', '-1', '1.5', 'Infinity'])(
    '식별자로 쓸 수 없는 값(%s)은 없음이다',
    (value) => {
      expect(toDestinationId(value)).toBeNull();
    },
  );
});

describe('toGoodsIssueRequest', () => {
  it('postImmediately를 늘 거짓으로 명시해 싣는다', () => {
    expect(build([row(0, '10')])?.postImmediately).toBe(false);
  });

  /** 초안의 어떤 값으로도 갈리지 않는다 — 조건부로 만들면 승인 없이 전기되는 길이 열린다. */
  it('초안이 달라져도 postImmediately가 갈리지 않는다', () => {
    const other = build([row(0, '10')], {
      ...FILLED_DRAFT,
      remarks: '',
      reason: '다른 사유',
      issuedTime: '23:59',
    });

    expect(other?.postImmediately).toBe(false);
  });

  /**
   * **화면이 정하는 값이 아니다.** 생성물 타입이 필수로 요구해 싣되(실측) 값은 계약 기본과
   * 같다 — 보내는 것과 생략하는 것의 서버 동작이 같아 화면이 새 결정을 하지 않는다.
   * 초안으로 갈리지 않는 것이 그 사실을 굳힌다(화면에 토글이 없다 — `disposal-form.test.tsx`).
   */
  it('sendToErp가 계약 기본과 같은 상수이고 초안으로 갈리지 않는다', () => {
    expect(SEND_TO_ERP).toBe(true);
    expect(build([row(0, '10')])?.sendToErp).toBe(SEND_TO_ERP);
    expect(build([row(0, '10')], { ...FILLED_DRAFT, remarks: '다른 값' })?.sendToErp).toBe(
      SEND_TO_ERP,
    );
  });

  /** 반품 축의 필드다 — 이 화면이 정하지 않는 값은 자리도 두지 않는다. */
  it('replacementExpected를 싣지 않는다', () => {
    expect(build([row(0, '10')])).not.toHaveProperty('replacementExpected');
  });

  it('필드마다 출처가 다르다 — 원천은 전표, 출고 일시는 입력, 발생 시각은 제출 순간이다', () => {
    const body = build([row(0, '10')]);

    expect(body?.sourceDocumentId).toBe(receipt.goodsReceiptId);
    expect(body?.sourceWarehouseId).toBe(receipt.warehouseId);
    expect(body?.issuedAt).toBe('2026-08-11T09:30:00+09:00');
    expect(body?.occurredAt).toBe(toOccurredAt(NOW));
    expect(body?.businessDate).toBe('2026-08-11');
  });

  /** 영업일은 **출고 일시의 날짜**다 — 실행 시각의 날짜를 쓰면 어제 폐기한 것이 오늘로 남는다. */
  it('영업일이 제출 순간의 날짜가 아니다', () => {
    expect(build([row(0, '10')])?.businessDate).not.toBe('2026-08-12');
  });

  it('코드 넷을 다듬어 싣는다', () => {
    const body = build([row(0, '10')], {
      ...FILLED_DRAFT,
      codes: { ...FILLED_DRAFT.codes, issueType: '  SAMPLE_GI_TYPE_A  ' },
    });

    expect(body?.issueTypeCode).toBe('SAMPLE_GI_TYPE_A');
    expect(body?.sourceDocumentTypeCode).toBe('SAMPLE_SRC_TYPE_A');
    expect(body?.destinationTypeCode).toBe('SAMPLE_DEST_TYPE_A');
    expect(body?.reasonCode).toBe('SAMPLE_GI_REASON_A');
  });

  it('비운 비고는 키 자체를 싣지 않는다', () => {
    expect(build([row(0, '10')], { ...FILLED_DRAFT, remarks: '   ' })).not.toHaveProperty(
      'remarks',
    );
  });

  it('고른 줄이 전부 실린다', () => {
    expect(build([row(0, '10'), row(2, '2')])?.lines).toHaveLength(2);
  });

  /** 목이 빈 배열을 201로 받는다(실측) — **막는 곳이 화면뿐**이라 이 자리가 마지막 겹이다. */
  it('보낼 줄이 없으면 본문을 만들지 않는다', () => {
    expect(build([])).toBeNull();
    expect(build([row(0, '')])).toBeNull();
  });

  /** 목이 사유 코드 생략을 201로 받는다(실측) — 계약 설명이 「기타 출고에서는 필수」다. */
  it('사유 코드가 비면 본문을 만들지 않는다', () => {
    const blank = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, reason: '   ' } };

    expect(build([row(0, '10')], blank)).toBeNull();
  });

  it.each(['issueType', 'sourceDocumentType', 'destinationType'] as const)(
    '%s가 비면 본문을 만들지 않는다',
    (key) => {
      const blank = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, [key]: '' } };

      expect(build([row(0, '10')], blank)).toBeNull();
    },
  );

  /** 폐기 계정이 확정되기 전에는 도착지 식별자를 만들 수 없다 — 그 상태로는 보내지 않는다. */
  it('도착지 식별자가 없으면 본문을 만들지 않는다', () => {
    expect(build([row(0, '10')], EMPTY_DISPOSAL_DRAFT, null)).toBeNull();
    expect(build([row(0, '10')], FILLED_DRAFT, null)).toBeNull();
  });

  it('출고 일시가 비면 본문을 만들지 않는다', () => {
    expect(build([row(0, '10')], { ...FILLED_DRAFT, issuedDate: '' })).toBeNull();
    expect(build([row(0, '10')], { ...FILLED_DRAFT, issuedTime: '' })).toBeNull();
  });

  /** 상신 사유는 **둘째 요청**의 값이다 — 전표 본문에 섞이면 전표에 남지 않을 글이 남는다. */
  it('상신 사유를 전표 본문에 싣지 않는다', () => {
    expect(JSON.stringify(build([row(0, '10')]))).not.toContain('합성 폐기 사유 첫 줄');
  });
});

describe('시각 파생', () => {
  it('날짜 칸과 시각 칸을 한 값으로 잇는다', () => {
    expect(toIssuedLocal({ issuedDate: '2026-08-11', issuedTime: '09:30' })).toBe(
      '2026-08-11T09:30',
    );
  });

  it('초와 시간대 차이를 붙인다', () => {
    expect(toOffsetDateTime('2026-08-11T09:30', NOW)).toMatch(
      /^2026-08-11T09:30:00[+-]\d{2}:\d{2}$/,
    );
  });

  it('발생 시각은 제출 순간이고 초와 시간대 차이를 갖춘다', () => {
    expect(toOccurredAt(NOW)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it('영업일은 출고 일시의 날짜 조각이다', () => {
    expect(toBusinessDate('2026-08-11T09:30')).toBe('2026-08-11');
  });
});
