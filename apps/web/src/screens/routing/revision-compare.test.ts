import { describe, expect, it } from 'vitest';

import { routingOperationFixtures } from './fixtures';
import { compareOperations } from './revision-compare';
import { toHistoryRow } from './revision-history';

const [first, second] = routingOperationFixtures as [
  (typeof routingOperationFixtures)[number],
  (typeof routingOperationFixtures)[number],
];

describe('compareOperations (#231)', () => {
  it('같은 공정끼리 짝짓고 추가 · 삭제 · 변경 · 같음을 가른다', () => {
    const rows = compareOperations(
      [first, second],
      [
        { ...first, standardCycleTimeSec: 50 },
        { ...second, processId: 9999, operationSeq: 30 },
      ],
    );

    expect(rows.map((row) => [row.processId, row.status])).toEqual([
      [9001, 'changed'],
      [9002, 'removed'],
      [9999, 'added'],
    ]);
    expect(rows[0]?.changes).toEqual([{ label: '표준 C/T(초)', before: '45', after: '50' }]);
  });

  it('순서만 바뀌어도 변경으로 잡는다', () => {
    const rows = compareOperations(
      [first, second],
      [
        { ...second, operationSeq: 10 },
        { ...first, operationSeq: 20 },
      ],
    );

    expect(rows.every((row) => row.status === 'changed')).toBe(true);
    expect(rows[0]?.changes).toEqual([{ label: '순서', before: '1', after: '2' }]);
  });
});

describe('toHistoryRow (#231)', () => {
  const label = (processId: string) => `P${processId}`;
  const event = (
    eventTypeCode: string,
    beforeValue: Record<string, unknown> | null,
    afterValue: Record<string, unknown> | null,
  ) => ({
    auditEventId: 1,
    occurredAt: '2026-11-05T02:35:06.879Z',
    eventTypeCode,
    beforeValue,
    afterValue,
    performedBy: 1,
  });

  it('구분은 바뀐 내용으로 정한다 — 확정 · 기본 지정 · 신규 Rev · 기본 정보', () => {
    expect(
      toHistoryRow(event('UPDATE', { statusCode: 'DRAFT' }, { statusCode: 'CONFIRMED' }), label)
        .action,
    ).toBe('확정');
    expect(
      toHistoryRow(event('UPDATE', { isDefault: false }, { isDefault: true }), label).action,
    ).toBe('기본 지정');
    expect(
      toHistoryRow(event('CREATE', null, { routingVersion: 3, copiedFromRoutingId: 5 }), label)
        .action,
    ).toBe('신규 Rev 발행');
    const header = toHistoryRow(event('UPDATE', { routingCode: 'A' }, { routingCode: 'B' }), label);
    expect(header.action).toBe('기본 정보 수정');
    expect(header.changes).toEqual([{ label: 'Routing 코드', before: 'A', after: 'B' }]);
  });

  it('공정 구성 저장은 공정마다 추가 · 삭제 · 변경을 한 줄씩 낸다', () => {
    const row = toHistoryRow(
      event('UPDATE', { operations: [first] }, { operations: [first, second] }),
      label,
    );

    expect(row.action).toBe('공정 구성 수정');
    expect(row.changes).toEqual([{ label: 'P9002', note: 'added' }]);
  });
});
