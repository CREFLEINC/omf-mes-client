import type { components, paths } from '@omf-mes/api-client';

type ItemExternalCode = components['schemas']['ItemExternalCode'];
export type ExternalSystemCode = ItemExternalCode['externalSystemCode'];

/**
 * 외부 코드 초안 — 표에 보이는 목록과 치환 본문 사이의 유일한 통로.
 *
 * ## 치환 본문 규칙 셋 (결정 6 · 세 부속 자원이 똑같이 지킨다)
 *
 * | 규칙 | 근거 |
 * | --- | --- |
 * | **서버 식별자를 싣지 않는다** | 계약의 요청 항목에 `itemExternalCodeId`가 **없다** |
 * | **`itemId`를 싣지 않는다** | 경로의 `itemId`가 정본이다 |
 * | **순서 필드가 없다** | 이 표에 순서 컬럼이 없다 |
 *
 * **이 파일은 사업부 매핑·단위 환산의 같은 이름 파일을 참조하지 않는다**(결정 6).
 * 이 자원만 갈리는 자리는 **유일 제약이 `COALESCE`로 접힌다**는 것이다(A-7) —
 * 거래처를 비운 두 줄은 서버에게 같은 짝이다.
 */

/** 치환 본문의 항목 하나. **계약의 요청 항목이 정확히 셋이고 식별자가 없다.** */
type ExternalCodeInput =
  paths['/mdm/items/{itemId}/external-codes']['put']['requestBody']['content']['application/json']['externalCodes'][number];

export interface ExternalCodeItemPayload {
  /** 계약이 외부 시스템을 세 값으로 닫았다(코드 사전 2026-09-03). 선택지는 서버 코드값이다 */
  externalSystemCode: ExternalCodeInput['externalSystemCode'];
  partnerId?: number | null;
  externalItemCode: string;
}

/**
 * 외부 코드 한 줄의 로컬 초안.
 *
 * **유효기간이 없다.** 사업부 매핑·단위 환산과 달리 이 표에는 기간 컬럼 자체가 없다 —
 * 셋을 한 부품으로 묶지 않은 이유가 여기서 드러난다.
 */
export interface ExternalCodeDraft {
  /** 표의 행 식별자·React key. **서버로 나가지 않는다** */
  draftId: string;
  /** OpenAPI가 닫은 외부 시스템 셋. 빈 문자열은 새 초안의 미선택 상태다. */
  externalSystemCode: ExternalSystemCode | '';
  /** 비우면 「(전체)」다 — 계약이 그 뜻을 널로 표현한다(A-7) */
  partnerId: string;
  /** 고객 바코드 체계의 저장처 · 길이 100 */
  externalItemCode: string;
}

export const toExternalCodeDrafts = (items: readonly ItemExternalCode[]): ExternalCodeDraft[] =>
  items.map((item) => ({
    draftId: `saved:${String(item.itemExternalCodeId)}`,
    externalSystemCode: item.externalSystemCode,
    partnerId:
      item.partnerId === null || item.partnerId === undefined ? '' : String(item.partnerId),
    externalItemCode: item.externalItemCode,
  }));

/** 아직 저장되지 않은 줄의 초안 키. 한 세션 안에서만 유일하면 된다. */
let newDraftSequence = 0;

export const createExternalCodeDraft = (): ExternalCodeDraft => {
  newDraftSequence += 1;

  return {
    draftId: `new:${String(newDraftSequence)}`,
    externalSystemCode: '',
    partnerId: '',
    externalItemCode: '',
  };
};

/** 이미 있는 키는 **자리를 지킨 채** 값만 바꾼다 — 수정이 순서를 흔들면 사용자가 다시 찾아야 한다. */
export const upsertExternalCodeDraft = (
  drafts: ExternalCodeDraft[],
  draft: ExternalCodeDraft,
): ExternalCodeDraft[] => {
  const index = drafts.findIndex((item) => item.draftId === draft.draftId);

  if (index === -1) return [...drafts, draft];

  const next = [...drafts];
  next[index] = draft;

  return next;
};

export const removeExternalCodeDraft = (
  drafts: ExternalCodeDraft[],
  draftId: string,
): ExternalCodeDraft[] => drafts.filter((draft) => draft.draftId !== draftId);

/**
 * 전체 치환 요청 본문의 항목 목록.
 *
 * **키를 하나씩 열거해 만든다.** 초안을 스프레드하면 `draftId`가 그대로 실린다 —
 * 서버가 남는 키를 막지 않으므로(계약 실측) 이 자리가 유일한 방어다.
 *
 * 코드 두 개는 **앞뒤 공백을 떼고** 보낸다. 공백이 붙은 코드는 눈으로 구분되지 않는
 * 다른 값이라, 조회할 때 찾지 못하는 자료가 된다.
 */
export const toExternalCodesPayload = (
  drafts: readonly ExternalCodeDraft[],
): ExternalCodeItemPayload[] =>
  drafts.map((draft) => ({
    /* 선택칸의 값은 서버 코드값 목록에서 온다 — 계약이 닫은 형으로 좁혀 싣는다. */
    externalSystemCode: draft.externalSystemCode.trim() as ExternalCodeInput['externalSystemCode'],
    partnerId: draft.partnerId === '' ? null : Number(draft.partnerId),
    externalItemCode: draft.externalItemCode.trim(),
  }));

/**
 * 유일 제약의 판정 키.
 *
 * 계약의 `uq_item_external_code`가 **`COALESCE(partner_id,0)`으로 접는다**(A-7) —
 * **거래처를 비운 두 줄은 서버에게 같은 짝이다.** 화면이 그것을 다르게 세면
 * 사용자가 만든 줄이 저장 시점에야 거부된다.
 *
 * `externalItemCode`는 키가 아니다 — 코드만 다른 두 줄도 서버에게는 같은 짝이다.
 */
export const duplicateKeyOf = (draft: ExternalCodeDraft): string => {
  const partner = draft.partnerId === '' ? 0 : Number(draft.partnerId);

  return `${draft.externalSystemCode}#${String(partner)}`;
};

const isSameDraft = (a: ExternalCodeDraft, b: ExternalCodeDraft | undefined): boolean =>
  b !== undefined &&
  a.draftId === b.draftId &&
  a.externalSystemCode === b.externalSystemCode &&
  a.partnerId === b.partnerId &&
  a.externalItemCode === b.externalItemCode;

/** 「고친 것이 있는가」의 판정 근거. */
export const isSameExternalCodeDrafts = (
  a: readonly ExternalCodeDraft[],
  b: readonly ExternalCodeDraft[],
): boolean => a.length === b.length && a.every((draft, index) => isSameDraft(draft, b[index]));
