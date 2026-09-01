import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { codeLockReason, SOURCE_DOCUMENT_TYPE_CODE } from './codes';
import type { RouteState } from './queries';
import { totalQtyOf, type DisposalTarget } from './types';

/**
 * 요청 초안과 확정 게이트.
 *
 * ⭐ **게이트와 본문 조립을 한 파일에 둔다** — 갈라지면 「버튼은 열렸는데 본문이 안 만들어진다」
 * 또는 「막았는데 본문은 만들어진다」가 생긴다. 되돌릴 수 없는 폐기라 두 판정이 **같은 입력에서
 * 같은 순서로** 나와야 한다.
 */

export type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];

/** 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const REASON_MAX = 500;

export interface DisposalDraft {
  reason: string;
  /** ⭐ 체크하면 도착지 짝을 통째로 비운다 — 나가서 없어지는 물건에는 도착지가 없다(DR-013). */
  isSelfDisposal: boolean;
  /** 폐기 거래처. 자체 폐기면 쓰지 않는다. */
  partnerId: string;
  /** 출고 사유 코드. 조회로 받은 선택지에서 고른다. */
  issueReasonCode: string;
  /** 출고 유형 코드. 조회로 받은 선택지에서 고른다 — 계약이 기타출고 고정이라 적었으나 값은 미정. */
  issueTypeCode: string;
}

export const EMPTY_DRAFT: DisposalDraft = {
  reason: '',
  isSelfDisposal: false,
  partnerId: '',
  issueReasonCode: '',
  issueTypeCode: '',
};

export const reasonError = (raw: string): string | undefined => {
  const t = messages.productDisposalRequest.request;
  const value = raw.trim();

  if (value === '') return t.reasonRequired;
  if (value.length > REASON_MAX) return t.reasonTooLong;

  return undefined;
};

export interface RequestGateInput {
  targets: readonly DisposalTarget[];
  draft: DisposalDraft;
  route: RouteState;
  isSaving: boolean;
}

/**
 * 「승인 요청」을 막는 사유. 없으면 `undefined`.
 *
 * ⭐ **하나만 낸다**(공유계약 G-3). 순서는 사용자가 채우는 순서다 — 대상 → 사유 → 결재선.
 *
 * ⛔ **기준값 대기가 맨 앞이다.** 값 목록이 없어 잠긴 것을 「대상을 선택하세요」로 말하면
 * 사용자가 고르고 또 골라도 버튼이 안 열린다. **왜 잠겼는지를 먼저 말한다.**
 */
export const requestLockReason = (input: RequestGateInput): string | undefined => {
  const t = messages.productDisposalRequest.lock;

  const codes = codeLockReason();
  if (codes !== undefined) return codes;

  if (input.isSaving) return t.saving;
  if (input.targets.length === 0) return t.selectNone;
  if (reasonError(input.draft.reason) !== undefined) return t.reason;
  /* 결재선이 없으면 상신할 곳이 없다 — 서버도 400(ROUTE_NOT_FOUND)으로 막는다. */
  if (input.route.kind !== 'found') return t.route;

  return undefined;
};

/**
 * 이 요청의 승인 상태.
 *
 * ⛔ **`unknown` 이 지금의 사실이다.** 승인 요청을 이 전표에 잇는 축(`targetTypeCode`)의 코드
 * 값이 아직 확정되지 않아(G-2) 화면이 「승인이 끝났는가」를 **물어볼 수가 없다.** `false` 라는
 * 이름을 쓰지 않는 이유가 이것이다 — 「승인 안 됨」과 「모른다」는 다르고, 앞의 것으로 적으면
 * 승인이 끝난 뒤에도 화면이 안 끝났다고 «단정»하게 된다.
 */
export type ApprovalState = 'unknown' | 'pending' | 'approved';

export interface IssueGateInput extends RequestGateInput {
  approval: ApprovalState;
}

