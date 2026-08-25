import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { readPeriod, toPeriodQuery, validatePeriod } from './period';

const t = messages.shipmentSchedule;

describe('validatePeriod', () => {
  /*
   * **이 화면의 출하일 시작은 필수다**(공유계약 L-3) — W-01-09(둘 다 선택)와 반대다.
   */
  it('둘 다 비어 있으면 조회할 수 없다 — 시작일 필수', () => {
    expect(validatePeriod({ from: '', to: '' })).toBe(t.reasons.periodRequired);
  });

  it('종료만 채우고 시작이 비어 있으면 조회할 수 없다', () => {
    expect(validatePeriod({ from: '', to: '2026-08-31' })).toBe(t.reasons.periodRequired);
  });

  it('시작만 채우면 조회할 수 있다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '' })).toBeNull();
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

  /* 자릿수만 보면 안 된다 — `2026-02-31`은 자릿수가 맞지만 없는 날짜다. */
  it.each(['2026-02-31', '2026-13-01', '2026-08-32', '2025-02-29'])(
    '없는 날짜(%s)는 사유를 낸다',
    (value) => {
      expect(validatePeriod({ from: value, to: '' })).toBe(t.reasons.periodInvalid);
    },
  );

  it.each(['2026-8-1', '20260801', '오늘', '2026-08-01T00:00:00Z'])(
    '형식이 깨진 시작값(%s)은 사유를 낸다',
    (value) => {
      expect(validatePeriod({ from: value, to: '' })).toBe(t.reasons.periodInvalid);
    },
  );

  /* 윤년은 실제로 있는 날짜다 — 되짚기 판정이 이것을 통과시켜야 한다. */
  it('윤년 2월 29일은 있는 날짜다', () => {
    expect(validatePeriod({ from: '2028-02-29', to: '' })).toBeNull();
  });

  /* 사유 우선순위: 시작일 없음 → 형식 오류 → 뒤집힘. 지금 고칠 수 있는 것을 먼저 알린다. */
  it('시작이 비어 있으면 다른 사유보다 필수 사유가 앞선다', () => {
    expect(validatePeriod({ from: '', to: '2026-02-31' })).toBe(t.reasons.periodRequired);
  });

  it('시작이 채워지고 종료가 깨졌으면 형식 사유가 뒤집힘보다 앞선다', () => {
    expect(validatePeriod({ from: '2026-08-01', to: '2026-13-01' })).toBe(t.reasons.periodInvalid);
  });
});

describe('toPeriodQuery', () => {
  it('두 날짜를 계약 쿼리 이름으로 옮긴다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '2026-08-31' })).toEqual({
      shipDateFrom: '2026-08-01',
      shipDateTo: '2026-08-31',
    });
  });

  it('종료가 비어 있으면 그 키를 만들지 않는다', () => {
    expect(toPeriodQuery({ from: '2026-08-01', to: '' })).toEqual({
      shipDateFrom: '2026-08-01',
    });
  });
});

describe('readPeriod', () => {
  it('주소의 두 키를 그대로 읽는다', () => {
    expect(
      readPeriod(new URLSearchParams('shipDateFrom=2026-08-01&shipDateTo=2026-08-31')),
    ).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('키가 없으면 빈 값이다', () => {
    expect(readPeriod(new URLSearchParams(''))).toEqual({ from: '', to: '' });
  });

  /* 깨진 값을 여기서 버리지 않는다 — 조건 줄이 고칠 수 있어야 한다. 막는 것은 validatePeriod의 몫이다. */
  it('형식이 깨진 값도 읽어 온다', () => {
    expect(readPeriod(new URLSearchParams('shipDateFrom=2026-02-31'))).toEqual({
      from: '2026-02-31',
      to: '',
    });
  });
});
