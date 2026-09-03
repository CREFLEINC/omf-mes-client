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
 * ⚠ **값 목록이 확정되지 않은 코드들 — 자리표시다**(착수 이슈 미결표 · 요구서 §3-1, `omf-mes#145`).
 *
 * 확정되면 **이 파일 한 곳만** 바뀐다. 화면 곳곳에 문자열을 흩뿌리면 값이 도착했을 때 어디를
 * 고쳐야 하는지 알 수 없고, 고치다 만 자리가 조용히 남는다.
 *
 * ⛔ **이 값들을 사용자에게 선택지로 보이지 않는다.** 화면이 고정으로 싣는 값이지 사람이 고르는
 * 값이 아니다 — 고르게 두면 확정되지 않은 값을 사용자가 고른 것으로 기록에 남는다.
 */
export const PLACEHOLDER_CODES = {
  /** 출력물 종류 — 인식표(TAG 계열). 값 미확정 */
  documentType: 'IDENTIFICATION_TAG',
  /** 발행 대상 유형 — 개체(일련번호)를 가리킨다. 값 미확정 */
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
