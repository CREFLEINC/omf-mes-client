import { afterEach, describe, expect, it, vi } from 'vitest';

import { goodsReceipt, goodsReceiptLine, goodsReceiptLineFixtures } from './fixtures';
import {
  DESTINATION_TYPE_CODES,
  POST_IMMEDIATELY,
  toBusinessDate,
  toGoodsIssueRequest,
  toIssuedLocal,
  toOccurredAt,
  toOffsetDateTime,
  toReturnLines,
  type ReturnRequestInput,
} from './issue-request';
import { EMPTY_LINE_DRAFT, setDraftQty, toggleLineSelection, type LineDraft } from './line-draft';
import type { BalanceSource } from './on-hand';
import { describeReturnSelection, toReturnLineRows } from './return-selection';
import type { ReturnDraft } from './types';

/** 제출 순간. **인자로 넘긴다** — 함수 안에서 시각을 읽으면 고정 시각으로 검사할 수 없다. */
const NOW = new Date('2026-08-11T14:30:45+09:00');

/**
 * 도착지 유형만 **계약이 아는 값**이다 — 계약이 이 코드를 값 셋으로 좁혔고(#173), 조립이
 * 계약 밖 값을 받으면 본문을 만들지 않는다. 나머지 코드 셋은 값 목록이 아직 열리지 않아
 * 합성값 그대로다(계약이 `string`으로 두고 있다).
 * 공급사 반품의 도착지가 거래처라는 것도 #173이 표로 적었다.
 */
const DESTINATION_TYPE = 'PARTNER';

const DRAFT: ReturnDraft = {
  supplier: '9901',
  codes: {
    issueType: 'SAMPLE_ISSUE_TYPE_A',
    sourceDocumentType: 'SAMPLE_SOURCE_TYPE_A',
    destinationType: DESTINATION_TYPE,
    reason: 'SAMPLE_REASON_A',
  },
  issuedDate: '2026-08-06',
  issuedTime: '09:12',
  replacementExpected: false,
  sendToErp: true,
  remarks: '',
};

/** 상한을 확인하지 못한 상태 — 상한은 요청 조립에 실리지 않는다는 것을 함께 굳힌다. */
const NO_BALANCES: BalanceSource = { items: [], isError: false, truncated: false };

const pick = (draft: LineDraft, lineId: number, text: string): LineDraft =>
  setDraftQty(toggleLineSelection(draft, lineId), lineId, text);

/** 고른 줄만 남긴 요청 라인. **표의 줄에서 나온다**(계획 결정 8). */
const selectedLines = (draft: LineDraft, lines = goodsReceiptLineFixtures) =>
  toReturnLines(describeReturnSelection(toReturnLineRows(lines, draft, NO_BALANCES)).selectedRows);

