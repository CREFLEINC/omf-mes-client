import type { components } from '@omf-mes/api-client';

type ItemBuItemMap = components['schemas']['ItemBuItemMap'];

/**
 * 사업부 매핑 초안 — 표에 보이는 목록과 치환 본문 사이의 유일한 통로.
 *
 * ## 치환 본문 규칙 셋 (결정 6 · 세 부속 자원이 똑같이 지킨다)
 *
 * | 규칙 | 근거 |
 * | --- | --- |
 * | **서버 식별자를 싣지 않는다** | 계약의 요청 항목에 `itemBuItemMapId`가 **없다** |
 * | **`itemId`·`fromItemId`를 싣지 않는다** | 계약: 「`fromItemId` 는 경로의 `itemId` 로 고정한다」 |
 * | **순서 필드가 없다** | 이 표에 순서 컬럼이 없다. 배열 순서는 화면 표시 순서일 뿐이고 서버가 보관하지 않는다 |
 *
 * **이 파일은 단위 환산·외부 코드의 같은 이름 파일을 참조하지 않는다**(결정 6).
 * 셋은 같은 모양이되 필드도 검증도 다르다 — 묶으면 하나를 고칠 때 나머지 둘이 함께 흔들린다.
 */

/**
 * 치환 본문의 항목 하나. **계약의 요청 항목이 정확히 다섯이고 식별자가 없다.**
 *
 * 매퍼를 스프레드로 만들지 않는 이유가 여기 있다 — 초안에는 `draftId`가 있고
 * 조회 응답에는 `itemBuItemMapId`·`fromItemId`가 있는데, 어느 것도 본문에 실리면 안 된다.
 */
export interface BuMapItemPayload {
  fromBusinessUnitId: number;
  toBusinessUnitId: number;
  toItemId: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

/**
 * 사업부 매핑 한 줄의 로컬 초안.
 *
 * 값이 문자열인 이유는 디자인 시스템 입력·선택이 문자열을 다루기 때문이다.
 * 계약과의 경계(숫자·널)는 `toBuMapsPayload` 한 곳에서 넘는다.
 */
export interface BuMapDraft {
  /**
   * 초안 안에서 줄을 구분하는 안정된 키. 표의 행 식별자·React key로 쓴다.
   * 아직 저장되지 않은 줄에도 있어야 하므로 서버 식별자와 별개로 둔다.
   * **서버로 나가지 않는다** — 계약의 요청 항목에 식별자가 없다.
   */
  draftId: string;
  fromBusinessUnitId: string;
  toBusinessUnitId: string;
  /** 대상 품목 번호. 화면에서는 검색해 고르고 번호를 직접 입력받지 않는다(결정 8) */
  toItemId: string;
  effectiveFrom: string;
  /** 비우면 무기한이다 — 계약이 널을 허용한다 */
  effectiveTo: string;
}

const optionalText = (value: string | null | undefined): string => value ?? '';

/**
 * 서버 응답을 로컬 초안으로 옮긴다.
 *
 * **`fromItemId`를 담지 않는다.** 경로의 `itemId`로 고정되는 값이라 화면이 들고 다닐 이유가 없고,
 * 들고 다니면 본문에 실릴 여지가 생긴다.
 */
export const toBuMapDrafts = (items: readonly ItemBuItemMap[]): BuMapDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.itemBuItemMapId)}`,
    fromBusinessUnitId: String(item.fromBusinessUnitId),
    toBusinessUnitId: String(item.toBusinessUnitId),
    toItemId: String(item.toItemId),
    effectiveFrom: item.effectiveFrom,
    effectiveTo: optionalText(item.effectiveTo),
  }));

/**
 * 아직 저장되지 않은 줄의 초안 키. 저장된 줄(`saved:<id>`)과 겹치지 않기만 하면 되고,
 * 한 세션 안에서만 유일하면 된다 — 서버로 나가지 않는 값이다.
 */
let newDraftSequence = 0;

export const createBuMapDraft = (): BuMapDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    fromBusinessUnitId: '',
    toBusinessUnitId: '',
    toItemId: '',
    effectiveFrom: '',
    effectiveTo: '',
  };
};

/**
 * 초안 하나를 더하거나 갈아 끼운다.
 * 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 찾아야 한다.
 */
export const upsertBuMapDraft = (drafts: BuMapDraft[], draft: BuMapDraft): BuMapDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

export const removeBuMapDraft = (drafts: BuMapDraft[], draftId: string): BuMapDraft[] =>
  drafts.filter((draft) => draft.draftId !== draftId);

/** 빈 문자열은 「지정하지 않음」이라 계약의 널로 옮긴다. */
const textToOptionalText = (value: string): string | null =>
  value.trim() === '' ? null : value.trim();

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * **키를 하나씩 열거해 만든다.** 초안을 스프레드하면 `draftId`가 그대로 실리고,
 * 조회 응답을 스프레드하면 `itemBuItemMapId`·`fromItemId`가 실린다 —
 * 서버가 그것을 막지 않으므로(계약 실측) 이 자리가 유일한 방어다.
 *
 * **행이 0개여도 빈 배열을 만든다.** 요청을 생략하면 「지우려 했는데 그대로 남는」 상태가 된다.
 */
export const toBuMapsPayload = (drafts: readonly BuMapDraft[]): BuMapItemPayload[] =>
  drafts.map((draft) => ({
    fromBusinessUnitId: Number(draft.fromBusinessUnitId),
    toBusinessUnitId: Number(draft.toBusinessUnitId),
    toItemId: Number(draft.toItemId),
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: textToOptionalText(draft.effectiveTo),
  }));

const isSameDraft = (a: BuMapDraft, b: BuMapDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.fromBusinessUnitId === b.fromBusinessUnitId &&
  a.toBusinessUnitId === b.toBusinessUnitId &&
  a.toItemId === b.toItemId &&
  a.effectiveFrom === b.effectiveFrom &&
  a.effectiveTo === b.effectiveTo;

/** 「고친 것이 있는가」의 판정 근거. 순서가 자료는 아니지만 목록 비교라 위치로 맞춘다. */
export const isSameBuMapDrafts = (a: readonly BuMapDraft[], b: readonly BuMapDraft[]): boolean =>
  a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
