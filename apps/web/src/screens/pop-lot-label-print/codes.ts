/**
 * 이 화면이 **보내는** 코드 값 — 확정된 것을 한 곳에 모은다.
 *
 * 값을 화면 곳곳에 흩어 두면 통지가 왔을 때 무엇을 고쳐야 하는지 셀 수 없다.
 *
 * | 값 | 상태 | 근거 |
 * | --- | :-: | --- |
 * | `DOCUMENT_TYPE_CODE` | ✅ 확정 | 스펙 §8-1 해소(2026-09-02) · 계약 `DocumentIssue.documentTypeCode` enum 9종 |
 * | `DOCUMENT_TARGET_TYPE_CODE` | ✅ 확정 | 스펙 §4-A · §5-2 — 이 화면의 대상은 LOT 이다 |
 * | `LOT_TYPE_CODE` | ✅ 확정 | 계약 `GET /trace/lots` 의 `lotTypeCode` 값 목록 |
 * | `REISSUE_REASON_CODE_GROUP` | ✅ 확정 | 계약 `GET /mdm/code-values` |
 */

/**
 * 생산LOT 라벨.
 *
 * ⭐ **자리표시가 아니다.** 스펙 §8-1 의 「`document_type_code` 값 목록」 미결이 2026-09-02 에
 * 종결됐고, 계약이 `enum` 9종으로 닫았다 — 이 화면은 `PRODUCTION_LOT_LABEL`, 인식표
 * (`P-02-05`)는 `IDENTIFICATION_TAG` 로 갈렸다.
 *
 * ⛔ 등록부(`GET /mdm/code-values`)로 받지 않는다 — 설계가 정하는 업무 코드이지 운영이 채우는
 * 값 목록이 아니다(`A-16` 판정).
 */
export const DOCUMENT_TYPE_CODE = 'PRODUCTION_LOT_LABEL';

/**
 * 발행 대상이 **LOT** 임을 뜻한다.
 *
 * ⚠ **인식표와 갈리는 자리다.** `document_issue_log` 는 다형 참조(`targetTypeCode`+`targetId`)와
 * `lotId` FK 를 함께 갖는데, 이 화면에서는 **둘이 같은 것을 가리킨다**(스펙 §5-2). 인식표는
 * 다르다 — `targetId` 가 개체이고 `lotId` 는 소속 LOT 이다.
 *
 * ⛔ 그래서 화면은 **`targetTypeCode` 로 먼저 판정한다.** `lotId` FK 만 보고 세면 인식표 발행
 * 기록이 LOT 라벨 회차에 섞인다(A-10 규칙 3 의 예외).
 */
export const DOCUMENT_TARGET_TYPE_CODE = 'LOT';

/** 생산 LOT. 계약이 `MATERIAL`·`PRODUCTION`·`PRODUCT` 세 값을 코드 그룹 `LOT_TYPE` 으로 닫았다. */
export const LOT_TYPE_CODE = 'PRODUCTION';

/**
 * 재발행 사유 값 목록을 받는 코드 그룹(슬라이스 ③에서 쓴다).
 *
 * ⛔ 채번 식별자(`codeGroupId`)를 쓰지 않는다 — 환경마다 다르다(공유계약 G-32).
 */
export const REISSUE_REASON_CODE_GROUP = 'REISSUE_REASON';
