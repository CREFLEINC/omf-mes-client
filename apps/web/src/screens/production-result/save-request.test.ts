import { describe, expect, it } from 'vitest';

import { RESULT_SOURCE_CODE } from './codes';
import { buildSaveBody, type SaveInput } from './save-request';
import { emptyResultDraft } from './types';

const input = (patch: Partial<SaveInput> = {}): SaveInput => ({
  workOrderId: 1001,
  lotId: 2002,
  uomId: 3003,
  draft: emptyResultDraft,
  goodQty: 120,
  occurredAt: '2026-09-02T09:12:00+09:00',
  ...patch,
});

describe('buildSaveBody — 보내는 것', () => {
  it('작업지시·양품수량·단위·발생 시각을 그대로 싣는다', () => {
    const body = buildSaveBody(input());

    expect(body.workOrderId).toBe(1001);
    expect(body.goodQty).toBe(120);
    expect(body.uomId).toBe(3003);
    expect(body.occurredAt).toBe('2026-09-02T09:12:00+09:00');
  });

  it('실적 원천은 자리표시 상수 한 곳에서만 온다', () => {
    expect(buildSaveBody(input()).resultSourceCode).toBe(RESULT_SOURCE_CODE);
  });

  it('LOT 배분을 본문에 싣는다 — 배분 수량은 이번 양품수량이다', () => {
    expect(buildSaveBody(input()).lotAllocations).toEqual([{ lotId: 2002, allocatedQty: 120 }]);
  });

  it('비고는 적었을 때만 실린다 — 빈 문자열을 보내지 않는다', () => {
    expect(buildSaveBody(input()).remarks).toBeUndefined();
    expect(buildSaveBody(input({ draft: { goodQty: '', remarks: '  ' } })).remarks).toBeUndefined();
    expect(buildSaveBody(input({ draft: { goodQty: '', remarks: ' 재작업분 ' } })).remarks).toBe(
      '재작업분',
    );
  });
});

describe('buildSaveBody — 보내지 «않는» 것', () => {
  /**
   * ⛔ 이 목록이 이 화면의 절반이다. 하나라도 새어 나가면 화면은 정상으로 보이고 기록만 틀린다.
   */
  const forbidden = [
    'workerId',
    'terminalId',
    'shiftId',
    'shotCount',
    'defectQty',
    'holdQty',
    'scrapQty',
    'reworkQty',
    'lateEntryReasonCode',
    'resultSequence',
  ];

  it.each(forbidden)('%s 를 싣지 않는다', (field) => {
    const body: Record<string, unknown> = buildSaveBody(
      input({ draft: { goodQty: '120', remarks: '비고' } }),
    );

    expect(Object.keys(body)).not.toContain(field);
  });
});
