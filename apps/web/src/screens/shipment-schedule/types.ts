import type { components } from '@omf-mes/api-client';

/**
 * W-04-02 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **읽기만 한다.** `GET /logistics/shipment-requests`만 부른다 — 행 클릭으로
 * 편성(`W-04-01`)·출하 확정(`W-04-04`)으로 이동하는 액션은 그 화면들이 이 저장소에 아직 없어
 * 이번 슬라이스에 없다(계획서 미결 항목).
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];
type ShipmentRequestLineResponse = components['schemas']['ShipmentRequestLine'];
type CompletionBlocker = components['schemas']['ShipmentCompletionBlocker'];

export type BlockerCode = CompletionBlocker['code'];

/**
 * 막는 이유의 갈래(omf-all-around#342). 목록 칩과 상세 띠가 **이 한 곳**을 함께 쓴다.
 *
 * - `issue` — 사람이 풀어야 하는 진짜 이슈(불합격 · 보류 · 수주 라인 취소). 붉게 「막힘 n」.
 * - `inProgress` — 정상 진행 중(피킹 부족 · 미검사). 진행 칩이 이미 말하므로 목록에 칩을 달지 않는다.
 * - `status` — 상태 알림(이미 출하 완료). 상세 칸을 숨긴다.
 *
 * ⛔ 서버 목록은 그대로다 — 관리웹 표시만 가른다. POP 출하 완료(P-04-07)는 이 갈래를 쓰지 않는다.
 */
export type BlockerKind = 'issue' | 'inProgress' | 'status';

const BLOCKER_KIND: Record<BlockerCode, BlockerKind> = {
  REJECTED: 'issue',
  HELD: 'issue',
  SALES_ORDER_LINE_CANCELLED: 'issue',
  PICKING_SHORT: 'inProgress',
  NOT_INSPECTED: 'inProgress',
  ALREADY_COMPLETED: 'status',
};

/** 모르는 코드(서버가 새 값을 더한 경우)는 이슈로 본다 — 조용히 숨기지 않는다. */
export const blockerKind = (code: BlockerCode): BlockerKind =>
  (BLOCKER_KIND as Partial<Record<string, BlockerKind>>)[code] ?? 'issue';

/** 막는 이유를 갈래별로 센 값. */
export interface BlockerTally {
  /** 진짜 이슈 수 — 「막힘 n」의 n. */
  issueCount: number;
  /** 정상 진행 중인 이유 수(피킹 부족 · 미검사). */
  inProgressCount: number;
  /** 피킹 부족이 하나라도 있다 — 출하일이 지났으면 「지연」. */
  pickingShort: boolean;
  /** 「이미 출하 완료」가 있다. */
  completed: boolean;
}

export const tallyBlockers = (blockers: readonly { code: BlockerCode }[]): BlockerTally =>
  blockers.reduce<BlockerTally>(
    (tally, { code }) => {
      const kind = blockerKind(code);
      return {
        issueCount: tally.issueCount + (kind === 'issue' ? 1 : 0),
        inProgressCount: tally.inProgressCount + (kind === 'inProgress' ? 1 : 0),
        pickingShort: tally.pickingShort || code === 'PICKING_SHORT',
        completed: tally.completed || kind === 'status',
      };
    },
    { issueCount: 0, inProgressCount: 0, pickingShort: false, completed: false },
  );

/**
 * 상세 「출하 완료까지 남은 일」에 보일 이유 — 상태 알림을 빼고 이슈를 앞에 둔다(같은 갈래 안은
 * 서버 순서 그대로).
 */
export const remainingBlockers = <T extends { code: BlockerCode }>(blockers: readonly T[]): T[] => [
  ...blockers.filter((blocker) => blockerKind(blocker.code) === 'issue'),
  ...blockers.filter((blocker) => blockerKind(blocker.code) === 'inProgress'),
];

