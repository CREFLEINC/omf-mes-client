import type { components } from '@omf-mes/api-client';

import type { OperationDraft, RoutingOperation } from './types';

type RoutingOperationUpsert = components['schemas']['RoutingOperationUpsert'];

/**
 * 공정 라인 초안을 다루는 순수 함수들.
 *
 * **순서 컬럼에는 유일 제약이 있다.** 두 행을 맞바꾸면 중간 상태가 반드시 그 제약을 위반하므로
 * 행 단위 저장이 성립하지 않는다. 그래서 화면은 이동할 때마다 저장하지 않고,
 * 편집을 마칠 때 **최종 순서 전체를 한 번에** 보낸다(공유계약 A-5).
 *
 * 그 규약을 지키려면 순서가 화면 안에서만 움직여야 하고, 이 파일이 그 움직임을 전부 갖는다.
 */

/**
 * 관리 플래그 7종의 키. **배열 순서가 곧 표시 순서다** —
 * 표와 편집 창에서 순서가 달라지면 사용자가 같은 항목을 다시 찾아야 한다.
 * 라벨은 i18n(`messages.routing.operationFlags`)이 갖고 여기는 키만 갖는다.
 */
export type OperationFlagKey =
  | 'mesManaged'
  | 'materialInputManaged'
  | 'productionResultManaged'
  | 'inspectionManaged'
  | 'outputLotRequired'
  | 'equipmentRequired'
  | 'moldRequired'
  /* 외주 공정(#231) — 서버는 이미 저장 · 조회한다(물리 칸 `is_subcontract`). 화면도 다른 관리 항목처럼 고친다. */
  | 'isOutsourced';

export const OPERATION_FLAG_KEYS: readonly OperationFlagKey[] = [
  'mesManaged',
  'materialInputManaged',
  'productionResultManaged',
  'inspectionManaged',
  'outputLotRequired',
  'equipmentRequired',
  'moldRequired',
  'isOutsourced',
];

/**
 * 표와 편집 창에 보이는 플래그 — 「검사 관리」는 뺀다. PQC 대상은 공정이 아니라 품목이라(사용자 결정 2026-11-05)
 * 그 값은 PQC 에 쓰이지 않는다. 저장된 값은 저장 본문에 그대로 실어 지우지 않는다.
 */
export const SHOWN_OPERATION_FLAG_KEYS: readonly OperationFlagKey[] = OPERATION_FLAG_KEYS.filter(
  (key) => key !== 'inspectionManaged',
);

/** 널·없음을 빈 문자열로 모은다 — 입력칸의 「지정하지 않음」이 하나의 값이어야 한다. */
const optionalNumberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. 0과 구분해야 한다. */
const textToOptionalNumber = (value: string): number | null =>
  value === '' ? null : Number(value);

/*
 * 표준 수율 — 서버(DB `Decimal(9,6)` · 계약)는 0~1 비율, 화면은 0~100 퍼센트(사용자 지시 · #231).
 * 바꾸는 곳은 이 두 함수뿐이다: 받을 때 ×100, 보낼 때 ÷100. 소수 자릿수를 DB 정밀도(비율 6자리 = 퍼센트 4자리)에서
 * 끊어 0.95 × 100 = 95.00000000000001 같은 부동소수 찌꺼기가 값 · 「고친 것 있음」 판정에 끼지 않게 한다.
 */
export const ratioToPercentText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(Number((value * 100).toFixed(4)));

const percentTextToRatio = (value: string): number | null =>
  value === '' ? null : Number((Number(value) / 100).toFixed(6));

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
    // 서버가 값을 주지 않으면(옛 응답) 외주 아님 — 계약 기본값과 같다.
    isOutsourced: operation.isOutsourced ?? false,
    standardCycleTimeSec: optionalNumberToText(operation.standardCycleTimeSec),
    // 서버 비율(0~1) → 화면 퍼센트(0~100). 입력 · 표 · 검증이 모두 퍼센트로 다룬다.
    standardYieldRate: ratioToPercentText(operation.standardYieldRate),
  }));

/**
 * 아직 저장되지 않은 행의 초안 키. 저장된 행(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — 서버로 나가지 않는 값이다.
 */
let newDraftSequence = 0;

