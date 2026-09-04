import type { components } from '@omf-mes/api-client';

/**
 * P-02-09 포장 라벨·인식표 재출력·부착 화면 슬라이스의 계약.
 *
 * ⭐ **재발행이 정상 경로인 유일한 화면이다**(스펙 §5-1). 다른 라벨 화면은 최초 발행이 정상이고
 * 재발행이 예외인데, 여기는 반대다 — 포장 후 겉면에 다시 붙일 것을 찍는 것이 본래 목적이라
 * 회차가 대개 2 이상이고 사유가 기본 입력이다. **사유 칸을 예외 흐름에 숨기지 않는다.**
 */
export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];
export type DocumentIssueSummary = components['schemas']['DocumentIssueSummary'];
export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type DocumentIssueBatchResult = components['schemas']['DocumentIssueBatchResponse'];
export type CodeValue = components['schemas']['CodeValue'];
export type Printer = components['schemas']['Printer'];

/**
 * 한 번에 보낼 수 있는 대상 수의 상한. **발행 요청과 요약 조회가 같은 값이다**(계약 명시).
 *
 * 포장 하나의 내용물이 이 수를 넘는 일은 현장에서 드물지만, 넘으면 요약 조회가 400 으로
 * 되돌아와 **회차 열이 통째로 비므로** 화면이 먼저 알고 사유를 말해야 한다.
 */
export const MAX_TARGETS = 1000;

/**
 * 재발행 사유 값이 사는 공통코드 그룹.
 *
 * ⛔ **채번 식별자(`codeGroupId`)를 하드코딩하지 않는다** — 환경마다 다르다(계약 명시).
 * 이름으로 가리키는 것이 화면이 그룹을 안정적으로 지목할 수 있는 유일한 수단이다.
 */
export const REISSUE_REASON_GROUP_CODE = 'REISSUE_REASON';

/**
 * 출력물 종류 — **2026-09-02 에 계약이 `enum` 9종으로 닫았다**(요구서 §3-8 · `omf-mes#145`).
 *
 * 이 화면은 두 값을 다룬다. 착수 이슈(2026-09-01)의 미결표는 이 축을 아직 「자리표시」로 적고
 * 있으나, 그보다 **하루 뒤에 확정된 정본**이 있어 확정값을 싣는다.
 */
export const DOCUMENT_TYPE_CODES = {
  /** 포장 라벨 — 포장 겉면에 붙는다 */
  packingLabel: 'PACKING_LABEL',
  /** 인식표 — 개체마다 붙는다 */
  identificationTag: 'IDENTIFICATION_TAG',
} as const;

/**
 * 대상 유형 — **공유계약 A-10 의 대응표가 값을 닫았다**(2026-09-03 · `CD-DOCUMENT-ISSUE-TARGET-TYPE`).
 *
 * ⭐ **`targetTypeCode` 를 먼저 보고 판정한다**(A-10 규칙 3·4 · 스펙 §5-3). 참조 키(`targetId`)로
 * 먼저 갈래를 잡으면 인식표 재출력이 LOT 라벨로 잘못 기록된다 — LOT 은 `targetId` 와 `lotId` 가
 * 같은 값이고 개체는 다르다.
 */
export const TARGET_TYPE_CODES = {
  /** 생산·제품 LOT. 포장 라벨의 대상이다 */
  lot: 'LOT',
  /** 개체 일련번호. 인식표의 대상이지만 이 화면은 개체를 특정할 수 없다(아래) */
  serialNumber: 'SERIAL_NUMBER',
} as const;

/**
 * 재출력 대상 한 줄. **화면이 그리는 단위이자 발행 요청의 대상 단위**다.
 *
 * ⭐ **`targetTypeCode` 를 먼저 보고 판정한다**(A-10 규칙 3·4 · 스펙 §5-3). 참조 키(`targetId`)로
 * 먼저 갈래를 잡으면 인식표 재출력이 LOT 라벨로 잘못 기록된다 — LOT 은 `targetId` 와 `lotId` 가
 * 같은 값이고 개체는 다르다.
 */
export interface ReprintTarget {
  /** 화면 안에서만 쓰는 줄 식별자. 유형이 섞이므로 `targetId` 만으로는 유일하지 않다 */
  rowId: string;
  /** 계약이 대상 유형을 닫았다(코드 사전 2026-09-03) — 발행 본문에 그대로 실린다 */
  targetTypeCode: DocumentIssueCreate['targets'][number]['targetTypeCode'];
  targetId: number;
  /** 소속 LOT. 대상이 LOT 자신이면 `targetId` 와 같다 */
  lotId: number;
  documentTypeCode: DocumentIssueCreate['documentTypeCode'];
  /** 화면에 그대로 쓰는 표시명 */
  displayName: string;
  /** 포장에 든 수량. 개체 대상의 「범위」를 말할 때 쓴다 */
  qty: number;
  /** 지금까지 발행된 횟수. 요약을 아직 못 받았으면 `null` — 「모른다」와 「0」은 다르다 */
  issueCount: number | null;
  /** 마지막 발행 시각. 없으면 `null` */
  lastIssuedAt: string | null;
  /**
   * 고를 수 없는 사유. `null` 이면 고를 수 있다.
   *
   * ⚠ 개체(인식표) 대상이 여기 걸린다 — 포장 내용물에 개체 참조가 없어 「이 박스에 든 개체가
   * 어느 것인가」를 데이터로 좁힐 수 없다(스펙 §5-2 · `omf-mes#64`).
   */
  disabledReason: string | null;
}

/**
 * 좌단 《포장 단위》의 내용물 한 줄.
 *
 * ⚠ **이름 셋이 각각 `null` 일 수 있다.** 내용물이 나르는 것은 내부 번호뿐이라 이름은 따로
 * 풀어야 하고, 그 조회가 늦거나 실패하면 그 칸만 빈다 — **번호로 메우지 않는다**(`queries.ts`).
 */
export interface PackingContentRow {
  handlingUnitContentId: number;
  lotId: number;
  itemId: number;
  qty: number;
  lotNo: string | null;
  itemCode: string | null;
  uomCode: string | null;
}

/**
 * 혼적 — 한 포장에 LOT 이 둘 이상 들었는가(스펙 §3 좌단 ⚠).
 *
 * ⭐ **품목이 아니라 LOT 으로 센다.** 같은 품목이라도 LOT 이 갈리면 붙일 라벨이 갈린다.
 */
export const isMixedLot = (rows: readonly PackingContentRow[]): boolean =>
  new Set(rows.map((row) => row.lotId)).size > 1;
