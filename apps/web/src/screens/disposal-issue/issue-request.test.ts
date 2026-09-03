import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { DisposalLineRow } from './disposal-selection';
import { goodsReceiptFixtures, receiptLineFixtures } from './fixtures';
import {
  describeDisposalDestination,
  DISPOSAL_DESTINATION_TYPE_CODE,
  POST_IMMEDIATELY,
  readDisposalDestination,
  SEND_TO_ERP,
  toBusinessDate,
  toDisposalLines,
  toGoodsIssueRequest,
  toIssuedLocal,
  toOccurredAt,
  toOffsetDateTime,
  type DisposalDestination,
} from './issue-request';
import type { DisposalDraft } from './types';

const t = messages.disposalIssue;

/**
 * 값 목록이 확정됐다고 가정할 때 쓰는 합성 코드. **계약의 `@example` 값을 쓰지 않는다.**
 *
 * **도착지는 자체 폐기다** — 도착지를 정하지 않은 초안으로는 본문이 만들어지지 않는다
 * (변경 통지 #128 · 완료 조건 C17). 거래처 갈래는 아래 `PARTNER_DRAFT`가 짝으로 잰다.
 */
const FILLED_DRAFT: DisposalDraft = {
  codes: {
    issueType: 'SAMPLE_GI_TYPE_A',
    sourceDocumentType: 'GOODS_RECEIPT',
    reason: 'SAMPLE_GI_REASON_A',
  },
  issuedDate: '2026-08-11',
  issuedTime: '09:30',
  remarks: '합성 비고',
  isSelfDisposal: true,
  disposalPartnerId: '',
  reason: '합성 폐기 사유 첫 줄\n둘째 줄',
};

/** 폐기 업체가 가져가는 갈래. **합성 거래처 번호**를 쓴다(9000번대 규칙). */
const PARTNER_DRAFT: DisposalDraft = {
  ...FILLED_DRAFT,
  isSelfDisposal: false,
  disposalPartnerId: '9251',
};