const input = (overrides: Partial<ReturnRequestInput> = {}): ReturnRequestInput => ({
  receipt: goodsReceipt(),
  lines: selectedLines(pick(EMPTY_LINE_DRAFT, 9401, '30')),
  draft: DRAFT,
  now: NOW,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('toReturnLines — 고른 줄을 요청 라인으로 옮긴다', () => {
  /* **C45** — 계약이 반품 라인에 요구하는 다섯을 입고 라인이 그대로 준다(계획 결정 2). */
  it('다섯 값을 표의 줄에서 그대로 옮긴다', () => {
    expect(selectedLines(pick(EMPTY_LINE_DRAFT, 9401, '30'))).toEqual([
      {
        itemId: 9301,
        lotId: 9601,
        issueQty: 30,
        uomId: 9501,
        sourceLocationId: 9801,
      },
    ]);
  });

  /*
   * **적치 목적지가 곧 반품의 출발 위치다.** 값을 지어내지 않고 그 줄의 값을 옮긴다 —
   * 다른 위치를 실으면 있지도 않은 자리에서 자재를 빼려 한다.
   */
  it('출발 위치는 그 줄의 적치 위치다', () => {
    const line = goodsReceiptLine({ destinationLocationId: 9802 });

    expect(selectedLines(pick(EMPTY_LINE_DRAFT, 9401, '30'), [line])[0]?.sourceLocationId).toBe(
      9802,
    );
  });

  /*
   * **M39의 짝** — 고르지 않은 줄은 실리지 않는다. 초안에 수량이 남아 있어도 마찬가지다
   * (선택을 풀어도 친 값을 지우지 않으므로 실제로 일어나는 상태다).
   */
  it('고르지 않은 줄은 수량이 남아 있어도 싣지 않는다', () => {
    const draft = toggleLineSelection(pick(EMPTY_LINE_DRAFT, 9401, '30'), 9401);

    expect(selectedLines(draft)).toEqual([]);
  });

  /*
   * **읽을 수 없는 수량은 싣지 않는다.** 「0.」처럼 미완성이거나 숫자가 아닌 글자를 그대로
   * 실으면 `null`이나 `0`이 요청에 들어간다 — 막는 판정은 버튼이 이미 했지만 타입은 그 사실을
   * 모르므로, 여기서 값으로 한 번 더 좁힌다(non-null 단언을 쓰지 않는 자리다).
   */
  it.each([['', '빈 칸'], ['abc', '숫자가 아닌 글자'], ['0', '0'], ['-1', '음수']])(
    '수량이 %s(%s)인 줄은 싣지 않는다',
    (text) => {
      expect(selectedLines(pick(EMPTY_LINE_DRAFT, 9401, text))).toEqual([]);
    },
  );

  it('여러 줄을 고른 차례가 아니라 표의 차례로 싣는다', () => {
    const draft = pick(pick(EMPTY_LINE_DRAFT, 9402, '5'), 9401, '30');

    expect(selectedLines(draft).map((line) => line.lotId)).toEqual([9601, 9602]);
  });

  /* 소수 수량을 반올림하지 않는다 — 계약이 정수를 요구하지 않는다. */
  it('소수 수량을 그대로 싣는다', () => {
    expect(selectedLines(pick(EMPTY_LINE_DRAFT, 9401, '12.5'))[0]?.issueQty).toBe(12.5);
  });
});

describe('toIssuedLocal — 두 칸을 한 값으로 잇는다', () => {
  it('날짜와 시각을 `T`로 잇는다', () => {
    expect(toIssuedLocal(DRAFT)).toBe('2026-08-06T09:12');
  });
});

describe('toOffsetDateTime — 입력칸 값에 offset을 붙인다', () => {
  /*
   * 입력칸은 분까지만 주는데 계약은 초까지 있는 형식을 요구한다. offset이 없는 문자열을
   * 그대로 보내면 **같은 글자가 지역마다 다른 순간을 가리킨다.**
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

  /*
   * **실행 환경이 UTC 동쪽일 때와 서쪽일 때 부호가 갈린다.** 고정 시각만으로는 이 갈래를 잴 수
   * 없어 시간대 자체를 갈아 끼운다 — 부호를 뒤집는 결함은 한국에서만 돌려 보면 드러나지 않는다.
   */
  it('UTC 동쪽이면 `+`, 서쪽이면 `-`가 붙는다', () => {
    const offset = vi.spyOn(Date.prototype, 'getTimezoneOffset');

    offset.mockReturnValue(-540);
    expect(toOffsetDateTime('2026-08-06T09:12', NOW).endsWith('+09:00')).toBe(true);

    offset.mockReturnValue(300);
    expect(toOffsetDateTime('2026-08-06T09:12', NOW).endsWith('-05:00')).toBe(true);
  });

  /* 30분 단위 시간대(예: UTC+05:30)에서도 분이 살아 있어야 한다 — 시간만 쓰면 30분이 사라진다. */
  it('30분 단위 시간대의 분을 버리지 않는다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);

    expect(toOffsetDateTime('2026-08-06T09:12', NOW).endsWith('+05:30')).toBe(true);
  });
});

describe('toOccurredAt — 발생 시각은 제출 순간이다', () => {
  /*
   * **`issuedAt`과 갈라 싣는다**(계획 §5.4-8). 계약이 둘의 관계를 정의하지 않았고 설명이
   * 각각 「출고일」·「공유계약 C-1」이다 — 출고 일시는 **사용자가 적은 때**이고 발생 시각은
   * **화면이 요청을 보낸 때**다. 어제 나간 것을 오늘 등록하면 두 값이 실제로 갈린다.
   */
  it('제출 순간의 초까지 싣고 offset을 붙인다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540);

    expect(toOccurredAt(NOW)).toBe('2026-08-11T14:30:45+09:00');
  });

  it('자정 직후의 날짜를 앞날로 적지 않는다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540);

    expect(toOccurredAt(new Date('2026-08-12T00:00:00+09:00'))).toBe('2026-08-12T00:00:00+09:00');
  });
});

