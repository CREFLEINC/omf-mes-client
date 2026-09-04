/**
 * 이 화면이 **보내는** 코드 값 — 확정된 것과 아직 아닌 것을 한 곳에서 가른다.
 *
 * 값을 화면 곳곳에 흩어 두면 확정 통지가 왔을 때 무엇을 고쳐야 하는지 셀 수 없다. 그래서
 * 보내는 코드는 전부 여기 모으고, **자리표시인 것에는 그 사실을 붙인다.**
 *
 * | 값 | 상태 | 근거 |
 * | --- | :-: | --- |
 * | `LOT_SOURCE_TYPE_CODE` | 확정 | 변경 통지 #664 (`omf-mes#326` 회신) |
 * | `LOT_NUMBER_SOURCE_CODE` | 확정 | 계약 `LotCreate.numberSourceCode` enum |
 * | `LOT_TYPE_CODE` | 확정 | 계약 `GET /trace/lots` 의 `lotTypeCode` 값 목록 |
 * | `DOCUMENT_TYPE_CODE` | ⚠ **자리표시** | 착수 이슈 #139 §4 · `omf-mes#145` |
 * | `DOCUMENT_TARGET_TYPE_CODE` | ⚠ **자리표시** | 계약 `DocumentTarget.targetTypeCode` · `omf-mes#145` |
 */

/**
 * 자재LOT 의 원천은 **입하 «라인»**이다 — 입하 «건»이 아니다.
 *
 * ⛔ `INBOUND_RECEIPT` 를 쓰지 않는다. 그 값은 입하 건을 뜻하고, 계약이 예시값 자리에 그것을
 * 적어 두었던 것은 설계팀 오기였다(변경 통지 #664 가 정정했다).
 *
 * ⭐ 값 규약 — **값은 언제나 `sourceId` 가 «가리키는 것»을 이름한다.** 계보의 정방향이
 * `InboundReceiptLine.lotId` 로 라인에 붙으므로 역방향도 라인이어야 짝이 맞는다.
 */
export const LOT_SOURCE_TYPE_CODE = 'INBOUND_RECEIPT_LINE';

/**
 * 번호를 **서버가 매긴다.**
 *
 * 이 화면은 공급사 LOT 이 붙어 오지 않은 자재만 다루므로(`supplierLotMissing=true`) 발번
 * 경로가 하나로 정해져 있다. ⛔ `lotNo` 를 함께 보내면 400 이다 — 계약이 「안 준 것」과
 * 「못 정한 것」을 가르지 않으려고 **누가 매기는가**를 직접 받는다.
 */
export const LOT_NUMBER_SOURCE_CODE = 'MES';

/** 자재 LOT. 계약이 `MATERIAL`·`PRODUCTION`·`PRODUCT` 세 값을 적어 두었다. */
export const LOT_TYPE_CODE = 'MATERIAL';

/**
 * ⚠ **자리표시다.** 「자재LOT 라벨」을 뜻하는 문서 유형 코드 문자열이 아직 정해지지 않았다
 * (`omf-mes#145` — 업무 코드 51종의 값 목록 확정 대기).
 *
 * 착수 이슈 #139 §4 가 이 항목의 처리 방법을 **「자리표시 상수 + 안내」**로 지정했다. 값이
 * 확정되면 이 줄 하나만 바꾼다 — 화면·요청 조립 코드는 건드릴 것이 없다.
 */
export const DOCUMENT_TYPE_CODE = 'MATERIAL_LOT_LABEL';

/**
 * ⚠ **자리표시다.** 발행 대상이 LOT 임을 뜻하는 코드 문자열이 아직 정해지지 않았다 — 계약
 * `DocumentTarget.targetTypeCode` 가 「값 문자열은 아직 확정되지 않았다」로 명시한다.
 *
 * 위와 같은 이유로 이 줄 하나만 바꾸면 된다.
 */
export const DOCUMENT_TARGET_TYPE_CODE = 'LOT';

/**
 * 재발행 사유 값 목록을 받는 코드 그룹.
 *
 * ⛔ 채번 식별자(`codeGroupId`)를 쓰지 않는다 — 환경마다 다르다(계약 명시). 코드로 받는다.
 */
export const REISSUE_REASON_CODE_GROUP = 'REISSUE_REASON';
