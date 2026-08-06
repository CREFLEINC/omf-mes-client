import type { components } from '@omf-mes/api-client';

import type { InspectionItemSpec, ItemDraft } from './types';

type InspectionItemSpecUpsert = components['schemas']['InspectionItemSpecUpsert'];

/**
 * 검사 항목 초안을 다루는 순수 함수들.
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

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. 0과 구분해야 한다. */
const textToOptionalNumber = (value: string): number | null =>
  value === '' ? null : Number(value);

const optionalText = (value: string): string | null => (value === '' ? null : value);

/**
 * 서버 응답을 로컬 초안으로 옮긴다.
 *
 * 순서 값(`sequenceNo`)을 담지 않는다 — 순서는 이 배열의 위치다.
 * 행 식별자는 그대로 보존한다. 전체 치환은 행 교체가 아니라 순서·내용 갱신이며,
 * 식별자를 버리면 측정 기록이 참조하던 행이 무너진다.
 */
export const toItemDrafts = (items: InspectionItemSpec[]): ItemDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.inspectionItemSpecId)}`,
    inspectionItemSpecId: item.inspectionItemSpecId,
    inspectionItemCode: item.inspectionItemCode,
    inspectionItemName: item.inspectionItemName,
    dataTypeCode: item.dataTypeCode,
    uomId: optionalNumberToText(item.uomId),
    targetValue: optionalNumberToText(item.targetValue),
    lowerLimit: optionalNumberToText(item.lowerLimit),
    upperLimit: optionalNumberToText(item.upperLimit),
    measurementCount: String(item.measurementCount),
    inspectionMethodCode: item.inspectionMethodCode ?? '',
    defaultInspectionEquipmentId: optionalNumberToText(item.defaultInspectionEquipmentId),
    requiredFlag: item.requiredFlag,
    automaticJudgment: item.automaticJudgment,
  }));

/**
 * 아직 저장되지 않은 행의 초안 키. 저장된 행(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — 서버로 나가지 않는 값이다.
 */
let newDraftSequence = 0;

/** 새 항목 한 행. 불리언·측정 횟수의 기본값은 계약이 정한 값을 그대로 쓴다. */
export const createItemDraft = (): ItemDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    inspectionItemSpecId: null,
    inspectionItemCode: '',
    inspectionItemName: '',
    dataTypeCode: '',
    uomId: '',
    targetValue: '',
    lowerLimit: '',
    upperLimit: '',
    measurementCount: '1',
    inspectionMethodCode: '',
    defaultInspectionEquipmentId: '',
    requiredFlag: true,
    automaticJudgment: true,
  };
};

/**
 * `from` 위치의 행을 `to`로 옮긴 새 목록.
 *
 * **여기서 서버를 부르지 않는다.** 이동은 초안만 바꾸고 저장은 편집을 마칠 때 한 번뿐이다.
 * 목록 밖으로 나가는 이동(첫 행 위로·마지막 행 아래로)은 받은 목록을 그대로 돌려준다.
 */
export const moveItemDraft = (drafts: ItemDraft[], from: number, to: number): ItemDraft[] => {
  const isOutOfRange =
    from < 0 || from >= drafts.length || to < 0 || to >= drafts.length || from === to;

  if (isOutOfRange) return drafts;

  const next = [...drafts];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) return drafts;

  next.splice(to, 0, moved);

  return next;
};

export const removeItemDraft = (drafts: ItemDraft[], draftId: string): ItemDraft[] =>
  drafts.filter((draft) => draft.draftId !== draftId);

/**
 * 초안 하나를 더하거나 갈아 끼운다.
 * 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 정렬해야 한다.
 */
export const upsertItemDraft = (drafts: ItemDraft[], draft: ItemDraft): ItemDraft[] => {
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
 * 계약이 「id를 생략하면 신규, 포함하면 기존 행 갱신」으로 정했고, 식별자를 버리면
 * 측정 기록이 NOT NULL FK 로 참조하던 행이 무너진다.
 */
export const toItemsPayload = (
  inspectionPlanVersionId: number,
  drafts: ItemDraft[],
): InspectionItemSpecUpsert[] =>
  drafts.map((draft, index) => ({
    ...(draft.inspectionItemSpecId === null
      ? {}
      : { inspectionItemSpecId: draft.inspectionItemSpecId }),
    inspectionPlanVersionId,
    sequenceNo: index + 1,
    // 앞뒤 공백이 붙은 코드·이름은 눈으로 구분되지 않는 다른 값이 된다.
    inspectionItemCode: draft.inspectionItemCode.trim(),
    inspectionItemName: draft.inspectionItemName.trim(),
    dataTypeCode: draft.dataTypeCode,
    uomId: textToOptionalNumber(draft.uomId),
    targetValue: textToOptionalNumber(draft.targetValue),
    lowerLimit: textToOptionalNumber(draft.lowerLimit),
    upperLimit: textToOptionalNumber(draft.upperLimit),
    measurementCount: Number(draft.measurementCount),
    inspectionMethodCode: optionalText(draft.inspectionMethodCode),
    defaultInspectionEquipmentId: textToOptionalNumber(draft.defaultInspectionEquipmentId),
    requiredFlag: draft.requiredFlag,
    automaticJudgment: draft.automaticJudgment,
  }));

const isSameItemDraft = (a: ItemDraft, b: ItemDraft | undefined): boolean =>
  b !== undefined &&
  (Object.keys(a) as (keyof ItemDraft)[]).every((key) => a[key] === b[key]);

/**
 * 「고친 것이 있는가」의 판정 근거. **순서만 달라도 다른 것으로 본다** —
 * 이 화면에서 순서는 보기 방식이 아니라 저장되는 자료다.
 */
export const isSameItemDrafts = (a: ItemDraft[], b: ItemDraft[]): boolean =>
  a.length === b.length && a.every((draft, index) => isSameItemDraft(draft, b[index]));
