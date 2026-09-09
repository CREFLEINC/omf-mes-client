import type { components } from '@omf-mes/api-client';

/** P-01-02 화면 슬라이스의 계약. */
export type GoodsIssue = components['schemas']['GoodsIssue'];
export type GoodsIssueLine = components['schemas']['GoodsIssueLine'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type PrintOutcomeReport = components['schemas']['PrintOutcomeReport'];
export type Printer = components['schemas']['Printer'];
export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];

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
 * 계약이 일곱 값으로 닫았고 그중 라인 단위가 `GOODS_ISSUE_LINE`, 파렛트 단위가
 * `HANDLING_UNIT` 이다. 생성 타입이 그 `enum` 을 들고 있어 **틀린 값은 타입 검사가 잡는다**
 * (설계 변동 공지 `CREFLEINC/omf-mes#425` 로 편입).
 *
 * ⭐ **파렛트 단위의 대상 축이 섰다**(설계 회신 2026-09-06 · 공지 `CREFLEINC/omf-mes#507`) —
 * `GET /inventory/handling-units?lotId=` 가 **이 출고 라인의 LOT 이 실린 취급 단위만** 낸다.
 * 취급 단위를 만드는 것은 `M-01-08` 이고 이 화면은 조회만 한다.
 */
export const LINE_TARGET_TYPE_CODE = 'GOODS_ISSUE_LINE';

/**
 * 파렛트 단위의 대상 유형(스펙 §5-2).
 *
 * ⛔ **파렛트 발행은 `lotId` 를 싣지 않는다.** 취급 단위 하나가 여러 LOT 을 담아 한 칸에 담을
 * 수 없다 — 계약이 `lot_id` 를 nullable 로 둔 이유가 그것이고, 아무 LOT 이나 골라 채우면
 * 발행 이력이 그 LOT 하나의 것으로 굳는다.
 */
export const PALLET_TARGET_TYPE_CODE = 'HANDLING_UNIT';

/**
 * 이 화면이 발행 이력을 물을 때 쓰는 대상 유형 — 둘뿐이다.
 *
 * ⛔ **`string` 으로 넓히지 않는다.** 계약이 `enum` 으로 닫은 축이라, 넓히면 틀린 값이
 * 타입 검사를 그대로 지나가고 서버가 400 을 낼 때에야 드러난다.
 */
export type IssueTargetTypeCode = typeof LINE_TARGET_TYPE_CODE | typeof PALLET_TARGET_TYPE_CODE;

/**
 * 발행 단위. **화면 안에서만 쓰는 구분이다** — 이 값 자체는 서버로 나가지 않고,
 * 나가는 것은 위 대상 유형 코드다.
 *
 * ⚠ 파렛트 단위는 **라인을 하나만 고른 상태에서** 선다 — 대상 목록이 그 라인의 LOT 으로
 * 좁혀지기 때문이다(스펙 §5-2). 여러 라인을 고르면 어느 LOT 으로 좁힐지 화면이 정하게 된다.
 */
export const ISSUE_UNIT = {
  line: 'LINE',
  pallet: 'PALLET',
} as const;

export type IssueUnit = (typeof ISSUE_UNIT)[keyof typeof ISSUE_UNIT];

/** 재발행 사유 값 목록이 사는 공통코드 그룹. 계약이 이 이름을 가리킨다. */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';