/**
 * 「기타출고 처리」를 막는 사유.
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 출고는 여기서 다시 눌러야 한다.
 * ⛔ **도착지를 정하지 않았으면 막는다**(§6) — 계약이 두 필드를 선택으로 두어 서버가 막지
 * 않으므로, 정하지 않은 채 나가면 **「자체 폐기」로 저장된다.** 사용자가 확인한 사실이 아닌
 * 것이 되돌릴 수 없는 전표에 남는다.
 */
export const issueLockReason = (input: IssueGateInput): string | undefined => {
  const t = messages.productDisposalRequest.lock;

  const codes = codeLockReason();
  if (codes !== undefined) return codes;

  if (input.isSaving) return t.saving;
  /* ⭐ 승인은 자물쇠를 풀 뿐이다(J-8) — 모르는 동안에도 잠근 채로 둔다. */
  if (input.approval !== 'approved') return t.beforeApproval;
  if (input.targets.length === 0) return t.selectNone;
  if (!input.draft.isSelfDisposal && input.draft.partnerId.trim() === '') return t.destination;

  return undefined;
};

/**
 * 도착지 짝.
 *
 * ⭐ **자체 폐기면 둘을 «함께» 비운다** — 계약이 「자체 폐기면 도착지 짝을 통째로 비운다」로
 * 못박았다. 한쪽만 비우면 다형 참조가 어느 표를 가리키는지 판별할 수 없게 된다(A-10).
 */
const destinationOf = (
  draft: DisposalDraft,
): Pick<GoodsIssueCreate, 'destinationTypeCode' | 'destinationId'> | null => {
  if (draft.isSelfDisposal) return { destinationTypeCode: null, destinationId: null };

  const parsed = Number(draft.partnerId.trim());
  if (draft.partnerId.trim() === '' || !Number.isSafeInteger(parsed) || parsed <= 0) return null;

  return { destinationTypeCode: 'DISPOSAL_SITE', destinationId: parsed };
};

export interface IssuePayloadInput extends IssueGateInput {
  sourceWarehouseId: number | null;
  issuedAt: string;
}

/**
 * 기타출고 전표의 본문. **막을 사유가 하나라도 있으면 `null`** — 반쪽짜리 폐기 전표를 만들지
 * 않는다.
 *
 * ⛔ **원천 문서 유형이 비어 있으면 만들지 않는다.** 계약이 필수로 두는데 그 값이 무엇이어야
 * 하는지가 아직 확정되지 않았다(G-2) — 지어내면 **서버가 모르는 코드가 되돌릴 수 없는 전표에
 * 실린다.**
 */
export const toGoodsIssueCreate = (input: IssuePayloadInput): GoodsIssueCreate | null => {
  if (issueLockReason(input) !== undefined) return null;

  const [first] = input.targets;
  const destination = destinationOf(input.draft);

  if (first === undefined || destination === null) return null;
  if (input.sourceWarehouseId === null) return null;
  if (SOURCE_DOCUMENT_TYPE_CODE === '') return null;
  if (input.draft.issueTypeCode.trim() === '' || input.draft.issueReasonCode.trim() === '') {
    return null;
  }

  return {
    issueTypeCode: input.draft.issueTypeCode.trim(),
    /* ⭐ 원천은 «처분 결정»이다 — 다형 참조의 짝을 함께 싣는다(A-10). */
    sourceDocumentTypeCode: SOURCE_DOCUMENT_TYPE_CODE,
    sourceDocumentId: first.dispositionDecisionId,
    sourceWarehouseId: input.sourceWarehouseId,
    issuedAt: input.issuedAt,
    ...destination,
    reasonCode: input.draft.issueReasonCode.trim(),
    /* §5-3 — 요청 번호를 담을 컬럼이 없어 비고로 잇는다(A-11 · omf-mes#87). */
    remarks: input.draft.reason.trim(),
  };
};

/** 확인 창에 보일 합계. 단위가 섞이면 셀 수 없다. */
export const confirmSummary = (targets: readonly DisposalTarget[]): string => {
  const total = totalQtyOf(targets);
  return total === null ? '—' : String(total);
};