/** 아직 아무것도 정하지 않은 갈래 — 「자체 폐기라 없다」와 갈린다. */
const UNDECIDED_DRAFT: DisposalDraft = {
  ...FILLED_DRAFT,
  isSelfDisposal: false,
  disposalPartnerId: '',
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

const build = (rows: DisposalLineRow[], draft: DisposalDraft = FILLED_DRAFT) =>
  toGoodsIssueRequest({
    receipt,
    lines: toDisposalLines(rows),
    draft,
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

  /**
   * **자체 폐기면 도착지 짝을 통째로 싣지 않는다**(완료 조건 C11·C17 · 변경 통지 #124·#128).
   *
   * 도착지 유형만 남기면 **한쪽만 실린 본문**이 만들어지는데 그것이 정확히 서버 400의
   * 조건이다 — 짝은 함께 있거나 함께 없다. 자체 폐기는 계약이 말하는 「둘 다 보내지 않는다」
   * 형태이며, **`null`을 싣는 것도 아니다**(이 슬라이스의 규율은 「비운 칸은 키를 싣지 않는다」).
   *
   * **키 존재 여부로 잰다.** 값이 `null`인 것과 키가 없는 것은 서버에게 다른 말이다 —
   * `toBeUndefined()`로 재면 `destinationId: undefined`가 실린 본문도 통과한다.
   */
  it.each(['destinationTypeCode', 'destinationId'])('자체 폐기면 본문에 %s 키가 없다', (key) => {
    const body = build([row(0, '10')]);

    /* 짝 양성 — 본문이 실제로 만들어졌다(널이라 통과한 것이 아니다). */
    expect(body).not.toBeNull();
    expect(body).not.toHaveProperty(key);
    expect(Object.keys(body ?? {})).not.toContain(key);
  });

  /**
   * **거래처를 고르면 둘이 함께 실린다**(완료 조건 C17 · 통지 #128 §1의 표 그대로).
   *
   * 위 시험의 짝 방향이다 — 한쪽만 재면 「늘 싣지 않는다」로 굳어도 아무도 울지 않는다.
   */
  it('폐기 거래처를 고르면 도착지 두 키가 함께 실린다', () => {
    const body = build([row(0, '10')], PARTNER_DRAFT);

    expect(body?.destinationTypeCode).toBe(DISPOSAL_DESTINATION_TYPE_CODE);
    expect(body?.destinationId).toBe(9251);
  });

  /**
   * **도착지를 정하지 않으면 본문을 만들지 않는다** — 짝 규칙의 **마지막 겹**이다.
   *
   * 버튼 잠금(첫째 겹)과 보내는 자리의 재판정(둘째 겹)이 이미 닫아 둔 길이지만, 계약이
   * 두 필드를 선택으로 완화해 **서버가 막지 않는다** — 정하지 않은 채 나가면 「자체 폐기」로
   * 저장되고 그것은 사용자가 확인한 사실이 아니다.
   */
  it('자체 폐기도 거래처도 정하지 않으면 본문을 만들지 않는다', () => {
    expect(build([row(0, '10')], UNDECIDED_DRAFT)).toBeNull();
  });

  /** 값이 바뀌면 저장된 전표의 유형이 어긋난다 — **상수 한 자리**에 가둔 사실을 굳힌다(위험 R3). */
  it('도착지 유형 코드가 통지가 지정한 값 하나다', () => {
    expect(DISPOSAL_DESTINATION_TYPE_CODE).toBe('DISPOSAL_SITE');
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

  it('코드 셋을 다듬어 싣는다', () => {
    const body = build([row(0, '10')], {
      ...FILLED_DRAFT,
      codes: { ...FILLED_DRAFT.codes, issueType: '  SAMPLE_GI_TYPE_A  ' },
    });

    expect(body?.issueTypeCode).toBe('SAMPLE_GI_TYPE_A');
    expect(body?.sourceDocumentTypeCode).toBe('GOODS_RECEIPT');
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

  it.each(['issueType', 'sourceDocumentType'] as const)('%s가 비면 본문을 만들지 않는다', (key) => {
    const blank = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, [key]: '' } };

    expect(build([row(0, '10')], blank)).toBeNull();
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

/**
 * 도착지 짝을 **판별 유니온으로** 읽는다(완료 조건 C17 · 계획 §5 T3-3).
 *
 * 한쪽만 실리는 본문이 서버 400의 조건이므로, 그 조합이 **타입 수준에서 만들어지지 않게**
 * 짝을 한 값으로 묶었다. 아래 시험들이 재는 것은 「어떤 초안이 어느 갈래가 되는가」이고,
 * 「짝의 한쪽만 든 값」은 시험을 **쓸 수조차 없다** — 그 사실을 재는 것이 마지막 시험이다.
 */
describe('readDisposalDestination', () => {
  it('자체 폐기를 체크하면 자체 폐기 갈래다', () => {
    expect(readDisposalDestination(FILLED_DRAFT)).toEqual({ kind: 'self' });
  });

  it('거래처를 고르면 그 번호를 든 거래처 갈래다', () => {
    expect(readDisposalDestination(PARTNER_DRAFT)).toEqual({ kind: 'partner', partnerId: 9251 });
  });

  /** 「아직 안 골랐다」와 「자체 폐기라 없다」를 가르는 자리 — 이것이 체크박스의 존재 이유다. */
  it('아무것도 정하지 않으면 갈래가 없다', () => {
    expect(readDisposalDestination(UNDECIDED_DRAFT)).toBeNull();
  });

  /**
   * **체크가 이긴다.** 전이 함수(`withSelfDisposal`)가 값을 비우므로 화면에서는 생기지 않는
   * 조합이지만, 그 전이를 지나지 않은 초안이 들어와도 **한쪽만 실린 본문**이 만들어지면 안 된다.
   */
  it('체크한 채 거래처 값이 남아 있어도 자체 폐기로 읽는다', () => {
    expect(readDisposalDestination({ ...PARTNER_DRAFT, isSelfDisposal: true })).toEqual({
      kind: 'self',
    });
  });

  /**
   * **번호로 읽을 수 없는 값은 고르지 않은 것으로 본다.** 선택지의 값에서만 오는 글자라
   * 화면에서는 닿기 어려우나, `Number('')`가 0이고 `Number('9251x')`가 `NaN`이라 그대로 옮기면
   * **0번 거래처**나 `NaN`이 되돌릴 수 없는 전표에 실린다.
   */
  it.each(['', '   ', '0', '-1', '9251.5', '9251x', 'SAMPLE-PARTNER'])(
    '거래처 값이 %j이면 갈래가 없다',
    (disposalPartnerId) => {
      expect(readDisposalDestination({ ...PARTNER_DRAFT, disposalPartnerId })).toBeNull();
    },
  );

  /**
   * **앞뒤 공백을 뗀다** — 이 슬라이스가 보내는 값마다 지키는 규율이고, 떼지 않으면
   * `'^\d+$'`에 걸려 **고른 거래처가 조용히 「고르지 않음」이 된다.** 위 `'   '` 갈래는
   * 다듬지 않아도 같은 답이라 이 사실의 짝이 되지 못한다.
   */
  it('거래처 값의 앞뒤 공백을 떼고 읽는다', () => {
    expect(readDisposalDestination({ ...PARTNER_DRAFT, disposalPartnerId: ' 9251 ' })).toEqual({
      kind: 'partner',
      partnerId: 9251,
    });
  });

  /**
   * **짝의 한쪽만 든 값은 타입이 막는다**(완료 조건 C17의 「타입 수준」).
   *
   * `@ts-expect-error`는 **오류가 나지 않으면 그 자리에서 실패한다** — 판별 유니온이 느슨해져
   * `partnerId` 없는 거래처 갈래가 만들어지는 순간 `pnpm typecheck`가 운다. 실행 시각의
   * 단언으로는 잴 수 없는 사실이라 이 형태로 남긴다.
   */
  it('거래처 갈래는 번호 없이 만들어지지 않는다', () => {
    // @ts-expect-error — 짝의 한쪽(`partnerId`)이 빠진 도착지는 타입이 거부한다.
    const broken: DisposalDestination = { kind: 'partner' };

    expect(broken.kind).toBe('partner');
  });
});

/**
 * 확인 창이 보이는 도착지 한 줄(완료 조건 C19).
 *
 * **나가는 값과 같은 자리에서 만든다** — `toIssuedLocal`을 창과 요청이 함께 쓰는 것과 같은
 * 규율이다. 창이 따로 판정하면 「확인한 것과 나가는 것」이 갈린다.
 */
describe('describeDisposalDestination', () => {
  it('자체 폐기를 그 낱말로 보인다', () => {
    expect(describeDisposalDestination({ kind: 'self' }, null)).toBe(t.values.selfDisposal);
  });

  it('고른 거래처는 선택지에 보이던 그 글자로 보인다', () => {
    expect(
      describeDisposalDestination(
        { kind: 'partner', partnerId: 9251 },
        'SAMPLE-PARTNER-01 · 합성 폐기업체 가',
      ),
    ).toBe('SAMPLE-PARTNER-01 · 합성 폐기업체 가');
  });

  /**
   * **내부 번호를 대신 내지 않고 「없음」으로 접지도 않는다**(`omf-mes#44` · 리뷰 Minor M3).
   *
   * 「없음」은 **넣지 않은 값**을 뜻하는데, 거래처를 골랐다면 나가는 본문에는 짝 두 키가
   * 실린다 — 그때 창이 「도착지: 없음」이라 적으면 확인한 글자와 나가는 값이 어긋난다.
   */
  it('이름을 풀지 못하면 그 사실을 내고 번호는 내지 않는다', () => {
    const text = describeDisposalDestination({ kind: 'partner', partnerId: 9251 }, null);

    expect(text).toBe(t.values.unknown);
    expect(text).not.toContain('9251');
    /* 「넣지 않은 값」과 갈린다 — 두 사정이 같은 글자로 보이면 사용자가 가를 수 없다. */
    expect(text).not.toBe(t.values.empty);
  });

  it('아직 정하지 않았으면 빈 글자다', () => {
    expect(describeDisposalDestination(null, null)).toBe('');
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