/** 화면을 연 기기의 오늘 날짜(`YYYY-MM-DD`, 브라우저 로컬). */
export const localToday = (now: Date = new Date()): string =>
  [
    String(now.getFullYear()).padStart(4, '0'),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

/** 목록 진행 칩 아래 표시. `null` 이면 칩을 달지 않는다. */
export type CompletionMark =
  { kind: 'blocked'; count: number } | { kind: 'delayed' } | { kind: 'ready' } | null;

/**
 * 진행 칩 아래 칩을 고른다(omf-all-around#342).
 *
 * 1. 진짜 이슈가 있으면 「막힘 n」(이슈 수만).
 * 2. 이슈가 없고 피킹 부족인데 출하요청일이 오늘보다 앞이면 「지연」.
 * 3. 막는 이유가 하나도 없으면 「완료 대기」.
 * 4. 정상 진행(피킹 부족 · 미검사)만 있으면 칩 없음 — 진행 칩과 「목표 / 피킹 / 출하」가 이미 말한다.
 *
 * 미편성 · 출하 완료 · 「이미 출하 완료」에는 달지 않는다.
 */
export const completionMarkOf = (
  row: Pick<ShipmentRequestView, 'blockers' | 'shipmentProgressCode' | 'requestedShipDate'>,
  today: string,
): CompletionMark => {
  const { blockers } = row;
  if (blockers === null || blockers.completed) return null;
  if (row.shipmentProgressCode === 'NOT_ALLOCATED' || row.shipmentProgressCode === 'SHIPPED') {
    return null;
  }
  if (blockers.issueCount > 0) return { kind: 'blocked', count: blockers.issueCount };
  if (blockers.pickingShort && row.requestedShipDate < today) return { kind: 'delayed' };
  if (blockers.inProgressCount === 0) return { kind: 'ready' };
  return null;
};

export type ShipmentProgressCode = ShipmentRequestResponse['shipmentProgressCode'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 한 행의 요청/배정/출하 합계 — **그 행 자신의 `lines`만 더한다**(다른 행·페이지를 넘나들지
 * 않는다).
 *
 * ⭐ **축마다 「받지 못했다」가 따로 있다.** 줄은 왔는데 어느 한 축만 비어 오는 일이 있어
 * (실측 2026-09-11 · client#1042), 그 축만 `null` 로 둔다. 셋을 한 덩어리로 묶으면 받은 축까지
 * 가려진다.
 */
export interface LineQtyTotals {
  requestedQty: number | null;
  allocatedQty: number | null;
  /** 피처 010 — 피킹 합(LOT 통째). 목표(배정)를 넘을 수 있다. */
  pickedQty: number | null;
  shippedQty: number | null;
}

/**
 * 한 축을 더한다. **받지 못한 값을 0 으로 지어내지 않는다** — 한 줄이라도 비면 그 축은 통째로
 * 「모른다」다.
 *
 * ⚠ 계약은 이 칸을 필수로 적지만 **서버가 비워 보낸 적이 있다**(client#1042). 타입만 믿고
 * 더하면 합계가 `NaN` 이 되어 화면에 그대로 나간다 — 값이 숫자인지 여기서 본다.
 */
const addQty = (total: number | null, value: number | undefined): number | null =>
  total === null || typeof value !== 'number' || !Number.isFinite(value) ? null : total + value;

/**
 * `lines`를 세 합계로 접는다. 계약에서 `lines`는 선택 필드다 — 비어 있거나 없으면 `null`을 낸다.
 * **0/0/0을 내지 않는다** — 그러면 「수량이 0」과 「받지 못했다」가 같은 모양이 된다.
 */
export const toLineQtyTotals = (
  lines: ShipmentRequestLineResponse[] | undefined,
): LineQtyTotals | null => {
  if (lines === undefined || lines.length === 0) return null;

  return lines.reduce<LineQtyTotals>(
    (totals, line) => ({
      requestedQty: addQty(totals.requestedQty, line.requestedQty),
      allocatedQty: addQty(totals.allocatedQty, line.allocatedQty),
      pickedQty: addQty(totals.pickedQty, line.pickedQty),
      shippedQty: addQty(totals.shippedQty, line.shippedQty),
    }),
    { requestedQty: 0, allocatedQty: 0, pickedQty: 0, shippedQty: 0 },
  );
};

/**
 * 화면이 다루는 출하작업지시 한 건.
 *
 * **`검사`는 서버가 롤업한 값을 그대로 옮긴다** — 화면이 `lines`를 순회해 스스로 판정하지
 * 않는다(계약 주석 W-04-02 §5-3 · omf-mes#232 · omf-mes#235). `REJECTED`·`HELD`는 이번
 * 슬라이스에서 전용 배지를 두지 않고 `PENDING`과 같게 표시한다 — 렌더 쪽(`shipment-table.tsx`)
 * 판단이며, 값 자체는 그대로 옮긴다.
 */
export interface ShipmentRequestView {
  shipmentRequestId: number;
  shipmentRequestNo: string;
  customerId: number;
  shipToPartnerId: number;
  requestedShipDate: string;
  fulfillmentPlantId: number | null | undefined;
  shipmentProgressCode: ShipmentProgressCode;
  inspectionStatus: ShipmentRequestResponse['shippingInspectionStatusCode'];
  lineTotals: LineQtyTotals | null;
  /** 피처 010 — 라인 초과 합(서버가 라인마다 계산한 `overQty`). */
  overQty: number;
  /** 피처 010 — 살아 있는 피킹 LOT 의 OQC 판정 수. 옛 서버가 안 주면 `null`. */
  lotJudgmentSummary: ShipmentRequestResponse['lotJudgmentSummary'] | null;
  /**
   * 출하 완료를 막는 이유를 갈래별로 센 값 — 모두 0 이면 「완료 대기」(FR-016 · #342). 옛 서버가
   * 안 주면 `null`.
   */
  blockers: BlockerTally | null;
  pickingWarehouseNames: string[];
  replacementCount: number;
  /** 피처 012 — 지시서 사업부. `null` 이면 사업부가 없는 공장의 옛 지시서(「사업부 미지정」 · 빈 곳 ⑨). */
  businessUnitName: string | null;
  /** 피처 012 — 줄 출고 창고 요약(창고 · 공장). 빈 배열이면 옛 지시서(「창고 미지정」 · US6-1). */
  lineWarehouses: { warehouseId: number; warehouseName: string; plantName: string }[];
  /** 피처 012 — 대표 ERP 송신 상태(취소 안 된 출하 중 최근 것). 완료 출하가 없으면 `null`(FR-018). */
  erpSendStatus: ShipmentRequestResponse['erpSendStatus'];
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toShipmentRequestView = (data: ShipmentRequestResponse): ShipmentRequestView => ({
  shipmentRequestId: data.shipmentRequestId,
  shipmentRequestNo: data.shipmentRequestNo,
  customerId: data.customerId,
  shipToPartnerId: data.shipToPartnerId,
  requestedShipDate: data.requestedShipDate,
  fulfillmentPlantId: data.fulfillmentPlantId,
  shipmentProgressCode: data.shipmentProgressCode,
  inspectionStatus: data.shippingInspectionStatusCode,
  lineTotals: toLineQtyTotals(data.lines),
  overQty: (data.lines ?? []).reduce(
    (sum, line) => sum + (typeof line.overQty === 'number' ? line.overQty : 0),
    0,
  ),
  lotJudgmentSummary: data.lotJudgmentSummary ?? null,
  blockers: data.completionBlockers === undefined ? null : tallyBlockers(data.completionBlockers),
  pickingWarehouseNames: (data.pickingWarehouses ?? []).map((warehouse) => warehouse.warehouseName),
  replacementCount: data.replacementCount ?? 0,
  businessUnitName: data.businessUnit?.businessUnitName ?? null,
  lineWarehouses: (data.warehouses ?? []).map((warehouse) => ({
    warehouseId: warehouse.warehouseId,
    warehouseName: warehouse.warehouseName,
    plantName: warehouse.plantName,
  })),
  erpSendStatus: data.erpSendStatus ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface ShipmentScheduleListResult {
  items: ShipmentRequestView[];
  page: PageMeta;
  /** 피처 012 — ERP 송신 상태별 지시서 수(칩 · FR-018). 0 건 상태는 키가 없다. */
  erpSendStatusCounts: Readonly<Record<string, number>>;
}

/** ERP 송신 칩 값(피처 012 FR-018 · 빈 곳 ②). 「확정 전」 = 옛 흐름 · 긴급 직행 미확정. */
export type ErpChipValue = NonNullable<ShipmentRequestResponse['erpSendStatus']>;

export const ERP_CHIP_VALUES: readonly ErpChipValue[] = [
  'NOT_QUEUED',
  'PENDING',
  'SENT',
  'SEND_ERROR',
  'NOT_SENT_NO_SALES_ORDER',
  'CANCELLED',
];

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
