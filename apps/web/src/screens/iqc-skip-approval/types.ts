import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-01-02 화면 슬라이스의 계약 타입과 화면 타입.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 같은 승인 계약을 소비하는 화면이 이미 있으나(W-CO-09), 형태가 같아도 리소스 이름이 박힌
 * 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

const t = messages.iqcSkipApproval;

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type ApprovalRequestDetail = components['schemas']['ApprovalRequestDetail'];
export type ApprovalStep = components['schemas']['ApprovalStep'];
export type ApprovalTarget = components['schemas']['ApprovalTarget'];
export type PageMeta = components['schemas']['PageMeta'];
/** 승인 본문. **몸통 자체가 선택**이고 그 안의 의견도 선택이다(계약 실측). */
export type ApprovalDecision = components['schemas']['ApprovalDecision'];
/** 반려 본문. **몸통이 필수**이고 의견도 필수다 — 두 스키마가 갈린 이유가 그것이다. */
export type ApprovalRejection = components['schemas']['ApprovalRejection'];

export interface SelectOption {
  value: string;
  label: string;
  /** 디자인 시스템 `Select`가 옵션별 잠금을 지원한다. 고를 수 없는 선택지를 감추지 않고 잠근다. */
  disabled?: boolean;
}

/**
 * 조회 조건 **넷**. **주소가 소유하며 화면 상태로 복제하지 않는다.**
 *
 * 전부 문자열이다 — 선택칸·입력칸이 다루는 것이 문자열이고, 계약 표현으로의 변환은
 * `filters.ts` 한 곳이 맡는다.
 *
 * **여기 없는 것 셋과 그 이유**
 *
 * | 없는 것 | 어디에 있나 |
 * | --- | --- |
 * | 승인 유형 | **조건이 아니라 이 화면의 정체**다. 사용자가 고치는 값이 아니라 고정 축이다(`code-options.ts`) |
 * | 「결재 대기만 보기」 | 조건이 아니라 **조회 범위**다. 조건을 고쳐도 유지되고, 이것을 바꾸면 쪽과 선택이 풀린다(수명 표 1·3행) |
 * | 쪽 | 조건이 바뀔 때마다 첫 쪽으로 되돌아가는 별개의 값이다 |
 */
export interface RequestFilters {
  /** 요청 상태 코드. 값 목록이 확정되지 않아 지금은 고를 선택지가 없다(`code-options.ts`). */
  statusCode: string;
  /** 상신일 구간 시작. 계약이 `format: date`라 `YYYY-MM-DD` 그대로 나간다. */
  from: string;
  to: string;
  /** 요청번호 검색어. */
  q: string;
}

/**
 * 목록 한 행이 **보이는 값 전부**. 여섯이며 계획이 확정한 열 구성 그대로다 —
 * 화면이 열을 더하거나 다른 값으로 바꾸지 않는다.
 *
 * **내부 번호를 담지 않는다**(`requestedBy`·`targetId`·`targetTypeCode`). 계약이 표시용 이름을
 * 함께 내려 주므로 화면이 번호를 낼 이유가 없고, 이 타입이 번호를 나르지 않으면 어느 칸에서도
 * 샐 경로가 없다. `approvalRequestId`만 남는데 그것은 **행을 식별하고 고르는 데만** 쓰이며
 * 어느 칸에도 그려지지 않는다. `approvalRequestNo`는 업무 번호라 그대로 낸다.
 *
 * **`targetTypeCode`를 담지 않는 이유가 하나 더 있다.** 대상 유형은 이 화면에서 **읽고
 * 판단하는 값이 아니라 옮기는 값**이다(뒤 회차의 대상 조회가 경로 조각으로 쓴다). 행이
 * 나르면 어느 칸에서든 그것으로 갈리는 코드를 쓸 수 있게 되고, 그것이 계약이 금지한 매핑표의
 * 첫걸음이 된다.
 *
 * **상태 코드를 담지 않는다.** 확정된 여섯 열에 상태가 없다 — 조건 줄에는 상태 칸이 있지만
 * 그것은 좁히는 축이고, 열은 「무엇을 보이는가」다. 열을 늘리는 것보다 줄이는 것이 먼저다.
 */
export interface RequestRow {
  approvalRequestId: number;
  approvalRequestNo: string;
  /** 코드 문자열 그대로. 값 목록이 확정되면 사람이 읽는 이름이 이 자리에 온다(`omf-mes#64`). */
  approvalTypeCode: string;
  /** 대상 표시명. **서버가 만든 이름**이라 화면이 짓지 않는다. */
  targetName: string;
  reasonFirstLine: string;
  requesterName: string;
  /** `2026-08-06 14:20`. **시각까지 담는다** — 계약이 이 값을 `date-time`으로 둔다. */
  requestedAtText: string;
}

