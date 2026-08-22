import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { validateBulkRange } from './bulk-validation';
import type { BulkFormValues } from './types';

const t = messages.workCalendar.bulkValidation;

const make = (overrides: Partial<BulkFormValues> = {}): BulkFormValues => ({
  from: '2026-08-01',
  to: '2026-08-31',
  weekdays: [],
  day: { dayTypeCode: 'HOLIDAY', startTime: '', endTime: '', reasonCode: '', remarks: '' },
  ...overrides,
});

describe('validateBulkRange', () => {
  it('바른 기간은 오류가 없다', () => {
    expect(validateBulkRange(make())).toEqual({});
  });

  it.each(['from', 'to'] as const)('%s 가 비면 막는다', (field) => {
    expect(validateBulkRange(make({ [field]: '' }))[field]).toBe(t.rangeRequired);
  });

  it.each(['2026-8-1', '20260801', '내일'])('%s 는 날짜 모양이 아니다', (value) => {
    expect(validateBulkRange(make({ from: value })).from).toBe(t.dateFormat);
  });

  it('종료가 시작보다 빠르면 막는다', () => {
    expect(validateBulkRange(make({ from: '2026-08-10', to: '2026-08-01' })).to).toBe(
      t.endAfterStart,
    );
  });

  /* 하루짜리 기간은 정상이다 — 「이 날 하나만 바꾼다」도 일괄의 한 갈래다. */
  it('시작과 종료가 같아도 통과한다', () => {
    expect(validateBulkRange(make({ from: '2026-08-15', to: '2026-08-15' }))).toEqual({});
  });

  /* ⛔ 요일은 재지 않는다 — 비어 있으면 「기간 전체」라는 뜻이다. */
  it('요일을 고르지 않아도 막지 않는다', () => {
    expect(validateBulkRange(make({ weekdays: [] }))).toEqual({});
  });
});
