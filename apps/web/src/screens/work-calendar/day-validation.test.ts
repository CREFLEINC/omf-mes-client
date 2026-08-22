import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { DAY_FORM_FIELDS, validateDay } from './day-validation';
import type { DayFormValues } from './types';

const t = messages.workCalendar.dayValidation;

const make = (overrides: Partial<DayFormValues> = {}): DayFormValues => ({
  dayTypeCode: 'WORKING',
  startTime: '',
  endTime: '',
  reasonCode: '',
  remarks: '',
  ...overrides,
});

describe('validateDay — 구분', () => {
  it('구분을 고르지 않으면 막는다', () => {
    expect(validateDay(make({ dayTypeCode: '' })).dayTypeCode).toBe(t.dayTypeRequired);
  });

  it.each(['WORKING', 'HOLIDAY'])('%s 는 시각을 요구하지 않는다', (code) => {
    expect(validateDay(make({ dayTypeCode: code }))).toEqual({});
  });
});

describe('validateDay — 부분 가동의 짝 제약', () => {
  /*
   * ⭐ **부분 가동은 휴무가 아니다** — 반일 근무를 담는 갈래라 시각 두 칸이 짝이다.
   * 하나만 있으면 조업시간을 아무도 셀 수 없다.
   */
  it('시각 두 칸을 함께 요구한다', () => {
    const errors = validateDay(make({ dayTypeCode: 'PARTIAL' }));

    expect(errors.startTime).toBe(t.timesRequired);
    expect(errors.endTime).toBe(t.timesRequired);
  });

  it.each([[{ startTime: '08:00' }], [{ endTime: '12:00' }]])(
    '한쪽만 있으면 나머지를 요구한다 %s',
    (overrides) => {
      const errors = validateDay(make({ dayTypeCode: 'PARTIAL', ...overrides }));

      expect(Object.keys(errors)).toHaveLength(1);
      expect(Object.values(errors)[0]).toBe(t.timesRequired);
    },
  );

  it.each(['8:00', '08:0', '24:00', '08:60', '오전 8시', '0800'])(
    '%s 는 시각 모양이 아니다',
    (value) => {
      expect(
        validateDay(make({ dayTypeCode: 'PARTIAL', startTime: value, endTime: '12:00' })).startTime,
      ).toBe(t.timeFormat);
    },
  );

  it('맞는 모양은 통과한다', () => {
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '08:00', endTime: '12:00' })),
    ).toEqual({});
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '00:00', endTime: '23:59' })),
    ).toEqual({});
  });

  /* ⛔ 길이가 0인 조업시간은 부분 가동이 아니라 휴무다. */
  it('종료가 시작과 같으면 막는다', () => {
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '08:00', endTime: '08:00' })).endTime,
    ).toBe(t.endAfterStart);
  });

  it('종료가 시작보다 빠르면 막는다', () => {
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '12:00', endTime: '08:00' })).endTime,
    ).toBe(t.endAfterStart);
  });

  /* 시각 비교가 글자 차례에 기대므로 자릿수가 다른 경계를 함께 본다. */
  it('한 자리 차이도 가른다', () => {
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '09:59', endTime: '10:00' })),
    ).toEqual({});
    expect(
      validateDay(make({ dayTypeCode: 'PARTIAL', startTime: '10:00', endTime: '09:59' })).endTime,
    ).toBe(t.endAfterStart);
  });

  /* ⛔ 사유는 계약이 선택으로 두었다 — 재지 않는다. */
  it('사유와 비고를 재지 않는다', () => {
    expect(validateDay(make({ dayTypeCode: 'HOLIDAY', reasonCode: '', remarks: '' }))).toEqual({});
  });
});

describe('DAY_FORM_FIELDS', () => {
  it('폼 값의 이름과 정확히 같은 다섯이다', () => {
    expect([...DAY_FORM_FIELDS].sort()).toEqual(Object.keys(make()).sort());
  });
});