/**
 * 사유의 **첫 줄**. 계약이 「목록에서는 첫 줄이 요약 자리에 온다」고 적었다(`omf-mes#87`).
 *
 * **내용이 있는 첫 줄**을 고른다. 사유가 빈 줄로 시작하는 일이 실제로 있고, 그때 그 빈 줄을
 * 그대로 내면 요약 자리가 빈 칸이 되어 이 열이 아무 말도 하지 않는다.
 *
 * 줄 끝 공백은 걷어 낸다 — 표기 값이라 보이지 않는 여백을 나를 이유가 없다.
 * 요약을 **만들지 않는다**: 자르거나 줄이거나 이어 붙이지 않고 그 줄 그대로다.
 */
export const firstLineOf = (reason: string): string =>
  reason
    .split(/\r?\n/)
    .find((line) => line.trim() !== '')
    ?.trim() ?? '';

/**
 * 사람이 읽는 이름 — **이 슬라이스의 이름 자리가 전부 이 판정 하나를 지난다.**
 *
 * 상신자 이름과 대상 표시명 둘 다 계약이 필수로 두었으나 **빈 문자열도 공백만인 값도 스키마를
 * 통과한다.** 그때 화면은 번호를 대신 내지 않고 그 사실을 적는다(`omf-mes#44`).
 *
 * **판정을 한 자리에 두는 이유**: 자리마다 따로 적으면 한쪽은 `=== ''`이고 다른 쪽은 `.trim()`이
 * 되어, 공백만인 이름이 온 **같은 요청이 목록에서는 빈 칸, 상세에서는 안내**로 보인다.
 * 어느 쪽이 옳으냐보다 **한 화면 안에서 갈리지 않는 것**이 먼저다.
 *
 * **이름 안의 공백은 건드리지 않는다.** 판정에만 `trim`을 쓰고 값은 실려 온 그대로 낸다 —
 * 서버가 만든 표기를 화면이 고쳐 쓸 근거가 없다.
 */
export const readableName = (value: string, whenMissing: string): string =>
  value.trim() === '' ? whenMissing : value;

/**
 * 사유 **전문**을 줄 단위로 나눈다. 상세 구획이 쓰는 자리다 — 목록은 첫 줄만 낸다.
 *
 * **줄바꿈이 뜻을 나른다.** 계약이 이 리소스의 업무 값을 사유 **하나**로 두어(수량·금액
 * 컬럼이 물리 모델에 없다) 상신자가 여러 줄로 근거를 적는다. 한 줄로 이어 붙이면 목록·문단
 * 구분이 사라져 무엇이 무엇의 근거인지 읽을 수 없게 된다.
 *
 * **가운데 빈 줄과 줄 안의 공백을 건드리지 않는다** — 문단 구분과 들여쓴 목록이 사유의
 * 일부다. 걷어 내는 것은 CRLF의 캐리지 리턴뿐이며, 그것은 글자가 아니라 줄바꿈의 일부다.
 * **첫 줄만 내는 규칙(`firstLineOf`)이 여기에는 걸리지 않는다** — 목록과 상세는 서로 다른
 * 것을 보이는 자리이고, 같은 규칙을 두 자리에 걸면 상세가 요약이 된다.
 *
 * **자르거나 줄이지 않는다.** 요약은 목록의 일이고 여기는 전문을 보는 자리다.
 */
export const toReasonLines = (reason: string): string[] =>
  reason.trim() === '' ? [t.values.emptyReason] : reason.split(/\r?\n/);

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 상신 일시 표기(`2026-08-06 14:20`).
 *
 * **시각까지 낸다.** 계약이 이 값을 `date-time`으로 두었고, 같은 날 올라온 요청들의 앞뒤가
 * 곧 결재 차례를 읽는 단서다 — 날짜만 내면 그 순서가 사라진다.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 상신이 일어난 곳의 시각이고,
 * 보는 사람의 시간대로 옮기면 같은 요청이 사람마다 다른 시각에 올라온 것으로 보인다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 —
 * 「—」로 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * **형식을 새로 짓지 않았다.** 이 저장소가 여러 화면에서 쓰는 규칙 그대로다(연·월·일 + 시·분).
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 계약 응답 한 건을 목록 행으로 옮긴다.
 *
 * 이름이 비어 있으면 **번호를 대신 내지 않는다**(`omf-mes#44`). 계약이 그 값들을 필수로
 * 두었으나 빈 문자열은 스키마상 통과하며, 그 자리에서 번호를 꺼내는 것이 이 저장소가 이미
 * 두 번 재생산한 결함이다.
 *
 * **응답의 다른 필드를 여기서 끌어오지 않는다.** 결재 진행·`isMyTurn`·대상 유형은 목록의
 * 값이 아니다 — 옮겨 담는 순간 어느 칸에든 그릴 수 있게 되고, 그것이 확정 열 구성을 넘는
 * 첫걸음이 된다.
 */
export const toRequestRow = (request: ApprovalRequest): RequestRow => {
  const reasonFirstLine = firstLineOf(request.reason);

  return {
    approvalRequestId: request.approvalRequestId,
    approvalRequestNo: request.approvalRequestNo,
    approvalTypeCode: request.approvalTypeCode,
    targetName: readableName(request.target.displayName, t.values.unknownTarget),
    reasonFirstLine: reasonFirstLine === '' ? t.values.emptyReason : reasonFirstLine,
    requesterName: readableName(request.requestedByName, t.values.unknownRequester),
    requestedAtText: formatDateTime(request.requestedAt),
  };
};

