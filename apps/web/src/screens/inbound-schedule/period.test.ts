import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { readPeriod, toPeriodQuery, validatePeriod } from './period';

const t = messages.inboundSchedule;

describe('validatePeriod', () => {
  /*
   * **이 화면의 기간은 필수가 아니다.** 계약이 두 날짜를 각각 선택으로 두었고
   * 이 경로는 기간 없이도 조회된다. 「기간이 없으면 조회하지 않는다」 가드를 두면
   * 필수가 아니라는 사실이 화면에서 사라진다.
   */
  it('둘 다 비어 있으면 조회할 수 있다', () => {
    expect(validatePeriod({ from: '', to: '' })).toBeNull();
  });

  it('시작만 채워도 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '' })).toBeNull();
  });

  it('종료만 채워도 조회할 수 있다', () => {
    expect(validatePeriod({ from: '', to: '2026-08-31' })).toBeNull();
  });

  it('둘 다 채우고 순서가 맞으면 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '2026-08-31' })).toBeNull();
  });

  it('같은 날짜는 뒤집힌 것이 아니다', () => {
    expect(validatePeriod({ from: '2026-08-10', to: '2026-08-10' })).toBeNull();
  });

  it('종료가 시작보다 앞서면 사유를 낸다', () => {
    expect(validatePeriod({ from: '2026-08-31', to: '2026-08-01' })).toBe(t.reasons.periodReversed);
  });

  /*
   * **자릿수만 보면 안 된다.** `2026-02-31`은 자릿수가 맞지만 없는 날짜라
   * 그대로 보내면 400이 돌아오고 사용자에게는 「조회가 늘 실패한다」로만 보인다.
   */
  it.each(['2026-02-31', '2026-13-01', '2026-08-32', '2025-02-29'])(
    '없는 날짜(%s)는 사유를 낸다',
    (value) => {
      expect(validatePeriod({ from: value, to: '' })).toBe(t.reasons.periodInvalid);
    },
  );

  it.each(['2026-8-1', '20260801', '오늘', '2026-08-01T00:00:00Z'])(
    '형식이 깨진 값(%s)은 사유를 낸다',
    (value) => {
      expect(validatePeriod({ from: '', to: value })).toBe(t.reasons.periodInvalid);
    },
  );

  /* 윤년은 실제로 있는 날짜다 — 되짚기 판정이 이것을 통과시켜야 한다. */
  it('윤년 2월 29일은 있는 날짜다', () => {
    expect(validatePeriod({ from: '2028-02-29', to: '' })).toBeNull();
  });

  /* 형식 오류가 뒤집힘보다 앞선다 — 고칠 수 있는 것을 먼저 알린다. */
  it('한쪽이 깨졌으면 뒤집힘보다 형식 사유가 앞선다', () => {
    expect(validatePeriod({ from: '2026-02-31', to: '2026-01-01' })).toBe(t.reasons.periodInvalid);
  });
});

describe('toPeriodQuery', () => {
  it('두 날짜를 계약 쿼리 이름으로 옮긴다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-31' })).toEqual({
      expectedArrivalDateFrom: '2026-08-01',
      expectedArrivalDateTo: '2026-08-31',
    });
  });

  /*
   * **빈 값은 키 자체를 만들지 않는다.** 빈 문자열을 실으면 요청 URL에 `…From=`이 남아
   * 서버가 「빈 기간으로 걸렀다」로 받을 수 있고, 요청을 읽는 사람에게도 조건이 있는 것처럼 보인다.
   */
  it('비어 있는 쪽은 키를 만들지 않는다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '' })).toEqual({
      expectedArrivalDateFrom: '2026-08-01',
    });
    expect(toPeriodQuery({ from: '', to: '2026-08-31' })).toEqual({
      expectedArrivalDateTo: '2026-08-31',
    });
  });

  it('둘 다 비어 있으면 빈 쿼리다', () => {
    expect(toPeriodQuery({ from: '', to: '' })).toEqual({});
  });
});

describe('readPeriod', () => {
  it('주소의 두 키를 그대로 읽는다', () => {
    expect(readPeriod(new URLSearchParams('from=2026-08-01&to=2026-08-31'))).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('키가 없으면 빈 값이다', () => {
    expect(readPeriod(new URLSearchParams(''))).toEqual({ from: '', to: '' });
  });

  /*
   * 깨진 값을 여기서 버리지 않는다 — 사용자가 고칠 수 있도록 조건 줄에 그대로 보여야 한다.
   * 요청을 막는 것은 `validatePeriod`의 몫이다.
   */
  it('형식이 깨진 값도 읽어 온다 — 조건 줄이 고칠 수 있어야 한다', () => {
    expect(readPeriod(new URLSearchParams('from=2026-02-31'))).toEqual({
      from: '2026-02-31',
      to: '',
    });
  });
});
