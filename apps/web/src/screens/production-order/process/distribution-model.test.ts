import { describe, expect, it } from 'vitest';
import { distributePlans } from './distribution-model';
const options = { start: '2026-11-02', end: '2026-11-03', lineId: '31', dailyQty: 100 };
describe('복수 오더 자동 분배', () => {
  it('같은 날짜·라인 상한을 공유하며 기존 계획과 전체 수량을 보존한다', () => {
    const result = distributePlans(
      [
        { id: 'A', remaining: 120 },
        { id: 'B', remaining: 100 },
      ],
      options,
      [{ planDate: '2026-11-02', plannedLineId: '31', plannedQty: '30' }],
    );
    expect(result.drafts).toEqual([
      { owner: 'A', planDate: '2026-11-02', plannedLineId: '31', plannedQty: '70' },
      { owner: 'A', planDate: '2026-11-03', plannedLineId: '31', plannedQty: '50' },
      { owner: 'B', planDate: '2026-11-03', plannedLineId: '31', plannedQty: '50' },
    ]);
    expect(result.pending).toBe(50);
    expect(
      result.drafts.reduce((sum, row) => sum + Number(row.plannedQty), 0) + result.pending,
    ).toBe(220);
  });
  it('이전 분배 결과가 이미 편성되어 있으면 중복 분배하지 않는다', () => {
    const first = distributePlans([{ id: 'A', remaining: 150 }], options);
    expect(distributePlans([{ id: 'A', remaining: 0 }], options, first.drafts).drafts).toEqual([]);
  });
  it('다른 라인의 계획은 선택 라인의 상한을 소비하지 않는다', () => {
    expect(
      distributePlans([{ id: 'A', remaining: 200 }], options, [
        { planDate: '2026-11-02', plannedLineId: '32', plannedQty: '999' },
      ]).pending,
    ).toBe(0);
  });
  it.each([
    { ...options, dailyQty: 0 },
    { ...options, start: '2026-02-30' },
    { ...options, end: '2026-01-01' },
    { ...options, lineId: '' },
  ])('잘못된 조건을 거부한다: %j', (invalid) => {
    expect(() => distributePlans([{ id: 'A', remaining: 100 }], invalid)).toThrow();
  });
});