/**
 * 요청 정보 구획이 **보이는 값 전부**. 여섯이며 사유는 **전문**이다.
 *
 * **행 식별자조차 담지 않는다.** 목록의 행은 고르는 대상이라 `approvalRequestId`가 필요했지만
 * 상세는 이미 골라진 것을 그리는 자리라 그 번호를 쓸 데가 없다 — 담지 않으면 샐 경로도 없다
 * (`omf-mes#44`).
 *
 * **대상·결재 진행을 담지 않는다.** 같은 응답에서 오지만 각자 자기 구획이 있고, 여기에
 * 옮겨 담는 순간 이 구획이 그것을 그릴 수 있게 된다 — 구획의 경계는 타입에서 선다.
 *
 * **상태 코드가 여기에는 있다.** 목록 여섯 열에는 상태가 없지만(열을 늘리는 것보다 줄이는
 * 것이 먼저다) 상세는 「이 요청이 지금 어떤 상태인가」를 말해야 하는 자리다.
 */
export interface RequestDetailView {
  approvalRequestNo: string;
  /** 코드 문자열 그대로. 값 목록이 확정되면 사람이 읽는 이름이 이 자리에 온다(`omf-mes#64`). */
  approvalTypeCode: string;
  requesterName: string;
  requestedAtText: string;
  statusCode: string;
  /** 사유 **전문**. 줄마다 한 칸이며 목록의 첫 줄 규칙이 여기에는 걸리지 않는다. */
  reasonLines: string[];
}

/** 상세 응답의 요청 몸통을 정보 구획이 그릴 값으로 옮긴다. */
export const toRequestDetailView = (request: ApprovalRequest): RequestDetailView => ({
  approvalRequestNo: request.approvalRequestNo,
  approvalTypeCode: request.approvalTypeCode,
  requesterName: readableName(request.requestedByName, t.values.unknownRequester),
  requestedAtText: formatDateTime(request.requestedAt),
  statusCode: request.statusCode,
  reasonLines: toReasonLines(request.reason),
});

/**
 * 확인 창이 **다시 보이는 값 다섯**. 오결재 방어의 마지막 자리다(계획 §13-2 셋째 방어).
 *
 * **왜 창에서 한 번 더 보이는가.** 승인 유형 코드가 미확정인 동안 이 화면은 내가 승인자인
 * 요청을 **전부** 보인다(`omf-mes#64`). 목록 위 안내가 「유형과 사유로 긴급 IQC 생략 건인지
 * 확인하라」고 말하므로, **되돌릴 수 없는 확인을 누르기 직전에** 그 확인 수단이 같은 자리에
 * 다시 서야 한다 — 목록에서 한 줄 잘못 누른 것이 창을 지나며 걸러지는 유일한 길이다.
 *
 * **다섯인 이유.** 요청번호(무엇을)·유형(어느 갈래를)·대상(무엇에 붙는)·상신자(누가 올린)에
 * **사유 첫 줄**(왜)을 더한다. 유형 코드가 미확정인 동안 갈래를 실제로 가려 주는 것은
 * 사유 쪽이고, 상신자는 「내가 기다리던 그 건인가」를 가리는 값이다.
 *
 * **내부 번호를 담지 않는다.** 요약이라도 규율은 같다 — 담지 않으면 창에서 샐 경로가 없다.
 * 상신 일시를 담지 않는 이유는 다르다: 그것은 **고르는 단서**이지 확인의 단서가 아니고,
 * 창이 길어질수록 확인해야 할 값이 스크롤 밖으로 밀린다.
 */
export interface DecisionSubject {
  approvalRequestNo: string;
  /** 코드 문자열 그대로. 값 목록이 확정되기 전에 화면이 이름을 지어내지 않는다. */
  approvalTypeCode: string;
  /** 대상 표시명. **서버가 만든 이름**이라 화면이 짓지 않는다. */
  targetName: string;
  requesterName: string;
  /** 사유의 **첫 줄**. 창은 읽는 자리가 아니라 확인하는 자리라 전문이 오면 다른 값이 묻힌다. */
  reasonFirstLine: string;
}

/** 상세 응답의 요청 몸통을 확인 창이 다시 보일 요약으로 옮긴다. */
export const toDecisionSubject = (request: ApprovalRequest): DecisionSubject => {
  const reasonFirstLine = firstLineOf(request.reason);

  return {
    approvalRequestNo: request.approvalRequestNo,
    approvalTypeCode: request.approvalTypeCode,
    targetName: readableName(request.target.displayName, t.values.unknownTarget),
    requesterName: readableName(request.requestedByName, t.values.unknownRequester),
    reasonFirstLine: reasonFirstLine === '' ? t.values.emptyReason : reasonFirstLine,
  };
};
