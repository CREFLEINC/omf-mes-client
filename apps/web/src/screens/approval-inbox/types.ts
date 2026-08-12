import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * W-CO-09 화면 슬라이스의 계약 타입과 화면 타입.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

const t = messages.approvalInbox;

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
 * 조회 조건. **주소가 소유하며 화면 상태로 복제하지 않는다.**
 *
 * 전부 문자열이다 — 선택칸·입력칸이 다루는 것이 문자열이고, 계약 표현으로의 변환은
 * `filters.ts` 한 곳이 맡는다. 탭과 쪽은 여기 없다: 탭은 조건이 아니라 **조회 범위**이고
 * (`tabs.ts`가 소유한다) 쪽은 조건이 바뀔 때마다 되돌아가는 별개의 값이다.
 */
export interface InboxFilters {
  /** 승인 유형 코드. 값 목록이 확정되지 않아 지금은 고를 선택지가 없다(`code-options.ts`). */
  approvalTypeCode: string;
  /** 요청 상태 코드. 같은 위. */
  statusCode: string;
  /** 상신일 구간 시작. 계약이 `format: date`라 `YYYY-MM-DD` 그대로 나간다. */
  from: string;
  to: string;
  /** 요청번호 검색어. */
  q: string;
}

/**
 * 목록 한 행이 **보이는 값 전부**. 여섯이며 **설계 스펙이 확정한 필드 목록 그대로**다 —
 * 화면이 열을 더하거나 다른 값으로 바꾸지 않는다.
 *
 * **내부 번호를 담지 않는다**(`requestedBy`·`targetId`·`targetTypeCode`). 계약이 표시용 이름을
 * 함께 내려 주므로 화면이 번호를 낼 이유가 없고, 이 타입이 번호를 나르지 않으면 어느 칸에서도
 * 샐 경로가 없다. `approvalRequestId`만 남는데 그것은 **행을 식별하고 고르는 데만** 쓰이며
 * 어느 칸에도 그려지지 않는다. `approvalRequestNo`는 업무 번호라 그대로 낸다.
 *
 * **대상 표시명을 담지 않는다.** 대상은 상세 구획 소관이라 목록에 오지 않는다.
 * **진행 단계도 담지 않는다.** 확정 필드 목록에 없다 — 결재 진행은 상세가 그린다.
 */
export interface RequestRow {
  approvalRequestId: number;
  approvalRequestNo: string;
  /** 코드 문자열 그대로. 값 목록이 확정되면 사람이 읽는 이름이 이 자리에 온다(`omf-mes#64`). */
  approvalTypeCode: string;
  requesterName: string;
  requestedDate: string;
  statusCode: string;
  reasonFirstLine: string;
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
 * 상신일 칸. 계약의 `date-time`에서 **날짜 조각만** 뽑는다.
 *
 * **실행 환경 시간대로 옮기지 않는다.** 서버가 적어 보낸 벽시계 날짜가 현장이 쓰는 날짜이고,
 * 옮기면 같은 요청이 보는 사람마다 다른 날에 올라온 것으로 보인다(`master-change`와 같은 규율).
 *
 * 형식이 아니면 원문을 그대로 낸다 — 자료를 잃는 것보다 낫다.
 */
const DATE_PART_PATTERN = /^(\d{4}-\d{2}-\d{2})T/;

export const toRequestedDate = (requestedAt: string): string =>
  DATE_PART_PATTERN.exec(requestedAt)?.[1] ?? requestedAt;

/**
 * 계약 응답 한 건을 목록 행으로 옮긴다.
 *
 * 상신자 이름이 비어 있으면 **번호를 대신 내지 않는다**(`omf-mes#44`). 계약이 그 값을 필수로
 * 두었으나 빈 문자열은 스키마상 통과하며, 그 자리에서 번호를 꺼내는 것이 이 저장소가 이미
 * 두 번 재생산한 결함이다.
 *
 * **응답의 다른 필드를 여기서 끌어오지 않는다.** 대상·진행 단계는 목록의 값이 아니다 —
 * 옮겨 담는 순간 어느 칸에든 그릴 수 있게 되고, 그것이 확정 필드 목록을 넘는 첫걸음이 된다.
 */
export const toRequestRow = (request: ApprovalRequest): RequestRow => {
  const reasonFirstLine = firstLineOf(request.reason);

  return {
    approvalRequestId: request.approvalRequestId,
    approvalRequestNo: request.approvalRequestNo,
    approvalTypeCode: request.approvalTypeCode,
    requesterName:
      request.requestedByName === '' ? t.values.unknownRequester : request.requestedByName,
    requestedDate: toRequestedDate(request.requestedAt),
    statusCode: request.statusCode,
    reasonFirstLine: reasonFirstLine === '' ? t.values.emptyReason : reasonFirstLine,
  };
};
