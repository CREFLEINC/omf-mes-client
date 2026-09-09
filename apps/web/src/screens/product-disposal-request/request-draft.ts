import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { ISSUE_TYPE_OTHER, SOURCE_DOCUMENT_TYPE_CODE } from './codes';
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

/**
 * 시각 세 칸을 뺀 본문 — 화면이 사용자의 입력만으로 만들 수 있는 부분이다.
 *
 * ⭐ **이 타입이 멱등 지문에 들어간다.** 시각이 여기 없어야 같은 입력의 재시도가 같은 지문을
 * 낸다(`withOccurrence` 주석 참조).
 */
export type GoodsIssueDraft = Omit<GoodsIssueCreate, 'issuedAt' | 'businessDate' | 'occurredAt'>;
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
  /**
   * 출고 유형 코드 — **고르는 값이 아니다.** 기타출고 고정이다(§4-B).
   *
   * ⛔ 초안에 두는 이유는 본문 조립이 이 한 곳에서만 값을 읽게 하기 위해서다. 화면에는
   * 선택칸을 두지 않는다 — 두면 사용자가 «출하»를 고를 수 있고 폐기가 출하로 나간다.
   */
  issueTypeCode: string;
}

export const EMPTY_DRAFT: DisposalDraft = {
  reason: '',
  isSelfDisposal: false,
  partnerId: '',
  issueReasonCode: '',
  issueTypeCode: ISSUE_TYPE_OTHER,
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
  /*
   * ⛔ **전표 본문이 요구하는 것을 여기서 «전부» 본다.** 통지 #675 §2 로 도착지·사유가 요청
   * 작성 구획으로 옮겨 오면서, 이 둘이 비면 본문 조립이 조용히 `null` 을 내고 **버튼은 열린
   * 채 눌러도 아무 일이 없는** 상태가 됐다. 막는 사유는 «버튼 옆»에서 말해야 한다.
   */
  if (input.draft.issueReasonCode.trim() === '') return t.issueReason;
  if (!input.draft.isSelfDisposal && input.draft.partnerId.trim() === '') return t.destination;
  /* 결재선이 없으면 상신할 곳이 없다 — 서버도 400(ROUTE_NOT_FOUND)으로 막는다. */
  if (input.route.kind !== 'found') return t.route;

  return undefined;
};

/*
 * ⛔ **전기 게이트를 여기 두지 않는다.**
 *
 * 「기타출고 처리」는 «고른 전표»에 거는 조작이라 초안(`DisposalDraft`)을 하나도 쓰지 않는다.
 * 한때 이 파일에 `issueLockReason` 을 두고 초안을 봤는데, 그 판정이 요청 게이트와 갈려
 * **버튼은 열린 채 눌러도 아무 일이 없는** 상태를 만들었다. 지금은 그 조작이 「처리 이력」
 * 탭에 있고 막는 사유(고르지 않음 · 토큰 못 받음)를 그 자리가 직접 만든다.
 */

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

export interface IssuePayloadInput extends RequestGateInput {
  /** `placement.ts` 가 푼 출발 자리. 못 풀었으면 이 자리에 오지 않는다. */
  placement: ResolvedPlacement;
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
export const toBusinessDate = (now: Date): string => {
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
export const toGoodsIssueCreate = (input: IssuePayloadInput): GoodsIssueDraft | null => {
  /* ⭐ 게이트와 «같은» 판정을 지난다 — 갈리면 「버튼은 열렸는데 본문이 없다」가 생긴다. */
  if (requestLockReason(input) !== undefined) return null;

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
    ...destination,
    reasonCode: input.draft.issueReasonCode.trim(),
    postImmediately: POST_IMMEDIATELY,
    lines,
  };
};

/**
 * 본문에 **시각 세 칸을 얹는다** — 보내는 순간에 한 번.
 *
 * ⛔ **이 셋은 «본문 조립»이 아니라 «보내기»에 속한다.** 조립 자리에서 찍으면 그 값이
 * 멱등 지문(`useMasterWrite` 의 `until-applied`)에 들어가는데, 밀리초까지 실려 **누를 때마다
 * 지문이 달라진다.** 그러면 키를 붙드는 장치가 통째로 무력해지고, 통신이 끊긴 뒤 다시 누른
 * 것이 **새 폐기 전표**가 된다 — 되돌릴 길이 없는 쓰기다.
 *
 * ⚠ **재시도마다 값이 달라지는 것은 괜찮다.** 같은 키로 다시 가면 서버가 최초 응답을 재생하고
 * 본문은 보지 않는다. 지문에서 빼는 것이 요점이지 값을 고정하는 것이 요점이 아니다.
 */
export const withOccurrence = (draft: GoodsIssueDraft, now: Date): GoodsIssueCreate => ({
  ...draft,
  issuedAt: now.toISOString(),
  businessDate: toBusinessDate(now),
  /** 발생 시각 — **제출 순간**이다(공유계약 C-1). 영업일과 갈라 싣는다. */
  occurredAt: now.toISOString(),
});

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
