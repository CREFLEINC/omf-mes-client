import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { closeBlockReason } from './close-guard';
import type { CountSummaryView } from './types';

const t = messages.stocktaking;

/** 마감 조건을 **채운** 요약. 계획·카운트 건수는 판정에 쓰이지 않는다. */
const CLOSABLE: CountSummaryView = {
  plannedCount: 40,
  countedCount: 40,
  uncountedCount: 0,
  varianceCount: 0,
};

const summaryOf = (overrides: Partial<CountSummaryView> = {}): CountSummaryView => ({
  ...CLOSABLE,
  ...overrides,
});

/**
 * **계약이 필수라 말한 값이 응답에서 빠져 온** 요약.
 *
 * 라인의 `systemQty`에서 이미 겪은 어긋남과 같은 형태다(계획 결정 4 · 어긋남 1) — 타입은
 * 필수라 말하는데 런타임에는 없을 수 있다. 여기서 한 번만 단언으로 좁힌다.
 */
const summaryWithout = (field: keyof CountSummaryView): CountSummaryView => {
  const { [field]: _missing, ...rest } = CLOSABLE;

  return rest as CountSummaryView;
};

describe('closeBlockReason — 요약의 두 건수만 본다', () => {
  /*
   * **완료 조건 C53** — 미실사와 차이가 **둘 다 0이면** 열린다.
   * 이것이 이 함수가 `null`을 돌려주는 유일한 길이다.
   */
  it('두 건수가 모두 0이면 막지 않는다', () => {
    expect(closeBlockReason({ summary: CLOSABLE, hasClosedInSession: false })).toBeNull();
  });

  /*
   * **완료 조건 C51 · 감지기 M54** — 미실사가 남으면 막고 **그 건수를 인용한다.**
   * 건수를 인용하지 않으면 사용자는 얼마나 남았는지 알 수 없어 언제 끝나는지 가늠할 수 없다.
   */
  it.each([1, 15, 60])('미실사가 %i건이면 그 건수를 인용해 막는다', (uncountedCount) => {
    expect(closeBlockReason({ summary: summaryOf({ uncountedCount }), hasClosedInSession: false })).toBe(
      t.actionReasons.closeUncounted(uncountedCount),
    );
  });

  /*
   * **완료 조건 C52 · 감지기 M55** — 차이가 남으면 막는다. 착수 이슈 §4가 「우회 경로를
   * 두지 않는다」로 못 박은 자리라, 이 사유에는 「그래도 마감」이 붙지 않는다.
   */
  it.each([1, 6, 12])('차이가 %i건이면 그 건수를 인용해 막는다', (varianceCount) => {
    expect(closeBlockReason({ summary: summaryOf({ varianceCount }), hasClosedInSession: false })).toBe(
      t.actionReasons.closeVariance(varianceCount),
    );
  });

  /*
   * **차례를 재려면 겹치는 판을 만들어야 한다**(PR ③ 리뷰 R-2의 교훈).
   *
   * 한 사유만 참인 입력으로는 **어느 순서로 늘어놓아도 같은 답**이 나와 차례가 고정되지
   * 않는다. 미실사와 차이가 **동시에** 남은 판에서만 「무엇을 먼저 말하는가」가 관측된다 —
   * 미실사가 먼저인 이유는 그것이 실사의 앞 단계이기 때문이다(세지 않은 줄을 다 센 뒤에야
   * 차이가 확정된다). 차이를 먼저 내면 아직 세지도 않은 줄의 차이를 조정하라고 가리킨다.
   */
  it('미실사와 차이가 함께 남으면 미실사를 먼저 말한다', () => {
    expect(
      closeBlockReason({
        summary: summaryOf({ uncountedCount: 15, varianceCount: 6 }),
        hasClosedInSession: false,
      }),
    ).toBe(t.actionReasons.closeUncounted(15));
  });

  /*
   * **이미 마감한 실사는 다른 무엇도 앞서지 못한다.** 그 상태에서는 미실사·차이를 아무리
   * 정리해도 열리지 않으므로, 건수를 먼저 내면 **할 수 없는 조치**를 가리킨다.
   * 세 판 모두 겹치는 판이라 차례가 실제로 관측된다.
   */
  it.each<[string, Partial<CountSummaryView>]>([
    ['조건을 다 채운', {}],
    ['미실사가 남은', { uncountedCount: 15 }],
    ['차이가 남은', { varianceCount: 6 }],
  ])('%s 요약이라도 이번 세션에서 마감했으면 그 사실을 먼저 말한다', (_label, overrides) => {
    expect(
      closeBlockReason({ summary: summaryOf(overrides), hasClosedInSession: true }),
    ).toBe(t.actionReasons.closeAlreadyClosed);
  });

  /*
   * **판정할 수 없으면 막는 쪽에 선다**(승계 — 「계약이 필수라 말한 값이 실제로는 빠져 오는」
   * 상태). 요약 4칸이 마감 판정의 **유일한 근거**인데, 건수가 수로 오지 않으면 `> 0` 비교가
   * 조용히 거짓이 되어 **마감이 열린다** — 되돌릴 수 없는 쓰기가 근거 없이 나가는 길이다.
   *
   * 두 축을 갈라 센다. 한 축만 재면 다른 축의 방어를 지워도 잡히지 않는다.
   */
  it.each<[string, keyof CountSummaryView]>([
    ['미실사', 'uncountedCount'],
    ['차이', 'varianceCount'],
  ])('%s 건수가 응답에서 빠져 오면 열지 않고 막는다', (_label, field) => {
    expect(closeBlockReason({ summary: summaryWithout(field), hasClosedInSession: false })).toBe(
      t.actionReasons.closeSummaryUnavailable,
    );
  });

  /*
   * **짝 방향 — 판정에 쓰는 것은 두 건수뿐이다**(계획 결정 12 · 승인 13-6).
   * 계획·카운트 건수가 아무리 커도 마감은 열린다. 이 단언이 없으면 「넷 다 0이어야 열린다」
   * 같은 더 좁은 규칙으로 바뀌어도 위 테스트들이 전부 통과한다.
   */
  it('계획·카운트 건수는 마감 판정에 쓰지 않는다', () => {
    expect(
      closeBlockReason({
        summary: summaryOf({ plannedCount: 1240, countedCount: 1180 }),
        hasClosedInSession: false,
      }),
    ).toBeNull();
  });

  /*
   * 계획·카운트가 **빠져 와도** 마감 판정은 흔들리지 않는다 — 읽지 않는 값이기 때문이다.
   * 위의 「빠져 오면 막는다」가 요약 전체로 번지지 않았음을 이 짝이 고정한다.
   */
  it.each<[string, keyof CountSummaryView]>([
    ['계획', 'plannedCount'],
    ['카운트', 'countedCount'],
  ])('%s 건수가 빠져 와도 마감 판정은 그대로다', (_label, field) => {
    expect(closeBlockReason({ summary: summaryWithout(field), hasClosedInSession: false })).toBeNull();
  });
});
