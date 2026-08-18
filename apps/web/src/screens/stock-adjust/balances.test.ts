import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  deriveActualQty,
  describeActualQty,
  describeBookQty,
  toBalanceRow,
  toBookQty,
  type BalanceSource,
} from './balances';
import { balanceResponse } from './fixtures';
import { readQty } from './validation';

/**
 * 장부 수량의 출처는 갈래마다 다르다(D-6).
 *
 * | 갈래 | 장부 |
 * | --- | --- |
 * | 실사 차이에서 | 실사 라인이 이미 들고 온 값 — 추가 요청이 없다 |
 * | 직접 등록 | 위치를 고른 시점의 잔액 조회 — **위치당 1회** |
 *
 * **못 찾으면 0으로 메우지 않는다.** 0은 「장부에 없다」는 뜻이 되어 차이 계산이 거짓이 된다.
 */

const t = messages.stockAdjust;

const source = (overrides: Partial<BalanceSource> = {}): BalanceSource => ({
  rows: [
    toBalanceRow(balanceResponse()),
    toBalanceRow(balanceResponse({ itemId: 9502, lotId: null, onHandQty: 0 })),
  ],
  isAsked: true,
  isLoading: false,
  isError: false,
  ...overrides,
});

describe('toBalanceRow', () => {
  /**
   * **응답의 `locationId`를 믿지 않는다**(D-6). `groupBy`로 접은 축은 비워서 내린다고 계약이
   * 적었으므로, 위치는 **요청의 조건**이 정한다 — 응답 값으로 대조하면 접힌 응답에서 한 줄도
   * 맞지 않는다.
   */
  it('위치를 담지 않는다 — 대조 축은 요청 조건이다', () => {
    expect(toBalanceRow(balanceResponse())).toEqual({ itemId: 9501, lotId: 9701, onHandQty: 120 });
  });

  it('LOT을 접은 줄은 LOT이 비어 있다', () => {
    expect(toBalanceRow(balanceResponse({ lotId: null })).lotId).toBeNull();
  });
});

describe('toBookQty', () => {
  it('품목과 LOT이 함께 맞는 줄의 수량을 낸다', () => {
    expect(toBookQty(source(), 9501, 9701)).toEqual({ kind: 'known', qty: 120 });
  });

  it('서버가 0이라고 한 줄은 0으로 낸다 — 못 찾은 것과 다르다', () => {
    expect(toBookQty(source(), 9502, null)).toEqual({ kind: 'known', qty: 0 });
  });

  it('LOT이 다르면 다른 줄이다 — 품목만 맞아서는 안 된다', () => {
    expect(toBookQty(source(), 9501, 9702)).toEqual({ kind: 'notFound' });
  });

  it('목록에 없으면 못 찾은 것이다 — 0으로 메우지 않는다', () => {
    expect(toBookQty(source(), 9509, null)).toEqual({ kind: 'notFound' });
  });

  /** 순서가 뜻을 정한다 — **실패·미도착이 「목록에 없음」보다 앞선다.** */
  it('불러오기에 실패하면 「목록에 없음」이 아니라 실패다', () => {
    expect(toBookQty(source({ isError: true }), 9509, null)).toEqual({ kind: 'failed' });
  });

  it('아직 오지 않았으면 「목록에 없음」이 아니라 조회 중이다', () => {
    expect(toBookQty(source({ isLoading: true, rows: [] }), 9501, 9701)).toEqual({
      kind: 'loading',
    });
  });

  it('아직 묻지 않았으면 조회 중도 실패도 아니다', () => {
    expect(toBookQty(source({ isAsked: false, rows: [] }), 9501, 9701)).toEqual({
      kind: 'notAsked',
    });
  });

  it('품목을 아직 고르지 않았으면 물을 것이 없다', () => {
    expect(toBookQty(source(), null, null)).toEqual({ kind: 'notAsked' });
  });
});

describe('describeBookQty', () => {
  it('아는 값은 단위와 함께 읽힌다', () => {
    expect(describeBookQty({ kind: 'known', qty: 120 }, '합성 단위 개')).toBe(
      t.lineTable.qtyWithUom('120', '합성 단위 개'),
    );
  });

  it.each([
    ['notAsked' as const, t.values.empty],
    ['loading' as const, t.bookQty.loading],
    ['failed' as const, t.bookQty.failed],
    ['notFound' as const, t.values.empty],
  ])('%o 갈래는 수를 지어내지 않는다', (kind, expected) => {
    expect(describeBookQty({ kind }, '합성 단위 개')).toBe(expected);
  });

  /** 단위를 아직 고르지 않은 줄에서는 수만 낸다 — 빈 단위가 꼬리 공백으로 남지 않는다. */
  it('단위를 모르면 수만 낸다', () => {
    expect(describeBookQty({ kind: 'known', qty: 120 }, '')).toBe('120');
  });
});

describe('describeActualQty', () => {
  it('아는 값은 단위와 함께 읽힌다', () => {
    expect(describeActualQty({ kind: 'known', qty: 100 }, '합성 단위 개')).toBe(
      t.lineTable.qtyWithUom('100', '합성 단위 개'),
    );
  });

  it('모르는 값을 0으로 내지 않는다', () => {
    expect(describeActualQty({ kind: 'unknown' }, '합성 단위 개')).toBe(t.values.empty);
  });
});

/**
 * **실물은 파생이다**(D-5 · 조심 ③). 「장부 + 차이」로 계산해 읽기 전용으로 보인다 —
 * 입력칸으로 두면 그것이 곧 결과 수량 입력이 되어 덮어쓰기 화면이 된다.
 */
describe('deriveActualQty', () => {
  it('장부에 차이를 더한다', () => {
    expect(deriveActualQty({ kind: 'known', qty: 120 }, readQty('-20'))).toEqual({
      kind: 'known',
      qty: 100,
    });
  });

  it('차이가 0이면 실물이 장부와 같다', () => {
    expect(deriveActualQty({ kind: 'known', qty: 120 }, readQty('0'))).toEqual({
      kind: 'known',
      qty: 120,
    });
  });

  it('장부를 모르면 실물도 모른다 — 0을 장부로 삼지 않는다', () => {
    expect(deriveActualQty({ kind: 'notFound' }, readQty('-20'))).toEqual({ kind: 'unknown' });
  });

  it('차이를 아직 치지 않았으면 실물을 지어내지 않는다', () => {
    expect(deriveActualQty({ kind: 'known', qty: 120 }, readQty(''))).toEqual({ kind: 'unknown' });
  });

  it('차이가 수로 읽히지 않으면 실물을 지어내지 않는다', () => {
    expect(deriveActualQty({ kind: 'known', qty: 120 }, readQty('abc'))).toEqual({
      kind: 'unknown',
    });
  });
});
