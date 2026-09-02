import { describe, expect, it } from 'vitest';

import {
  DEFECT_WINDOW_DAYS,
  FAILED,
  SUCCEEDED,
  canDispatch,
  canReturn,
  defectWindow,
  isAlreadyOpen,
  openFor,
  qtyProblem,
  toDispatchBody,
  toReturnBody,
  type DefectRecord,
  type RepairExecution,
} from './repair';

const defect = (overrides: Partial<DefectRecord> = {}): DefectRecord => ({
  defectRecordId: 501,
  workOrderId: 88,
  lotId: 4,
  defectCodeId: 12,
  defectQty: 40,
  uomId: 9,
  occurrenceProcessId: 3,
  detectionProcessId: 4,
  detectedAt: '2026-08-12T10:22:00+09:00',
  ...overrides,
});

const execution = (overrides: Partial<RepairExecution> = {}): RepairExecution => ({
  repairExecutionId: 1001,
  defectRecordId: 501,
  startedAt: '2026-09-01T08:14:00+09:00',
  repairQty: 20,
  uomId: 9,
  ...overrides,
});

describe('수리 수량', () => {
  it('적지 않았거나 숫자가 아니면 쓸 수 없다', () => {
    expect(qtyProblem(defect(), '')).toBe('empty');
    expect(qtyProblem(defect(), '   ')).toBe('empty');
    expect(qtyProblem(defect(), '스물')).toBe('notNumber');
  });

  it('0 이하는 쓸 수 없다', () => {
    expect(qtyProblem(defect(), '0')).toBe('notPositive');
    expect(qtyProblem(defect(), '-3')).toBe('notPositive');
  });

  /* 불량 수량보다 많이 수리할 수는 없다. 서버가 막아도 그때는 스캔 자리를 떠난 뒤다. */
  it('불량 수량을 넘으면 쓸 수 없고 같은 값까지는 쓸 수 있다', () => {
    expect(qtyProblem(defect(), '41')).toBe('overDefect');
    expect(qtyProblem(defect(), '40')).toBeNull();
    expect(qtyProblem(defect(), '20')).toBeNull();
  });
});

describe('열린 수리 건', () => {
  /* 반출 시각이 비어 있는 것이 아직 수리 중인 건이다. 상태 컬럼으로 가르지 않는다. */
  it('반출 시각이 없는 건만 열린 것으로 본다', () => {
    const closed = execution({ repairExecutionId: 1002, returnedAt: '2026-09-01T11:40:00+09:00' });

    expect(openFor([closed], 501)).toBeNull();
    expect(openFor([closed, execution()], 501)?.repairExecutionId).toBe(1001);
  });

  it('다른 불량의 열린 건을 이 불량의 것으로 보지 않는다', () => {
    expect(openFor([execution({ defectRecordId: 777 })], 501)).toBeNull();
  });
});

describe('투입 조건', () => {
  const draft = { defect: defect(), qty: '20', openExecutions: [] };

  it('사번과 쓸 수 있는 수량이 있으면 투입할 수 있다', () => {
    expect(canDispatch(draft, true)).toBe(true);
  });

  /* 누가 한 일인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 투입할 수 없다', () => {
    expect(canDispatch(draft, false)).toBe(false);
  });

  it('수량이 쓸 수 없으면 투입할 수 없다', () => {
    expect(canDispatch({ ...draft, qty: '41' }, true)).toBe(false);
  });

  /* 같은 불량을 두 번 투입하면 왕복이 둘로 갈라져 어느 쪽이 닫혔는지 알 수 없다. */
  it('이미 열린 수리 건이 있으면 투입할 수 없다', () => {
    expect(canDispatch({ ...draft, openExecutions: [execution()] }, true)).toBe(false);
  });
});

describe('반출 조건', () => {
  it('투입 건과 결과와 사번이 다 있어야 반출할 수 있다', () => {
    expect(canReturn(execution(), SUCCEEDED, true)).toBe(true);
    expect(canReturn(null, SUCCEEDED, true)).toBe(false);
    expect(canReturn(execution(), null, true)).toBe(false);
    expect(canReturn(execution(), SUCCEEDED, false)).toBe(false);
  });
});

describe('요청 본문', () => {
  it('투입은 불량 기록의 단위를 그대로 옮긴다', () => {
    expect(toDispatchBody(defect(), ' 20 ', '2026-09-01T08:14:00.000Z')).toEqual({
      defectRecordId: 501,
      uomId: 9,
      startedAt: '2026-09-01T08:14:00.000Z',
      repairQty: 20,
    });
  });

  /* 수리를 공정으로 둘지가 정해지지 않아 계약이 비워 둘 수 있게 했다. */
  it('투입은 수리 공정을 싣지 않는다', () => {
    expect(Object.keys(toDispatchBody(defect(), '20', '2026-09-01T08:14:00.000Z'))).toEqual([
      'defectRecordId',
      'uomId',
      'startedAt',
      'repairQty',
    ]);
  });

  it('반출은 시각과 결과만 싣는다', () => {
    expect(toReturnBody('2026-09-01T11:40:00.000Z', FAILED)).toEqual({
      returnedAt: '2026-09-01T11:40:00.000Z',
      repairResultCode: FAILED,
    });
  });
});

describe('불량 조회 기간', () => {
  /* 창이 짧으면 창 밖의 불량이 불량 아닌 것으로 보인다. */
  it('지금을 기준으로 정해진 길이만큼 거슬러 잡는다', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    const window = defectWindow(now);

    expect(new Date(window.from).toISOString()).toBe('2026-03-05T00:00:00.000Z');
    expect(new Date(window.to).getTime()).toBeGreaterThan(now.getTime());
    expect(DEFECT_WINDOW_DAYS).toBe(180);
  });
});

describe('충돌 판정', () => {
  /* 다시 시도해서 풀리는 실패와 같은 말을 쓰면 현장이 같은 스캔을 되풀이한다. */
  it('열린 수리 건이 이미 있다는 응답을 다른 실패와 가른다', () => {
    expect(isAlreadyOpen({ kind: 'http', status: 409 })).toBe(true);
    expect(isAlreadyOpen({ kind: 'http', status: 500 })).toBe(false);
    expect(isAlreadyOpen({ kind: 'network' })).toBe(false);
  });
});
