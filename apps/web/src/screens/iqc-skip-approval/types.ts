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
