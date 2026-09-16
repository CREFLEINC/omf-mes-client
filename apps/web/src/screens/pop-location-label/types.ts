import type { components } from '@omf-mes/api-client';

/** P-06-01 화면 슬라이스의 계약. */
export type Warehouse = components['schemas']['Warehouse'];
export type Location = components['schemas']['Location'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type Printer = components['schemas']['Printer'];
export type CodeValue = components['schemas']['CodeValue'];

/**
 * 출력물 종류 — **`LOCATION_LABEL`**(출력물 요구서 §3-8 · 계약 enum 9종).
 *
 * 발행 화면 아홉 장이 같은 표를 쓰고 그 아홉을 이 코드 하나가 가른다. 값이 갈리지 않으면
 * 발행 이력 조회가 섞이고 `GET /app/printers` 의 프린터 거르기가 서지 않는다.
 */
export const DOCUMENT_TYPE_CODE = 'LOCATION_LABEL';

/**
 * 대상 유형 — 위치다.
 *
 * ⚠ **설계 문서는 아직 이 문자열을 「잠정」으로 둔다**(출력물 요구서 §3-7 · 확정 주체
 * `omf-mes#145`). 그러나 계약 enum 과 서버 구현은 이미 `LOCATION` 으로 움직이고 있고,
 * 관리웹 `W-06-07` 도 같은 값을 보낸다 — **한 저장소 안에서 두 값을 쓰지 않는다.**
 * 확정 통지를 요청서로 올려 두었다.
 */
export const TARGET_TYPE_CODE = 'LOCATION';

/**
 * 재발행 사유의 공통코드 그룹.
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 하드코딩하지 않는다** — 환경마다 다르다. 그룹 «코드»로 묻는다.
 */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';

/**
 * 한 번에 보낼 수 있는 대상 수 — 계약이 `maxItems: 1000` 으로 닫았다.
 *
 * ⛔ **넘겨 보내지 않는다.** 발행은 한 트랜잭션이라 넘치면 **전건이 실패**한다 — 고른 것 중
 *    일부만 나오는 것이 아니라 한 장도 안 나온다.
 */
export const MAX_TARGETS = 1000;

/** 목록 한 쪽에 받는 위치 수. 창고 하나의 선반·칸이 이보다 많으면 쪽을 넘긴다. */
export const LOCATION_PAGE_SIZE = 50;
