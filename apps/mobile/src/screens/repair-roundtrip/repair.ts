import type { ApiError, components } from '@omf-mes/api-client';

export type DefectRecord = components['schemas']['DefectRecord'];
export type RepairExecution = components['schemas']['RepairExecution'];
export type RepairExecutionCreate = components['schemas']['RepairExecutionCreate'];
export type RepairExecutionReturn = components['schemas']['RepairExecutionReturn'];

export const SUCCEEDED = 'SUCCEEDED';
export const FAILED = 'FAILED';

export type RepairResult = typeof SUCCEEDED | typeof FAILED;

/**
 * 불량 조회가 요구하는 기간의 길이.
 *
 * 계약이 기간을 비울 수 없게 해 두었는데, 스캔은 언제 난 불량인지 모른 채 들어온다. 창을
 * 짧게 잡으면 창 밖의 불량이 불량이 아닌 것으로 보이므로 넉넉히 잡고, 창의 길이를 화면이
 * 함께 말한다.
 */
export const DEFECT_WINDOW_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DefectWindow {
  from: string;
  to: string;
}

export const defectWindow = (now: Date, days = DEFECT_WINDOW_DAYS): DefectWindow => ({
  from: new Date(now.getTime() - days * MS_PER_DAY).toISOString(),
  to: new Date(now.getTime() + MS_PER_DAY).toISOString(),
});

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive' | 'overDefect';

/**
 * 적어 넣은 수리 수량이 쓸 수 있는 값인가.
 *
 * 불량 수량보다 많이 수리할 수는 없다. 넘겨 보내면 서버가 막지만, 그때는 이미 스캔을 놓고
 * 온 뒤라 현장이 다시 돌아와야 한다.
 */
export const qtyProblem = (defect: DefectRecord, text: string): QtyProblem | null => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return 'empty';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value <= 0) {
    return 'notPositive';
  }

  return value > defect.defectQty ? 'overDefect' : null;
};

/** 이 불량에 아직 닫히지 않은 수리 건. 있으면 같은 불량을 두 번 투입하는 것이다. */
export const openFor = (
  executions: RepairExecution[],
  defectRecordId: number,
): RepairExecution | null =>
  executions.find(
    (execution) =>
      execution.defectRecordId === defectRecordId &&
      (execution.returnedAt === null || execution.returnedAt === undefined),
  ) ?? null;

export interface DispatchDraft {
  defect: DefectRecord;
  qty: string;
  openExecutions: RepairExecution[];
}

export const canDispatch = (draft: DispatchDraft, hasWorker: boolean): boolean => {
  if (!hasWorker) {
    return false;
  }

  if (openFor(draft.openExecutions, draft.defect.defectRecordId) !== null) {
    return false;
  }

  return qtyProblem(draft.defect, draft.qty) === null;
};

export const canReturn = (
  execution: RepairExecution | null,
  result: RepairResult | null,
  hasWorker: boolean,
): boolean => execution !== null && result !== null && hasWorker;

export const toDispatchBody = (
  defect: DefectRecord,
  qty: string,
  startedAt: string,
): RepairExecutionCreate => ({
  defectRecordId: defect.defectRecordId,
  /*
   * 단위는 불량 기록의 것을 그대로 옮긴다. 화면이 고르게 두면 불량 수량과 수리 수량이 다른
   * 단위로 남아 두 값을 견줄 수 없다.
   */
  uomId: defect.uomId,
  startedAt,
  repairQty: Number(qty.trim()),
});

export const toReturnBody = (returnedAt: string, result: RepairResult): RepairExecutionReturn => ({
  returnedAt,
  repairResultCode: result,
});

/**
 * 서버가 되돌린 것이 이 불량에 열린 수리 건이 이미 있다는 뜻인가.
 *
 * 이 경로의 충돌은 그 하나뿐이라 상태 코드로 가른다. 다른 실패와 같은 말을 쓰면 현장은 다시
 * 시도하면 되는 줄 알고 같은 스캔을 되풀이한다.
 */
export const isAlreadyOpen = (error: ApiError): boolean =>
  error.kind === 'conflict' || (error.kind === 'http' && error.status === 409);
