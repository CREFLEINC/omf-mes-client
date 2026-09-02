import type { components } from '@omf-mes/api-client';

/** P-01-02 화면 슬라이스의 계약. */
export type GoodsIssue = components['schemas']['GoodsIssue'];
export type GoodsIssueLine = components['schemas']['GoodsIssueLine'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type PrintOutcomeReport = components['schemas']['PrintOutcomeReport'];
export type Printer = components['schemas']['Printer'];

/**
 * 출력물 종류 — **아직 확정되지 않은 값의 자리표시다.**
 *
 * ⛔ **화면이 정한 값이 아니다.** 발행 화면 다섯 장이 같은 표(`app.document_issue_log`)를 쓰고
 * 그 다섯을 이 코드 하나가 가르는데, 값 목록의 소관은 설계(`omf-mes#145`)이고 아직 열려 있다.
 * 스펙은 「출고 QR 은 `ISSUE_QR` 류」까지만 적었다 — **「류」가 잠정이라는 표시다.**
 *
 * ⚠ **값이 확정되면 이 상수 하나만 바뀐다.** 그래서 코드 문자열을 다른 파일에 두지 않는다 —
 * 여기저기 박아 두면 확정 뒤에 무엇을 고쳐야 하는지 화면이 스스로 말하지 못한다.
 *
 * ⚠ **화면은 이 값을 사람에게 보이지 않는다.** 보이는 자리에는 「확정 전」 안내가 대신 선다 —
 * 지어낸 값을 업무 용어처럼 읽히게 두지 않는다.
 */
export const PLACEHOLDER_DOCUMENT_TYPE_CODE = 'ISSUE_QR';

/**
 * 라인 단위 발행의 대상 유형 — **이것도 자리표시다**(위와 같은 사정 · `omf-mes#145`).
 *
 * 계약의 대상 유형 대응표가 「출고 라인」 자리를 잠정 문자열로 두었다. 파렛트 단위의 값
 * (취급 단위)은 유형 전환이 열릴 때 함께 온다 — 그때까지 이 화면은 라인 단위로만 발행한다.
 */
export const PLACEHOLDER_LINE_TARGET_TYPE_CODE = 'GOODS_ISSUE_LINE';

/**
 * 발행 단위. **화면 안에서만 쓰는 구분이다** — 서버로 나가는 값이 아니다.
 *
 * ⚠ 파렛트는 값 목록이 도착하기 전까지 **고를 수 없다.** 선택지를 감추지 않고 사유와 함께
 * 비활성으로 둔다 — 없는 기능인지 아직 못 여는 기능인지 사용자가 구분할 수 있어야 한다.
 */
export const ISSUE_UNIT = {
  line: 'LINE',
  pallet: 'PALLET',
} as const;

export type IssueUnit = (typeof ISSUE_UNIT)[keyof typeof ISSUE_UNIT];

/** 재발행 사유 값 목록이 사는 공통코드 그룹. 계약이 이 이름을 가리킨다. */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';
