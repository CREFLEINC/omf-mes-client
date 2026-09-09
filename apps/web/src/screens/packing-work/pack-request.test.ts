import { describe, expect, it } from 'vitest';

import { ITEM_ID, LOT_A_ID, UOM_ID } from './fixtures';
import { businessDateOf, samePackBody, toCreateBody, toPackBody } from './pack-request';

/**
 * 확정 본문의 **시각 두 칸**이 이번 변경의 표제 이득이다 — 자정을 넘겨 전송된 큐 항목이
 * 원장의 `(멱등키, 영업일)` 제약을 둘 다 통과해 두 건으로 적재되던 구멍을 그 칸이 닫는다
 * (공유계약 C-8). 그래서 「칸이 있다」가 아니라 **값**을 여기서 지킨다.
 */
const LINES = [{ lotId: LOT_A_ID, lotNo: 'PLOT-0031', itemId: ITEM_ID, uomId: UOM_ID, qty: 100 }];

describe('toCreateBody — 담기 시작', () => {
  it('유형을 고르지 않았으면 만들지 않는다', () => {
    expect(toCreateBody({ handlingUnitTypeCode: null, parentHandlingUnitId: null })).toBeNull();
  });

  /* ⛔ 내용물을 실으면 두 층이 다시 한 층이 된다 — 확정이 할 일이 사라진다. */
  it('내용물을 싣지 않는다', () => {
    const body = toCreateBody({ handlingUnitTypeCode: 'BOX', parentHandlingUnitId: null });

    expect(body).toEqual({ handlingUnitTypeCode: 'BOX', parentHandlingUnitId: null });
    expect(body).not.toHaveProperty('contents');
  });
});

describe('businessDateOf — 단말이 정하는 업무 기준일', () => {
  /* ⛔ 서버가 받은 때로 다시 잡지 않는다(C-8) — 그래서 단말의 «달력 날짜»여야 한다. */
  it('단말의 달력 날짜를 낸다', () => {
    expect(businessDateOf(new Date(2026, 8, 9, 23, 50))).toBe('2026-09-09');
    /* 자정을 넘기면 날짜가 넘어간다 — 그 경계가 이 조항이 지키려는 자리다. */
    expect(businessDateOf(new Date(2026, 8, 10, 0, 10))).toBe('2026-09-10');
  });

  it('월·일을 두 자리로 채운다', () => {
    expect(businessDateOf(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05');
  });
});

describe('toPackBody — 확정', () => {
  it('담은 것이 없으면 만들지 않는다', () => {
    expect(toPackBody([], new Date())).toBeNull();
  });

  /* ⭐ 값까지 지킨다 — 「칸이 있다」만 보면 빈 문자열이 그대로 나간다. */
  it('영업일과 발생 시각을 담은 시점의 값으로 싣는다', () => {
    const now = new Date(2026, 8, 9, 23, 50);
    const body = toPackBody(LINES, now);

    expect(body?.businessDate).toBe('2026-09-09');
    expect(body?.occurredAt).toBe(now.toISOString());
    expect(body?.contents).toEqual([{ lotId: LOT_A_ID, itemId: ITEM_ID, uomId: UOM_ID, qty: 100 }]);
  });
});

describe('samePackBody — 이어받아도 되는가', () => {
  const at = (iso: string) => toPackBody(LINES, new Date(iso));

  /*
   * ⛔ **시각을 비교에 넣지 않는다.** 확정을 다시 누르면 그 값은 반드시 달라지므로, 함께
   * 비교하면 이어받기가 영영 성립하지 않는다 — 담은 것이 그대로인데도 새 키로 나가 되돌릴 수
   * 없는 확정이 두 번 설 수 있다.
   */
  it('시각만 다르면 같은 것으로 본다', () => {
    const left = at('2026-09-09T23:50:00+09:00');
    const right = at('2026-09-10T00:10:00+09:00');

    expect(left).not.toBeNull();
    expect(samePackBody(left!, right!)).toBe(true);
  });

  /* ⛔ 담은 것이 달라졌으면 그 키는 다른 쓰기의 키다 — 이어받으면 나중 줄이 흡수돼 사라진다. */
  it('담은 것이 달라지면 다른 것으로 본다', () => {
    const left = at('2026-09-09T23:50:00+09:00');
    const right = toPackBody([{ ...LINES[0]!, qty: 50 }], new Date());

    expect(samePackBody(left!, right!)).toBe(false);
  });
});