describe('toBusinessDate — 영업일은 출고 일시의 날짜다', () => {
  /*
   * **실행 시각의 날짜를 쓰지 않는다**(계획 §5.4-9). 산출 규칙(야간조 경계 등)이 어디에도
   * 정의돼 있지 않고, 어제 나간 것을 오늘 등록하는 일이 흔하다.
   */
  it('출고 일시의 날짜 조각을 쓴다', () => {
    expect(toBusinessDate('2026-08-06T09:12')).toBe('2026-08-06');
  });

  it('자정 직전과 직후가 서로 다른 날이다', () => {
    expect(toBusinessDate('2026-08-06T23:59')).toBe('2026-08-06');
    expect(toBusinessDate('2026-08-07T00:00')).toBe('2026-08-07');
  });
});

describe('toGoodsIssueRequest — 되돌릴 수 없는 쓰기의 본문', () => {
  /*
   * **M40 · 위험 1** — 이 한 줄이 이 화면에서 가장 비싼 자리다. 빠뜨리면 전표만 만들어지고
   * 전기되지 않는데 화면은 성공으로 보이며, **이 화면에는 나중에 전기할 수단이 없다**
   * (목이 생략을 201로 통과시키는 것이 실측됐다).
   */
  it('`postImmediately`를 늘 참으로 싣는다', () => {
    expect(toGoodsIssueRequest(input())?.postImmediately).toBe(true);
    expect(POST_IMMEDIATELY).toBe(true);
  });

  /* 상수다 — 초안의 어떤 값으로도 갈리지 않는다. 조건부로 만들면 갈리는 길이 생긴다. */
  it('초안이 무엇이든 `postImmediately`가 참이다', () => {
    const body = toGoodsIssueRequest(
      input({ draft: { ...DRAFT, sendToErp: false, replacementExpected: true } }),
    );

    expect(body?.postImmediately).toBe(true);
  });

  /* **C43** — 기본값에 기대지 않는다. 서버 기본이 바뀌면 조용히 달라진다. */
  it('`sendToErp`를 늘 명시해 싣는다', () => {
    expect(toGoodsIssueRequest(input())?.sendToErp).toBe(true);
    expect(toGoodsIssueRequest(input({ draft: { ...DRAFT, sendToErp: false } }))?.sendToErp).toBe(
      false,
    );
  });

  it('`sendToErp`와 `postImmediately` 키가 본문에 실제로 있다', () => {
    const body = toGoodsIssueRequest(input());

    expect(body).not.toBeNull();
    expect(Object.keys(body ?? {})).toEqual(
      expect.arrayContaining(['sendToErp', 'postImmediately']),
    );
  });

  /* **C44** — 원천은 고른 입고 전표이고 창고는 그 전표의 창고다. */
  it('원천 문서와 창고가 고른 입고 전표에서 온다', () => {
    const body = toGoodsIssueRequest(
      input({ receipt: goodsReceipt({ goodsReceiptId: 9002, warehouseId: 9702 }) }),
    );

    expect(body?.sourceDocumentId).toBe(9002);
    expect(body?.sourceWarehouseId).toBe(9702);
  });

  /* 도착지는 **사용자가 고른 공급사**다 — 입고 전표에서 끌어오지 않는다(계획 결정 11). */
  it('도착지가 고른 공급사의 번호다', () => {
    expect(toGoodsIssueRequest(input())?.destinationId).toBe(9901);
  });

  it('코드 넷을 앞뒤 공백을 떼고 싣는다', () => {
    const body = toGoodsIssueRequest(
      input({
        draft: {
          ...DRAFT,
          codes: {
            issueType: '  SAMPLE_ISSUE_TYPE_A  ',
            sourceDocumentType: ' SAMPLE_SOURCE_TYPE_A ',
            destinationType: ` ${DESTINATION_TYPE} `,
            reason: ' SAMPLE_REASON_A ',
          },
        },
      }),
    );

    expect(body?.issueTypeCode).toBe('SAMPLE_ISSUE_TYPE_A');
    expect(body?.sourceDocumentTypeCode).toBe('SAMPLE_SOURCE_TYPE_A');
    expect(body?.destinationTypeCode).toBe(DESTINATION_TYPE);
    expect(body?.reasonCode).toBe('SAMPLE_REASON_A');
  });

  /* **C46** — 출고 일시는 두 칸을 이어 offset을 붙인 값이다. */
  it('출고 일시가 날짜·시각 두 칸에서 온다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540);

    expect(toGoodsIssueRequest(input())?.issuedAt).toBe('2026-08-06T09:12:00+09:00');
  });

  /*
   * **`issuedAt`과 `occurredAt`이 갈린다.** 같은 값으로 접으면 「언제 나갔는가」와 「언제
   * 등록했는가」가 하나가 되어, 어제 나간 것을 오늘 등록한 사실이 전표에서 사라진다.
   */
  it('발생 시각은 제출 순간이라 출고 일시와 다르다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540);

    const body = toGoodsIssueRequest(input());

    expect(body?.occurredAt).toBe('2026-08-11T14:30:45+09:00');
    expect(body?.occurredAt).not.toBe(body?.issuedAt);
  });

  it('영업일이 출고 일자와 같고 제출 날짜와 다르다', () => {
    const body = toGoodsIssueRequest(input());

    expect(body?.businessDate).toBe('2026-08-06');
    expect(body?.businessDate).not.toBe('2026-08-11');
  });

  it('대체입고 예정을 초안 그대로 싣는다', () => {
    expect(toGoodsIssueRequest(input())?.replacementExpected).toBe(false);
    expect(
      toGoodsIssueRequest(input({ draft: { ...DRAFT, replacementExpected: true } }))
        ?.replacementExpected,
    ).toBe(true);
  });

  /* 비운 칸은 **키 자체를 싣지 않는다** — 빈 문자열은 「빈 값을 넣었다」로 전표에 남는다. */
  it('비고가 비어 있으면 키를 싣지 않는다', () => {
    expect(toGoodsIssueRequest(input())).not.toHaveProperty('remarks');
  });

  it('비고가 공백만이어도 키를 싣지 않는다', () => {
    expect(toGoodsIssueRequest(input({ draft: { ...DRAFT, remarks: '   ' } }))).not.toHaveProperty(
      'remarks',
    );
  });

  it('비고를 앞뒤 공백을 떼고 싣는다', () => {
    expect(
      toGoodsIssueRequest(input({ draft: { ...DRAFT, remarks: '  합성 비고  ' } }))?.remarks,
    ).toBe('합성 비고');
  });

  /*
   * **M39** — 계약 설명은 「최소 1행」인데 `minItems`가 없고 목이 `lines: []`를 201로 받는다
   * (실측). 막는 곳이 화면뿐이라 **조립 자리가 마지막 겹**이다.
   */
  it('보낼 줄이 없으면 본문을 만들지 않는다', () => {
    expect(toGoodsIssueRequest(input({ lines: [] }))).toBeNull();
  });

  it('고른 줄이 하나도 없으면 본문을 만들지 않는다', () => {
    expect(toGoodsIssueRequest(input({ lines: selectedLines(EMPTY_LINE_DRAFT) }))).toBeNull();
  });

  it('줄을 표의 값 그대로 싣는다', () => {
    const body = toGoodsIssueRequest(
      input({ lines: selectedLines(pick(pick(EMPTY_LINE_DRAFT, 9401, '30'), 9402, '5')) }),
    );

    expect(body?.lines).toEqual([
      { itemId: 9301, lotId: 9601, issueQty: 30, uomId: 9501, sourceLocationId: 9801 },
      { itemId: 9302, lotId: 9602, issueQty: 5, uomId: 9501, sourceLocationId: 9802 },
    ]);
  });

  /*
   * **계약이 요구하는 열이 전부 실린다**(C43). 하나라도 빠지면 400으로 되돌아오지만,
   * 되돌릴 수 없는 쓰기라 나가기 전에 굳혀 둔다.
   */
  it('계약 필수 열 전부와 화면이 늘 명시하는 둘을 싣는다', () => {
    expect(Object.keys(toGoodsIssueRequest(input()) ?? {}).sort()).toEqual(
      [
        'businessDate',
        'destinationId',
        'destinationTypeCode',
        'issuedAt',
        'issueTypeCode',
        'lines',
        'occurredAt',
        'postImmediately',
        'reasonCode',
        'replacementExpected',
        'sendToErp',
        'sourceDocumentId',
        'sourceDocumentTypeCode',
        'sourceWarehouseId',
      ].sort(),
    );
  });

  /* 상한을 확인하지 못했다는 사정은 **본문에 실리지 않는다** — 화면 안의 판단이다. */
  it('보유 수량과 상한 판정을 본문에 싣지 않는다', () => {
    const body = toGoodsIssueRequest(input());

    expect(body).not.toHaveProperty('onHandQty');
    expect(body).not.toHaveProperty('availableQty');
  });
});

