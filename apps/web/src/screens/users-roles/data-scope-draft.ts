import type { UserDataScope } from './types';

/**
 * 데이터 접근범위의 초안과 치환 본문.
 *
 * **전체 치환이다.** 줄을 더하고 지우는 것은 표에만 반영되고, 「저장」에서 최종 목록이
 * 한 번에 나간다 — 계약이 개별 부여·회수 경로를 두지 않았다.
 *
 * **빈 축은 「고르지 않음」이 아니라 고른 값이다** — 그 축 전체를 뜻한다(공유계약 A-7).
 * 그래서 표에는 「(전체)」로 적고 저장 본문에는 널을 **명시해** 싣는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 치환 본문의 항목 하나. **계약의 요청 항목은 두 축뿐이고 식별자가 없다** —
 * `userDataScopeId`도 `appUserId`도 담지 않는다.
 */
export interface DataScopeItemPayload {
  /** 비우면 「(전체)」. **키를 빼지 않고 널을 싣는다** */
  businessUnitId: number | null;
  plantId: number | null;
}

/**
 * 접근범위 한 줄의 로컬 초안.
 *
 * 값이 문자열인 이유는 디자인 시스템 선택칸이 문자열을 다루기 때문이다.
 * 계약 표현(숫자·널)으로의 변환은 이 파일이 한 곳에서 맡는다.
 */
export interface DataScopeDraft {
  /**
   * 초안 안에서 줄을 구분하는 안정된 키. 표의 행 식별자·React key로 쓴다.
   * 아직 저장되지 않은 줄에도 있어야 하므로 서버 식별자와 별개로 둔다.
   * **서버로 나가지 않는다** — 계약의 요청 항목에 식별자가 없다.
   */
  draftId: string;
  /** 비우면 「(전체)」다 */
  businessUnitId: string;
  /** 비우면 「(전체)」다 */
  plantId: string;
}

/** 널·키 부재를 빈 문자열 하나로 모은다 — 화면에서 「(전체)」는 한 가지 상태여야 한다. */
const optionalNumberToText = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value);

export const toDataScopeDrafts = (items: readonly UserDataScope[]): DataScopeDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.userDataScopeId)}`,
    businessUnitId: optionalNumberToText(item.businessUnitId),
    plantId: optionalNumberToText(item.plantId),
  }));

/**
 * 아직 저장되지 않은 줄의 초안 키. 저장된 줄(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — 서버로 나가지 않는 값이다.
 */
let newDraftSequence = 0;

export const createDataScopeDraft = (): DataScopeDraft => {
  newDraftSequence += 1;

  return { draftId: `new:${String(newDraftSequence)}`, businessUnitId: '', plantId: '' };
};

/**
 * 초안 하나를 더하거나 갈아 끼운다.
 * 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 찾아야 한다.
 */
export const upsertDataScopeDraft = (
  drafts: readonly DataScopeDraft[],
  draft: DataScopeDraft,
): DataScopeDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

export const removeDataScopeDraft = (
  drafts: readonly DataScopeDraft[],
  draftId: string,
): DataScopeDraft[] => drafts.filter((draft) => draft.draftId !== draftId);

/**
 * 유일 제약의 판정 키.
 *
 * 계약의 `uq_user_data_scope`가 **`COALESCE(…,0)`으로 접는다** — 사업부만 고른 두 줄은
 * 서버에게 같은 짝이다. 화면이 그것을 다르게 세면 사용자가 만든 줄이 저장 시점에야 거부된다.
 */
export const duplicateKeyOf = (draft: DataScopeDraft): string => {
  const businessUnit = draft.businessUnitId === '' ? '0' : draft.businessUnitId;
  const plant = draft.plantId === '' ? '0' : draft.plantId;

  return `${businessUnit}#${plant}`;
};

/** 빈 문자열은 사용자가 고른 「(전체)」다 — 계약의 널로 옮긴다. */
const textToOptionalNumber = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * **식별자를 싣지 않는다** — 계약의 요청 항목이 두 축뿐이다.
 * **빈 축은 키를 빼지 않고 널을 명시한다** — 여기서 빈 축은 화면이 정한 「(전체)」다.
 * 키를 빼면 「정하지 않았다」가 되어 서버가 이전 값을 남길 수 있다.
 *
 * 순서는 표의 줄 순서 그대로다.
 */
export const toDataScopesPayload = (
  drafts: readonly DataScopeDraft[],
): DataScopeItemPayload[] =>
  drafts.map((draft) => ({
    businessUnitId: textToOptionalNumber(draft.businessUnitId),
    plantId: textToOptionalNumber(draft.plantId),
  }));

const isSameDraft = (a: DataScopeDraft, b: DataScopeDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.businessUnitId === b.businessUnitId &&
  a.plantId === b.plantId;

/**
 * 「고친 것이 있는가」의 판정 근거.
 * **순서도 본다** — 줄 순서가 곧 저장 본문의 순서라 자료의 일부다.
 */
export const isSameDataScopeDrafts = (
  a: readonly DataScopeDraft[],
  b: readonly DataScopeDraft[],
): boolean => a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
