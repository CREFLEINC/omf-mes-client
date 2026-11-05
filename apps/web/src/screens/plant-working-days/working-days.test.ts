import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  currentPolicy,
  isWorkingDay,
  nextMonday,
  previousWorkingDay,
  sameDayPolicy,
  todayIn,
  toWorkingDays,
} from './working-days';

const policy = (
  operationPolicyId: number,
  plantId: number,
  effectiveFrom: string,
  value: number,
) => ({
  operationPolicyId,
  policyCode: 'WEEKLY_WORKING_DAYS' as components['schemas']['OperationPolicy']['policyCode'],
  plantId,
  valueNumeric: value,
  effectiveFrom,
});

describe('공장 근무일 계산(W-CO-15 예시 열)', () => {
  it('주 5일제는 토 · 일, 주 6일제는 일만 쉰다', () => {
    expect(isWorkingDay('2026-11-07', 5)).toBe(false);
    expect(isWorkingDay('2026-11-07', 6)).toBe(true);
    expect(isWorkingDay('2026-11-08', 6)).toBe(false);
    expect(isWorkingDay('2026-11-06', 5)).toBe(true);
  });

  it('월요일 생산의 출고 작업일 — 5일제는 전주 금(토 · 일을 건너뜀), 6일제는 전주 토(일을 건너뜀)', () => {
    expect(previousWorkingDay('2026-11-09', 5)).toEqual({
      date: '2026-11-06',
      skipped: ['2026-11-08', '2026-11-07'],
    });
    expect(previousWorkingDay('2026-11-09', 6)).toEqual({
      date: '2026-11-07',
      skipped: ['2026-11-08'],
    });
  });

  it('화요일 생산은 둘 다 월요일이고 건너뛴 날이 없다', () => {
    expect(previousWorkingDay('2026-11-10', 5)).toEqual({ date: '2026-11-09', skipped: [] });
    expect(previousWorkingDay('2026-11-10', 6)).toEqual({ date: '2026-11-09', skipped: [] });
  });

  it('예시 생산일은 오늘 다음의 월요일이다(월요일이면 다음 주)', () => {
    expect(nextMonday('2026-11-03')).toBe('2026-11-09');
    expect(nextMonday('2026-11-09')).toBe('2026-11-16');
    expect(nextMonday('2026-11-08')).toBe('2026-11-09');
  });

  it('공장 시간대의 오늘을 쓰고, IANA 이름이 아니면 브라우저 날짜로 둔다', () => {
    const now = new Date('2026-11-03T20:00:00Z');
    expect(todayIn('Asia/Seoul', now)).toBe('2026-11-04');
    expect(todayIn('Asia/Ho_Chi_Minh', now)).toBe('2026-11-04');
    expect(todayIn('STANDARD', now)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('공장 근무일 정책 고르기', () => {
  const rows = [
    policy(1, 8401, '2026-10-01', 6),
    policy(2, 8401, '2026-10-15', 5),
    policy(3, 8401, '2026-12-01', 6),
    policy(4, 8402, '2026-11-03', 6),
  ];

  it('오늘 적용되는 행은 시작일이 가장 늦은 지난 행이다(앞으로 시작할 행은 아니다)', () => {
    expect(currentPolicy(rows, 8401, '2026-11-03')?.operationPolicyId).toBe(2);
    expect(currentPolicy(rows, 8403, '2026-11-03')).toBeUndefined();
  });

  it('US7-1 행이 없거나 값이 6 이 아니면 주 5일제로 본다', () => {
    expect(toWorkingDays(undefined)).toBe(5);
    expect(toWorkingDays(null)).toBe(5);
    expect(toWorkingDays(6)).toBe(6);
  });

  it('오늘 시작한 행이 있으면 그 행을 고칠 대상으로 고른다', () => {
    expect(sameDayPolicy(rows, 8402, '2026-11-03')?.operationPolicyId).toBe(4);
    expect(sameDayPolicy(rows, 8401, '2026-11-03')).toBeUndefined();
  });
});
