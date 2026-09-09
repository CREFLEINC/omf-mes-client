import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { SOURCE_DOCUMENT_TYPE_CODE } from './codes';
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
type GoodsIssueLineUpsert = components['schemas']['GoodsIssueLineUpsert'];
export type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];

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
 * ⚠ **「기준값 대기」 갈래를 걷었다.** 한때 이 판정이 맨 앞에서 쓰기 전체를 잠갔는데, 잠금
 * 근거였던 두 값이 통지 `#674` 로 결말이 났다 — 원천 문서 유형은 값이 왔고, 승인 유형은
 * «화면이 보낼 값이 아니»었다. 사라진 사유로 버튼을 잠가 두면 아무도 이유를 못 찾는다.
 */
export const requestLockReason = (input: RequestGateInput): string | undefined => {
  const t = messages.productDisposalRequest.lock;

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
 * ⛔ **`unknown` 이 여전히 지금의 사실이다.** `ApprovalRequest.statusCode` 가 생성 타입에서
 * 아직 열린 문자열이라(`5b3d773` 실측) 화면이 「승인이 끝났는가」를 **값으로 판정할 수 없다.**
 * `false` 라는 이름을 쓰지 않는 이유가 이것이다 — 「승인 안 됨」과 「모른다」는 다르고, 앞의
 * 것으로 적으면 승인이 끝난 뒤에도 화면이 안 끝났다고 «단정»하게 된다.
 *
 * ⛔ **「모든 단계가 결재됨」으로 파생하지 않는다**(통지 `#674`) — 1단계 결재선에서 «반려»되면
 * 승인 완료와 같은 모양이 된다.
 */
export type ApprovalState = 'unknown' | 'pending' | 'approved';

export interface IssueGateInput extends RequestGateInput {
  approval: ApprovalState;
}

/**
 * 「기타출고 처리」를 막는 사유.
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 출고는 여기서 다시 눌러야 한다.
 *
 * ⛔ **승인 «상태»로 버튼을 잠그지 않는다**(통지 `#674` · 설계서 §8-6). 상태 값을 판정할 수
 * 없는 동안 잠가 두면 **승인이 끝났는데도 열리지 않는다** — 사용자는 결재함에서 승인된 것을
 * 보고 와서 눌리지 않는 버튼을 만난다. 대신 **버튼을 열고 서버의 400 을 안내로 바꾼다.**
 * 승인 전이면 계약이 막는다(§5-4) — 화면이 앞질러 막을 필요가 없다.
 *
 * ⛔ **도착지를 정하지 않았으면 막는다**(§6) — 계약이 두 필드를 선택으로 두어 서버가 막지
 * 않으므로, 정하지 않은 채 나가면 **「자체 폐기」로 저장된다.** 사용자가 확인한 사실이 아닌
 * 것이 되돌릴 수 없는 전표에 남는다. 이것은 서버가 안 막으므로 **화면이 막아야 한다.**
 */
export const issueLockReason = (input: IssueGateInput): string | undefined => {
  const t = messages.productDisposalRequest.lock;

  if (input.isSaving) return t.saving;
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
  /** `placement.ts` 가 푼 출발 자리. 못 풀었으면 이 자리에 오지 않는다. */
  placement: ResolvedPlacement;
  /**
   * 제출 순간. **인자로 받는다** — 함수 안에서 `new Date()` 를 부르면 순수하지 않아 영업일과
   * 발생 시각을 고정 시각으로 검사할 수 없다. 본문은 렌더마다 다시 만들어지므로 그 자리에서
   * 찍으면 값이 매 렌더 달라지기도 한다.
   */
  now: Date;
}

/** `placement.ts` 의 성공 갈래만 받는다 — 막힌 갈래를 여기까지 들이지 않는다. */
export interface ResolvedPlacement {
  warehouseId: number;
  placements: readonly { lotId: number; warehouseId: number; locationId: number }[];
}

/**
 * 로컬 날짜 `YYYY-MM-DD`.
 *
 * ⚠ **`toISOString()` 을 쓰지 않는다** — 그것은 UTC 라 자정 근처에서 **하루가 밀린다.** 영업일이
 * 하루 밀리면 그날의 수불이 어긋난다.
 *
 * ⚠ **영업일 산출 규칙(야간조 경계 등)은 계약에 없다.** 이 화면의 폐기 요청은 누르는 그 자리에서
 * 만들어지므로 **누른 순간의 로컬 날짜**를 쓴다 — 지난 전표를 나중에 처리하는 화면과 달리
 * 「전표의 날짜」라는 다른 후보가 없다.
 */
const toBusinessDate = (now: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * 기타출고 전표의 본문. **막을 사유가 하나라도 있으면 `null`** — 반쪽짜리 폐기 전표를 만들지
 * 않는다.
 *
 * ⛔ **요청 사유를 여기 싣지 않는다.** 사유는 **둘째 호출**(`:request-approval`)의 본문이다
 * (통지 `#675` §3). 한때 이 자리에서 전표의 `remarks` 에 넣었는데, 그 칸은 전표 «비고»라
 * **결재함 목록 요약이 빈 채로 올라간다** — `approval_request` 에 업무 값이 `reason` 하나뿐이라
 * 그 문장이 승인자가 보는 전부다(A-12 보강).
 *
 * ⛔ **`postImmediately` 를 상수 거짓으로 «싣는다».** 계약의 기본이 거짓이지만 목은 생략해도
 * 201 이라(`W-01-06` 실측) 기대지 않는다 — 참으로 새면 **승인 없이 재고가 빠진다.** 이 화면의
 * 업무는 승인을 먼저 받는 것이고(§5-4) 그 순서가 무너지면 되돌릴 길이 다른 화면에 있다.
 */
export const toGoodsIssueCreate = (input: IssuePayloadInput): GoodsIssueCreate | null => {
  if (issueLockReason(input) !== undefined) return null;

  const [first] = input.targets;
  const destination = destinationOf(input.draft);

  if (first === undefined || destination === null) return null;
  if (input.draft.issueTypeCode.trim() === '' || input.draft.issueReasonCode.trim() === '') {
    return null;
  }

  const lines = toLines(input.targets, input.placement);

  /* 줄을 못 만들었으면 만들지 않는다 — 계약 설명이 「최소 1행」이고 빈 배열은 뜻이 없다. */
  if (lines === null) return null;

  return {
    issueTypeCode: input.draft.issueTypeCode.trim(),
    /* ⭐ 원천은 «처분 결정»이다 — 다형 참조의 짝을 함께 싣는다(A-10). */
    sourceDocumentTypeCode: SOURCE_DOCUMENT_TYPE_CODE,
    sourceDocumentId: first.dispositionDecisionId,
    sourceWarehouseId: input.placement.warehouseId,
    issuedAt: input.now.toISOString(),
    ...destination,
    reasonCode: input.draft.issueReasonCode.trim(),
    postImmediately: POST_IMMEDIATELY,
    businessDate: toBusinessDate(input.now),
    /** 발생 시각 — **제출 순간**이다(공유계약 C-1). 영업일과 갈라 싣는다. */
    occurredAt: input.now.toISOString(),
    lines,
  };
};

/**
 * **전기하지 않고 만들기만 한다.**
 *
 * 상수다 — 초안의 어떤 값으로도 갈리지 않는다. 조건부로 만들면 「승인 전에 전기되는」 길이
 * 열리는데, 참이면 사용자가 「승인 요청」을 눌렀는데 **재고가 그 자리에서 빠진다.**
 */
const POST_IMMEDIATELY = false;

/**
 * 출고 줄 — **고른 대상 하나가 줄 하나다.**
 *
 * ⛔ **자리를 못 찾은 대상이 하나라도 있으면 통째로 만들지 않는다.** 찾은 것만 실어 보내면
 * 사용자가 고른 것 중 일부만 폐기되고, **빠진 것은 아무 말도 없이 남는다.**
 */
const toLines = (
  targets: readonly DisposalTarget[],
  placement: ResolvedPlacement,
): GoodsIssueLineUpsert[] | null => {
  const seatOf = new Map(placement.placements.map((seat) => [seat.lotId, seat]));
  const lines: GoodsIssueLineUpsert[] = [];

  for (const target of targets) {
    if (target.lotId === null || target.itemId === null) return null;

    const seat = seatOf.get(target.lotId);
    if (seat === undefined) return null;

    lines.push({
      itemId: target.itemId,
      lotId: target.lotId,
      issueQty: target.decisionQty,
      uomId: target.uomId,
      sourceLocationId: seat.locationId,
    });
  }

  return lines.length === 0 ? null : lines;
};

/**
 * 상신 본문 — **둘째 호출**(`:request-approval`)이 받는 것.
 *
 * ⭐ **사유가 전부다.** 계약의 `ApprovalRequestCreate` 는 `reason` 한 칸이고 **필수·`minLength 1`**
 * 이다. 이 문장이 결재함에서 **목록 요약을 겸하므로**(A-12 보강) 처분 사유를 인용해 채워 두면
 * 승인자가 판정 근거를 바로 본다(§5-5).
 *
 * ⛔ **승인 유형도 대상도 싣지 않는다** — 서버가 상신 오퍼레이션에서 채운다(통지 `#674`).
 */
export const toApprovalRequestCreate = (draft: DisposalDraft): ApprovalRequestCreate | null => {
  const reason = draft.reason.trim();
  return reasonError(reason) === undefined ? { reason } : null;
};

/** 확인 창에 보일 합계. 단위가 섞이면 셀 수 없다. */
export const confirmSummary = (targets: readonly DisposalTarget[]): string => {
  const total = totalQtyOf(targets);
  return total === null ? '—' : String(total);
};
