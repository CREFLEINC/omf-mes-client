import type { components } from '@omf-mes/api-client';

/**
 * P-02-05 인식표 발행·부착 화면 슬라이스의 계약.
 *
 * ⭐ **개체와 발행 기록이 다른 자원이다** — 인식표 한 장은 개체(`SerialNumber`) 1행과 발행
 * 기록(`DocumentIssue`) 1행으로 남는다. 둘을 한 타입으로 뭉치면 「개체는 있고 발행 기록은
 * 없는」 정상 상태를 표현할 수 없다(스펙 §5-3 · §6).
 */
export type Lot = components['schemas']['Lot'];
export type SerialNumber = components['schemas']['SerialNumber'];
export type DocumentIssue = components['schemas']['DocumentIssue'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueBatchResult = components['schemas']['DocumentIssueBatchResponse'];
export type SerialNumberBatchCreate = components['schemas']['SerialNumberBatchCreate'];
export type SerialNumberBatchResult = components['schemas']['SerialNumberBatchResult'];
export type Printer = components['schemas']['Printer'];

/**
 * 한 번에 다룰 수 있는 개체 수의 상한. **발번도 발행 기록도 같은 값이다**(계약 명시).
 *
 * 상한을 넘긴 요청은 서버가 400 으로 되돌리지만, 화면이 먼저 막아야 사용자가 480 을 4800 으로
 * 잘못 친 것을 **보내기 전에** 안다.
 */
export const MAX_ISSUE_QUANTITY = 1000;

/**
 * 이 화면이 고정으로 싣는 코드값.
 *
 * ⭐ **자리표시가 아니다 — 계약이 값을 닫았다.** 출력물 종류는 enum 9종으로 좁혀졌고
 * (`MATERIAL_LOT_LABEL`·`GOODS_ISSUE_QR`·`PRODUCTION_LOT_LABEL`·`IDENTIFICATION_TAG`·
 * `PACKING_LABEL`·`DELIVERY_LABEL`·`CERTIFICATE_OF_ANALYSIS`·`TOOL_LABEL`·`LOCATION_LABEL`),
 * 대상 유형은 공유계약 A-10 대응표로 닫혔다. 전례가 이미 확정값을 쓴다
 * (`packing-label-reprint/types.ts` 의 `DOCUMENT_TYPE_CODES`).
 *
 * ⛔ **`TAG` 로 되돌리지 않는다.** 종전 자리표시 `TAG` 는 좁혀진 목록에 없어 서버가 422 로
 * 거절했고, 화면은 그것을 「프린터를 확인할 수 없습니다」로 표시했다 — 실기 확인이 이 값
 * 하나에 막혔다(실측).
 *
 * ⛔ **이 값들을 사용자에게 선택지로 보이지 않는다.** 화면이 고정으로 싣는 값이지 사람이 고르는
 * 값이 아니다.
 */
export const ISSUE_CODES = {
  /** 출력물 종류 — 인식표. */
  documentType: 'IDENTIFICATION_TAG',
  /** 발행 대상 유형 — 개체(일련번호)를 가리킨다. */
  serialTargetType: 'SERIAL_NUMBER',
} as const;

/**
 * 발행이 어디까지 갔는가. **두 호출 사이에서 끊길 수 있어 상태가 셋이다**(스펙 §5-3 · §6).
 *
 * | 상태 | 뜻 |
 * | --- | --- |
 * | `idle` | 아직 발행하지 않았다 |
 * | `serialsIssued` | 개체는 만들어졌고 **발행 기록이 없다** — 오류가 아니라 표현 가능한 상태다 |
 * | `documentsIssued` | 발행 기록까지 만들어졌다 |
 *
 * ⛔ **`serialsIssued` 에서 개체를 다시 만들지 않는다.** 번호에 구멍이 나면 메울 화면이 없다.
 */
export type IssuePhase = 'idle' | 'serialsIssued' | 'documentsIssued';

/** 발행 진행 중에 화면이 들고 있는 것. 재시도가 여기서 이어진다. */
export interface IssueProgress {
  phase: IssuePhase;
  /** ①이 만든 개체. `serialsIssued` 이후에만 채워진다 */
  serials: SerialNumber[];
  /** ②가 만든 발행 기록. `documentsIssued` 이후에만 채워진다 */
  issues: DocumentIssue[];
}

export const emptyIssueProgress: IssueProgress = {
  phase: 'idle',
  serials: [],
  issues: [],
};