/** 새 공정 한 행. 불리언 기본값은 계약이 정한 값을 그대로 쓴다 — 화면이 다른 값을 정하지 않는다. */
export const createOperationDraft = (): OperationDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    routingOperationId: null,
    processId: '',
    operationName: '',
    mesManaged: true,
    materialInputManaged: false,
    productionResultManaged: true,
    inspectionManaged: false,
    outputLotRequired: false,
    equipmentRequired: false,
    moldRequired: false,
    isOutsourced: false,
    standardCycleTimeSec: '',
    standardYieldRate: '',
  };
};

/**
 * `from` 위치의 행을 `to`로 옮긴 새 목록.
 *
 * **여기서 서버를 부르지 않는다.** 이동은 초안만 바꾸고 저장은 편집을 마칠 때 한 번뿐이다.
 * 목록 밖으로 나가는 이동(첫 행 위로·마지막 행 아래로)은 받은 목록을 그대로 돌려준다.
 */
export const moveDraft = (drafts: OperationDraft[], from: number, to: number): OperationDraft[] => {
  const isOutOfRange =
    from < 0 || from >= drafts.length || to < 0 || to >= drafts.length || from === to;

  if (isOutOfRange) return drafts;

  const next = [...drafts];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) return drafts;

  next.splice(to, 0, moved);

  return next;
};

export const removeDraft = (drafts: OperationDraft[], draftId: string): OperationDraft[] =>
  drafts.filter((draft) => draft.draftId !== draftId);

/**
 * 초안 하나를 더하거나 갈아 끼운다.
 * 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 정렬해야 한다.
 */
export const upsertDraft = (drafts: OperationDraft[], draft: OperationDraft): OperationDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * 순서 값은 **화면이 1부터 연속으로 다시 매긴다.** 서버 채번 값을 되돌려 보내지 않는다.
 * 기존 행은 식별자를 실어 보내고 새 행은 그 키 자체를 넣지 않는다 —
 * 전체 치환은 행 교체가 아니라 순서 갱신이라, 식별자를 버리면 진행 중 작업지시가 참조하던 행이 사라진다.
 *
 * ⭐ **client#603 — 외주 공정(`isOutsourced`)이 2026-08-30 계약에 되살아나 필수가 됐다.**
 * 공정 편집 창의 「외주 공정」 확인칸 값 그대로 싣는다(사용자 지시 · #231 — 서버는 이미 저장 · 조회한다).
 */
export const toOperationsPayload = (
  routingId: number,
  drafts: OperationDraft[],
): RoutingOperationUpsert[] =>
  drafts.map((draft, index) => ({
    ...(draft.routingOperationId === null ? {} : { routingOperationId: draft.routingOperationId }),
    routingId,
    operationSeq: index + 1,
    processId: Number(draft.processId),
    // 앞뒤 공백이 붙은 이름은 눈으로 구분되지 않는 다른 이름이 된다.
    operationName: draft.operationName.trim(),
    mesManaged: draft.mesManaged,
    materialInputManaged: draft.materialInputManaged,
    productionResultManaged: draft.productionResultManaged,
    inspectionManaged: draft.inspectionManaged,
    // 화면에서 고른 값 그대로 — 예전처럼 늘 false 로 보내면 저장된 외주 표시가 지워졌다(#231).
    isOutsourced: draft.isOutsourced,
    outputLotRequired: draft.outputLotRequired,
    equipmentRequired: draft.equipmentRequired,
    moldRequired: draft.moldRequired,
    standardCycleTimeSec: textToOptionalNumber(draft.standardCycleTimeSec),
    // 화면 퍼센트(0~100) → 서버 비율(0~1). 서버 값의 뜻은 그대로다.
    standardYieldRate: percentTextToRatio(draft.standardYieldRate),
  }));

const isSameDraft = (a: OperationDraft, b: OperationDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.routingOperationId === b.routingOperationId &&
  a.processId === b.processId &&
  a.operationName === b.operationName &&
  a.standardCycleTimeSec === b.standardCycleTimeSec &&
  a.standardYieldRate === b.standardYieldRate &&
  OPERATION_FLAG_KEYS.every((key) => a[key] === b[key]);

/**
 * 「고친 것이 있는가」의 판정 근거. **순서만 달라도 다른 것으로 본다** —
 * 이 화면에서 순서는 보기 방식이 아니라 저장되는 자료다.
 */
export const isSameDrafts = (a: OperationDraft[], b: OperationDraft[]): boolean =>
  a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
