import { describe, expect, it } from 'vitest';

import { toPostRequest } from './post-request';

/** 고른 품의의 출고 일시. **영업일이 여기서 나온다** — 실행 시각이 아니다. */
const ISSUE = { issuedAt: '2026-08-08T14:20:00+09:00' };

/** 제출 순간. 출고 일시와 **날짜가 다르다** — 두 값이 섞이면 곧바로 드러난다. */
const NOW = new Date('2026-08-11T09:30:00+09:00');

describe('toPostRequest — 전기 본문', () => {
  /** 계약의 `PostRequest`는 **두 값뿐**이다. 더 실으면 서버가 모르는 필드가 나간다. */
  it('영업일과 발생 시각 둘만 싣는다', () => {
    expect(Object.keys(toPostRequest({ issue: ISSUE, now: NOW })).sort()).toEqual([
      'businessDate',
      'occurredAt',
    ]);
  });

  /**
   * **영업일은 그 전표의 출고 일시에서 나온다**(감지기 M71).
   *
   * 실행 시각의 날짜를 쓰면 어제 낸 전표를 오늘 처리할 때 **원장이 오늘 자로 잡힌다** —
   * 산출 규칙(야간조 경계 등)이 정의되지 않은 자리라 화면이 지어내지 않고 전표를 따른다.
   */
  it('영업일이 출고 일시의 날짜이고 실행 시각의 날짜가 아니다', () => {
    const body = toPostRequest({ issue: ISSUE, now: NOW });

    expect(body.businessDate).toBe('2026-08-08');
    expect(body.businessDate).not.toBe('2026-08-11');
  });

  /** 발생 시각은 **제출 순간**이다(공유계약 C-1). 출고 일시를 되비추지 않는다. */
  it('발생 시각이 제출 순간이고 offset이 붙는다', () => {
    const body = toPostRequest({ issue: ISSUE, now: NOW });

    expect(body.occurredAt).toMatch(/^2026-08-11T09:30:00[+-]\d{2}:\d{2}$/);
    expect(body.occurredAt).not.toBe(ISSUE.issuedAt);
  });

  /**
   * 자정 직전의 전표. **날짜 조각을 그대로 떼어 쓴다** — 시각으로 반올림하거나 UTC로 옮기면
   * 하루가 밀린다.
   */
  it('자정 가까운 출고 일시에서도 그날의 날짜를 그대로 쓴다', () => {
    const body = toPostRequest({
      issue: { issuedAt: '2026-08-08T23:59:00+09:00' },
      now: NOW,
    });

    expect(body.businessDate).toBe('2026-08-08');
  });

  /**
   * **표기 전제를 고정한다**(리뷰 t5 M1). 영업일은 **응답 문자열의 앞 10자**이고, 그 값이
   * 업무의 영업일과 같다는 것은 **서버가 로컬 오프셋으로 준다는 전제**에 기댄다.
   *
   * 계약은 그 표기를 보장하지 않는다(`format: date-time`뿐 · 다른 자원에는 `Z` 예시도 있다).
   * 여기서 **UTC 표기의 현재 동작을 값으로 못 박아** 두면, 서버가 표기를 바꾸는 순간 이
   * 잣대가 **먼저 운다** — 그때 원장 일자가 조용히 하루 밀리는 것보다 훨씬 싸다.
   */
  it('UTC 표기로 오면 그 문자열의 앞 10자를 그대로 쓴다', () => {
    /* 로컬(+09:00)로는 2026-08-09 02:00이지만 UTC 표기로는 앞 10자가 하루 앞이다. */
    const body = toPostRequest({ issue: { issuedAt: '2026-08-08T17:00:00Z' }, now: NOW });

    expect(body.businessDate).toBe('2026-08-08');
  });

  /** 오프셋이 무엇이든 **해석하지 않는다** — 앞 10자가 그대로 영업일이다(전제 그대로). */
  it('오프셋이 달라도 문자열의 날짜 조각을 해석 없이 쓴다', () => {
    expect(
      toPostRequest({ issue: { issuedAt: '2026-08-08T23:30:00-05:00' }, now: NOW }).businessDate,
    ).toBe('2026-08-08');
  });

  /** 같은 전표를 두 시점에 처리해도 **영업일은 그대로**다 — 전표가 정본이다. */
  it('제출 시각이 달라져도 영업일은 바뀌지 않는다', () => {
    const first = toPostRequest({ issue: ISSUE, now: new Date('2026-08-11T09:30:00+09:00') });
    const second = toPostRequest({ issue: ISSUE, now: new Date('2026-09-01T18:05:00+09:00') });

    expect(first.businessDate).toBe(second.businessDate);
    expect(first.occurredAt).not.toBe(second.occurredAt);
  });
});
