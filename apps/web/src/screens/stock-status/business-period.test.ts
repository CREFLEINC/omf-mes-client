import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HISTORY_MONTHS,
  defaultBusinessPeriod,
  isBusinessDate,
  resolveBusinessPeriod,
} from './business-period';

const t = messages.stockStatus;

/** 판정이 「막혔다」일 때의 사유. 갈래를 잘못 읽으면 여기서 드러난다. */
const blockedReason = (from: string, to: string): string | null => {
  const resolved = resolveBusinessPeriod({ from, to });

  return resolved.kind === 'blocked' ? resolved.reason : null;
};

describe('isBusinessDate', () => {
  it('YYYY-MM-DD 형태의 실재하는 날짜만 통과시킨다', () => {
    expect(isBusinessDate('2026-08-06')).toBe(true);
    expect(isBusinessDate('2028-02-29')).toBe(true);
  });

  /*
   * **자릿수만 보면 안 된다.** `2026-02-31`은 형식이 맞지만 없는 날짜라, 통과시키면
   * 그대로 요청에 실려 서버가 400을 준다 — 사용자에게는 「조회가 늘 실패한다」로만 보인다.
   */
  it('없는 날짜를 통과시키지 않는다', () => {
    expect(isBusinessDate('2026-02-31')).toBe(false);
    expect(isBusinessDate('2026-13-01')).toBe(false);
    expect(isBusinessDate('2026-00-10')).toBe(false);
    expect(isBusinessDate('2027-02-29')).toBe(false);
  });

  it('자릿수나 구분자가 다르면 통과시키지 않는다', () => {
    expect(isBusinessDate('')).toBe(false);
    expect(isBusinessDate('2026-8-6')).toBe(false);
    expect(isBusinessDate('2026/08/06')).toBe(false);
    expect(isBusinessDate('20260806')).toBe(false);
    expect(isBusinessDate('2026-08-06T09:12:00+09:00')).toBe(false);
  });
});

describe('defaultBusinessPeriod', () => {
  /* 기본은 **최근 1개월**이다(화면 스펙 §5-4). 오늘이 마지막 날이다. */
  it('오늘을 끝으로 한 달 전부터를 고른다', () => {
    expect(defaultBusinessPeriod(new Date(2026, 7, 10))).toEqual({
      from: '2026-07-10',
      to: '2026-08-10',
    });
  });

  it('해 경계를 넘어간다', () => {
    expect(defaultBusinessPeriod(new Date(2026, 0, 15))).toEqual({
      from: '2025-12-15',
      to: '2026-01-15',
    });
  });

  /*
   * **없는 날짜로 굴러가지 않는다.** 3월 31일의 한 달 전을 `Date`에 그대로 맡기면
   * 2월 31일 → **3월 3일**로 굴러 기간이 한 달이 아니라 28일이 된다.
   * 달의 마지막 날로 눌러야 「최근 1개월」이 실제로 한 달이다.
   */
  it('달의 마지막 날을 넘기지 않는다', () => {
    expect(defaultBusinessPeriod(new Date(2026, 2, 31)).from).toBe('2026-02-28');
  });

  it('윤년의 2월을 알아본다', () => {
    expect(defaultBusinessPeriod(new Date(2028, 2, 31)).from).toBe('2028-02-29');
  });

  /* 만들어 낸 기본값이 스스로 판정을 통과하지 못하면 화면이 열리자마자 막힌다. */
  it('만든 기본값은 그대로 조회할 수 있다', () => {
    for (const today of [new Date(2026, 2, 31), new Date(2026, 0, 1), new Date(2028, 1, 29)]) {
      expect(resolveBusinessPeriod(defaultBusinessPeriod(today)).kind).toBe('ready');
    }
  });

  it('기준 개월 수 상수가 한 곳에 있다', () => {
    expect(DEFAULT_HISTORY_MONTHS).toBe(1);
  });
});

describe('resolveBusinessPeriod', () => {
  it('두 날짜가 성하면 계약 쿼리 이름으로 옮긴다', () => {
    const resolved = resolveBusinessPeriod({ from: '2026-07-10', to: '2026-08-10' });

    expect(resolved).toEqual({
      kind: 'ready',
      query: { businessDateFrom: '2026-07-10', businessDateTo: '2026-08-10' },
    });
  });

  /* 하루짜리 기간은 정상이다 — 그날 하루의 수불을 보는 조회다. */
  it('같은 날짜 하루도 조회할 수 있다', () => {
    expect(resolveBusinessPeriod({ from: '2026-08-06', to: '2026-08-06' }).kind).toBe('ready');
  });

  /*
   * **기간이 없으면 요청을 만들지 않는다**(계획 결정 14). 계약이 `businessDateFrom`·
   * `businessDateTo`를 필수로 두어 빼면 400이다 — 성능이 아니라 가능·불가능의 문제다.
   */
  it('둘 다 비면 막고 사유를 돌려준다', () => {
    expect(blockedReason('', '')).toBe(t.reasons.historyNeedsPeriod);
  });

  /* **둘 다 필수다** — W-01-09와 다르다(그 화면은 한쪽만으로도 조회한다). */
  it('한쪽만 채운 기간으로는 조회하지 않는다', () => {
    expect(blockedReason('2026-07-10', '')).toBe(t.reasons.historyNeedsPeriod);
    expect(blockedReason('', '2026-08-10')).toBe(t.reasons.historyNeedsPeriod);
  });

  it('없는 날짜는 형식이 맞아도 막는다', () => {
    expect(blockedReason('2026-02-31', '2026-08-10')).toBe(t.reasons.historyNeedsPeriod);
    expect(blockedReason('2026-07-10', '2026-06-31')).toBe(t.reasons.historyNeedsPeriod);
  });

  /* 뒤집힌 기간은 서버가 0건으로 답하거나 거부한다 — 어느 쪽이든 사용자가 원한 조회가 아니다. */
  it('끝이 시작보다 앞서면 막고 다른 사유를 돌려준다', () => {
    const reason = blockedReason('2026-08-10', '2026-07-10');

    expect(reason).toBe(t.reasons.historyPeriodReversed);
    /* 사유가 갈려야 사용자가 무엇을 고칠지 안다. */
    expect(reason).not.toBe(t.reasons.historyNeedsPeriod);
  });

  /* 깨진 날짜와 뒤집힘이 겹치면 **고칠 것이 먼저인 쪽**을 말한다 — 없는 날짜부터다. */
  it('깨진 날짜가 뒤집힘보다 앞선다', () => {
    expect(blockedReason('2026-02-31', '2026-01-01')).toBe(t.reasons.historyNeedsPeriod);
  });
});
