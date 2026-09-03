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
 * 출력물 종류 — **`GOODS_ISSUE_QR` 로 확정됐다**(스펙 §4-A · §5-1).
 *
 * 발행 화면 아홉 장이 같은 표(`app.document_issue_log`)를 쓰고 그 아홉을 이 코드 하나가 가른다.
 * 값이 갈리지 않으면 발행 이력 조회가 섞이고 프린터 거르기가 서지 않는다.
 *
 * ⛔ **`ISSUE_QR` 을 쓰지 않는다.** 이 계약에서 `issue` 는 일관되게 「발행」이라
 * (`DocumentIssue`·`issueSeq`·`issueCount`) 「발행 QR」로 읽힌다 — 「출고」의 확정 어휘는
 * `GOODS_ISSUE` 다.
 */
export const DOCUMENT_TYPE_CODE = 'GOODS_ISSUE_QR';

/**
 * 대상 유형 — 이 화면 몫은 둘이다(스펙 §4-A · §5-2).
 *
 * 설계 계약이 일곱 값으로 닫았고 그중 라인 단위가 `GOODS_ISSUE_LINE`, 파렛트 단위가
 * `HANDLING_UNIT` 이다. ⚠ **이 저장소의 생성 타입은 아직 그 판이 아니다** — `api.d.ts` 의
 * `targetTypeCode` 가 여전히 `string` 이라 타입이 값을 지켜 주지 못한다. 계약 생성물을 다시
 * 뽑으면 그때 타입이 이 상수를 검사한다.
 *
 * ⚠ **파렛트 단위는 값이 아니라 대상을 고를 조회 축이 없어 서지 못한다** —
 * 전표에 딸린 취급 단위를 좁혀 주는 질의가 계약에 없다(`GET /inventory/handling-units` 는
 * 창고·로케이션·유형·상태로만 거른다).
 */
export const LINE_TARGET_TYPE_CODE = 'GOODS_ISSUE_LINE';

/**
 * 발행 단위. **화면 안에서만 쓰는 구분이다** — 이 값 자체는 서버로 나가지 않고,
 * 나가는 것은 위 대상 유형 코드다.
 *
 * ⚠ 파렛트는 **고를 대상을 찾을 길이 없어** 아직 고를 수 없다. 선택지를 감추지 않고 사유와
 * 함께 비활성으로 둔다 — 없는 기능인지 아직 못 여는 기능인지 사용자가 구분할 수 있어야 한다.
 */
export const ISSUE_UNIT = {
  line: 'LINE',
  pallet: 'PALLET',
} as const;

export type IssueUnit = (typeof ISSUE_UNIT)[keyof typeof ISSUE_UNIT];

/** 재발행 사유 값 목록이 사는 공통코드 그룹. 계약이 이 이름을 가리킨다. */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';
