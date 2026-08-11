import { describe, expect, it } from 'vitest';

import { blindCountLineResponse, countLineResponse, countResponse, summaryResponse } from './fixtures';
import {
  describeBlindCount,
  toCountDetailView,
  toCountLineView,
  toCountSummaryView,
  toCountView,
} from './types';

describe('toCountView', () => {
  it('실사 헤더의 값을 그대로 옮긴다', () => {
    const view = toCountView(countResponse());

    expect(view).toEqual({
      inventoryCountId: 9001,
      inventoryCountNo: 'IC-2026-900011',
      countTypeCode: 'SAMPLE_COUNT_TYPE_A',
      warehouseId: 9101,
      plannedDate: '2026-08-06',
      blindCount: false,
      statusCode: 'SAMPLE_COUNT_STATUS_A',
    });
  });

  /* 블라인드는 열 구성을 가르는 값이라 참·거짓이 모두 그대로 실려야 한다(계획 결정 4). */
  it('블라인드가 참인 실사도 그대로 옮긴다', () => {
    expect(toCountView(countResponse({ blindCount: true })).blindCount).toBe(true);
  });

  /*
   * **상태 코드를 해석하지 않는다**(공유계약 G-2). 값 집합이 확정되지 않아 화면이 뜻을
   * 붙이면 값이 정해질 때 조용히 틀린다 — 서버가 준 문자열이 그대로 나와야 한다.
   */
  it('상태 코드를 바꾸지 않고 그대로 옮긴다', () => {
    const view = toCountView(countResponse({ statusCode: 'SAMPLE_COUNT_STATUS_Z' }));

    expect(view.statusCode).toBe('SAMPLE_COUNT_STATUS_Z');
  });
});

describe('toCountSummaryView', () => {
  /*
   * **서버가 센 숫자를 그대로 쓴다**(착수 이슈 §6 ⭐). 화면이 라인을 세면 쪽과 어긋난다 —
   * 창고 하나의 라인이 수백~수천 건이다.
   */
  it('요약 네 건수를 그대로 옮긴다', () => {
    const view = toCountSummaryView(summaryResponse());

    expect(view).toEqual({ plannedCount: 40, countedCount: 25, uncountedCount: 15, varianceCount: 6 });
  });

  it('0인 건수도 그대로 옮긴다', () => {
    const view = toCountSummaryView(
      summaryResponse({ plannedCount: 0, countedCount: 0, uncountedCount: 0, varianceCount: 0 }),
    );

    expect(view).toEqual({ plannedCount: 0, countedCount: 0, uncountedCount: 0, varianceCount: 0 });
  });
});

describe('toCountDetailView', () => {
  it('헤더와 요약을 함께 옮긴다', () => {
    const view = toCountDetailView({
      inventoryCount: countResponse(),
      summary: summaryResponse(),
    });

    expect(view.count.inventoryCountNo).toBe('IC-2026-900011');
    expect(view.summary.uncountedCount).toBe(15);
  });
});

describe('toCountLineView', () => {
  it('라인의 값을 옮기고 없는 선택 필드를 null로 모은다', () => {
    const view = toCountLineView(countLineResponse());

    expect(view).toEqual({
      inventoryCountLineId: 9401,
      lineNo: 1,
      locationId: 9701,
      itemId: 9301,
      lotId: 9601,
      systemQty: 100,
      countedQty: 98,
      varianceQty: -2,
      uomId: 9501,
      varianceReasonCode: 'SAMPLE_VARIANCE_REASON_A',
    });
  });

  /* `lotId`가 없는 것은 **빈 값이지 참조 실패가 아니다**(W-01-10 계획 정정 1의 판단 그대로). */
  it('자재 LOT이 없는 라인은 null로 옮긴다', () => {
    expect(toCountLineView(countLineResponse({ lotId: null })).lotId).toBeNull();
  });

  it('차이 사유가 없는 라인은 null로 옮긴다', () => {
    expect(toCountLineView(countLineResponse({ varianceReasonCode: null })).varianceReasonCode).toBeNull();
  });

  /*
   * **계약 타입을 믿지 않는다**(계획 결정 4 · 어긋남 1). 병합 스펙은 `systemQty`를 `required`로
   * 두는데 그 설명은 「블라인드 실사에서는 내려보내지 않는다」다. 런타임에 없을 수 있다고 보고
   * 읽지 않으면 `undefined`가 수량 자리에 그대로 그려진다.
   */
  it('블라인드 응답의 장부 수량을 보이지 않음(null)으로 읽는다', () => {
    const view = toCountLineView(blindCountLineResponse());

    expect(view.systemQty).toBeNull();
  });

  /* 차이도 같은 방어를 한다 — 계약이 블라인드에서 오는지 말하지 않는다(어긋남 1). */
  it('블라인드 응답의 차이 수량을 보이지 않음(null)으로 읽는다', () => {
    expect(toCountLineView(blindCountLineResponse()).varianceQty).toBeNull();
  });

  /* 짝 방향 — 0은 「없음」이 아니다. `??`로 읽으면 0이 null로 뭉개진다. */
  it('장부·차이 수량이 0이면 0으로 읽는다', () => {
    const view = toCountLineView(countLineResponse({ systemQty: 0, varianceQty: 0, countedQty: 0 }));

    expect(view.systemQty).toBe(0);
    expect(view.varianceQty).toBe(0);
    expect(view.countedQty).toBe(0);
  });

  /*
   * **카운트 시각·담당자를 옮기지 않는다**(계획 결정 9). 타입에 자리를 두지 않으면 그 값이
   * 화면으로 샐 경로도 없다 — 착수 이슈 §4가 「카운트 시각으로는 미실사를 판정할 수 없다」고
   * 밝힌 값이라, 표에 내면 사용자가 실사 여부로 읽는다.
   */
  it('카운트 시각·담당자를 화면 타입에 담지 않는다', () => {
    const view = toCountLineView(countLineResponse());

    expect(Object.keys(view)).not.toContain('countedAt');
    expect(Object.keys(view)).not.toContain('countedBy');
    /* 짝 방향 — 담아야 하는 값은 실제로 담겼다. */
    expect(Object.keys(view)).toContain('countedQty');
  });
});

describe('describeBlindCount', () => {
  /* **읽히는 말로 낸다** — `true`·`false`를 그대로 내면 값이 읽히지 않는다(완료 조건 C18). */
  it('참·거짓을 읽히는 말로 옮긴다', () => {
    expect(describeBlindCount(true)).toBe('예');
    expect(describeBlindCount(false)).toBe('아니오');
  });
});
