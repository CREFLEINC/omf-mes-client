import type { OperationDraft, RoutingOperation } from './types';

/**
 * 공정 라인 초안을 다루는 순수 함수들.
 *
 * **순서 컬럼에는 유일 제약이 있다.** 두 행을 맞바꾸면 중간 상태가 반드시 그 제약을 위반하므로
 * 행 단위 저장이 성립하지 않는다. 그래서 화면은 이동할 때마다 저장하지 않고,
 * 편집을 마칠 때 **최종 순서 전체를 한 번에** 보낸다(공유계약 A-5).
 *
 * 그 규약을 지키려면 순서가 화면 안에서만 움직여야 하고, 이 파일이 그 움직임을 전부 갖는다.
 */

/** 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
const optionalNumberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/**
 * 서버 응답을 로컬 초안으로 옮긴다.
 *
 * 순서 값(`operationSeq`)을 담지 않는다 — 순서는 이 배열의 위치다.
 * 행 식별자는 그대로 보존한다. 전체 치환은 행 교체가 아니라 순서 갱신이며,
 * 식별자를 버리면 진행 중 작업지시가 참조하던 행이 사라진다.
 */
export const toOperationDrafts = (operations: RoutingOperation[]): OperationDraft[] =>
  operations.map((operation) => ({
    draftId: `saved:${String(operation.routingOperationId)}`,
    routingOperationId: operation.routingOperationId,
    processId: String(operation.processId),
    operationName: operation.operationName,
    mesManaged: operation.mesManaged,
    materialInputManaged: operation.materialInputManaged,
    productionResultManaged: operation.productionResultManaged,
    inspectionManaged: operation.inspectionManaged,
    outputLotRequired: operation.outputLotRequired,
    equipmentRequired: operation.equipmentRequired,
    moldRequired: operation.moldRequired,
    standardCycleTimeSec: optionalNumberToText(operation.standardCycleTimeSec),
    // 비율(0~1) 그대로 옮긴다. 퍼센트로 바꾸면 100배 오입력이 조용히 통과한다.
    standardYieldRate: optionalNumberToText(operation.standardYieldRate),
  }));
