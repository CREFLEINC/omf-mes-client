import type { CodeValue, Lot, LotProgress } from './types';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다.
 */

export const WORK_ORDER_ID = 1001;
export const WORKER_NO = '3391';
export const TERMINAL_ID = 210;
export const PROCESS_ID = 501;
export const LOT_ID = 90101;
export const LOT_NO = 'LOT-SAMPLE-0031';
export const TARGET_QTY = 500;
export const REASON_CODE = 'MATERIAL_SHORTAGE';
export const REASON_NAME = '자재 부족';

export const makeLot = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: LOT_ID,
  lotNo: LOT_NO,
  itemId: 2001,
  lotTypeCode: 'PRODUCTION',
  plantId: 1,
  initialQty: TARGET_QTY,
  uomId: 1,
  sourceTypeCode: 'WORK_ORDER',
  sourceId: WORK_ORDER_ID,
  statusCode: 'NORMAL',
  ...overrides,
});

/** 서버가 내리는 진척. **판정도 서버가 준다** — 화면이 누적과 목표를 비교하지 않는다. */
export const makeProgress = (
  goodQty: number,
  code: LotProgress['completionJudgmentCode'],
): LotProgress => ({
  goodQty,
  achievementRate: goodQty / TARGET_QTY,
  varianceQty: goodQty - TARGET_QTY,
  completionJudgmentCode: code,
});

/**
 * 상세 응답. `progress` 가 `null` 이면 **`withProgress` 를 켜지 않았을 때의 응답**이다 —
 * 「양품이 0」이 아니라 「모른다」이며, 화면은 그 둘을 갈라야 한다.
 */
export const lotDetailResponse = (
  progress: LotProgress | null,
  overrides: Partial<Lot> = {},
): { lot: Lot; externalIdentifiers: []; holds: [] } => ({
  lot: {
    ...makeLot(overrides),
    ...(progress === null ? {} : { progress }),
  },
  externalIdentifiers: [],
  holds: [],
});

export const makeReason = (overrides: Partial<CodeValue> = {}): CodeValue => ({
  codeValueId: 7001,
  codeGroupId: 700,
  code: REASON_CODE,
  codeName: REASON_NAME,
  displayOrder: 1,
  isActive: true,
  ...overrides,
});