/**
 * **계약이 도착지 유형을 값 셋으로 좁혔다**(#173 — 위치 · 거래처 · 폐기 거래처).
 * 어휘 밖 값은 서버가 400으로 거절한다. 이 화면의 선택지는 아직 **빈 자리표시**라 화면에서는
 * 닿을 수 없는 갈래지만, 자리표시가 열리는 순간 사용자가 고른 값이 곧장 여기로 온다 —
 * 되돌릴 수 없는 쓰기의 **마지막 겹**이므로 지금 재 둔다.
 */
describe('toGoodsIssueRequest — 도착지 유형 협착 가드', () => {
  const withDestinationType = (destinationType: string): ReturnRequestInput =>
    input({ draft: { ...DRAFT, codes: { ...DRAFT.codes, destinationType } } });

  it('계약이 정한 값이 아닌 도착지 유형이면 본문을 만들지 않는다', () => {
    expect(toGoodsIssueRequest(withDestinationType('SAMPLE_DESTINATION_TYPE_A'))).toBeNull();
  });

  /* 「비슷하면 통과」 구현을 잡는다 — 대소문자 보정·접두사 제거를 만들지 않는다. */
  it.each(['partner', 'PARTNER_X', 'PART NER', 'toString'])(
    '계약 값과 비슷하기만 한 코드(%s)도 막는다',
    (destinationType) => {
      expect(toGoodsIssueRequest(withDestinationType(destinationType))).toBeNull();
    },
  );

  it('도착지 유형이 비어 있으면 본문을 만들지 않는다', () => {
    expect(toGoodsIssueRequest(withDestinationType(''))).toBeNull();
    expect(toGoodsIssueRequest(withDestinationType('   '))).toBeNull();
  });

  /* 짝 방향 — 계약이 아는 셋은 **하나도 빠짐없이** 지나간다. 막는 쪽만 재면 과잉 차단을 놓친다. */
  it('계약이 정한 값 셋을 모두 그대로 싣는다', () => {
    const codes = Object.keys(DESTINATION_TYPE_CODES);

    expect(codes).toHaveLength(3);

    for (const code of codes) {
      expect(toGoodsIssueRequest(withDestinationType(code))?.destinationTypeCode).toBe(code);
    }
  });
});
