import type {
  ApiError,
  components,
  MaterialIssueRequestDetailForward,
  MaterialIssueRequestForward,
  ReplenishmentGoodsIssue,
  ReplenishmentQtySummary,
  ReplenishmentStatusCode,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toPlantDateTimeParts } from '../../patterns/plant-time';

const t = messages.productionWarehouseReplenishment;

type Line = components['schemas']['MaterialIssueRequestLine'];

/**
 * 화면 표시 상태(screens/W-02-12.md 「상태 표시」) — 서버 `replenishmentStatus` 를 화면 이름으로 옮긴 것.
 * `WAITING` 은 배포 실패(대기 + 실패 글)에만 쓴다.
 */
export type ReplenishmentStatus =
  | 'WAITING'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CLOSED'
  | 'CANCELLED';

/** 진행 보기 상태 조건 5종(시안 순서). */
export const FILTER_STATUSES: readonly ReplenishmentStatus[] = [
  'RELEASED',
  'IN_PROGRESS',
  'DONE',
  'CLOSED',
  'CANCELLED',
];

export const STATUS_TONE: Record<
  ReplenishmentStatus,
  'info' | 'success' | 'warning' | 'idle' | 'error'
> = {
  WAITING: 'info',
  RELEASED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CLOSED: 'success',
  CANCELLED: 'idle',
};

export const REMAINDER_CLOSED = 'REMAINDER_CLOSED';

/** 화면 상태 ↔ 서버 `replenishmentStatus`(계약 §1). */
export const SERVER_STATUS: Record<Exclude<ReplenishmentStatus, 'WAITING'>, ReplenishmentStatusCode> = {
  RELEASED: 'DISPATCHED',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'COMPLETED',
  CLOSED: 'REMAINDER_CLOSED',
  CANCELLED: 'CANCELLED',
};

const FROM_SERVER: Record<ReplenishmentStatusCode, ReplenishmentStatus> = {
  DISPATCHED: 'RELEASED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'DONE',
  REMAINDER_CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
};

/** 창고 보충 요청 한 건(화면 모양). W/O 칸은 읽지 않는다. */
export interface ReplenishmentRequestView {
  id: number;
  no: string;
  origin: string | null;
  productionWarehouseName: string;
  sourceWarehouseName: string;
  destinationName: string;
  lineCount: number;
  shortage: number;
  status: ReplenishmentStatus;
  releaseFailed: boolean;
  releaseErrorText: string | null;
  /** 넓혀 읽은 닫힘 사유 — `REMAINDER_CLOSED` 포함. */
  closeReasonCode: string | null;
  closeReasonDetailCode: string | null;
  closeRemark: string | null;
  closedAt: string | null;
  remarks: string | null;
  requestedAt: string | null;
  receipt: { issuedCount: number; receivedCount: number } | null;
  /** 한 품목 요청의 요청 · 출고 · 마감 수량. 두 품목 이상이면 null. */
  qty: ReplenishmentQtySummary | null;
  goodsIssues: ReplenishmentGoodsIssue[];
  versionNo: number;
}

export interface ReplenishmentLineView {
  id: number;
  itemCode: string;
  itemName: string;
  uomCode: string;
  requested: number;
  picked: number;
  issued: number;
  shortage: number;
}

export interface ReplenishmentDetailView {
  request: ReplenishmentRequestView;
  lines: ReplenishmentLineView[];
}

/** 대기(배포 실패)만 `displayStatus` 로 보고, 나머지는 서버 `replenishmentStatus` 를 그대로 옮긴다. */
const statusOf = (raw: MaterialIssueRequestForward): ReplenishmentStatus => {
  if (raw.displayStatus === 'WAITING') return 'WAITING';
  if (raw.replenishmentStatus !== null && raw.replenishmentStatus !== undefined) {
    return FROM_SERVER[raw.replenishmentStatus];
  }
  return raw.displayStatus ?? 'WAITING';
};

export const toRequestView = (raw: MaterialIssueRequestForward): ReplenishmentRequestView => {
  /* 계약은 `REMAINDER_CLOSED` 를 더한다 — 생성 타입이 아직 모르는 값이라 문자열로 넓혀 읽는다. */
  const closeReason = (raw.closeReasonCode as string | null | undefined) ?? null;
  const status = statusOf(raw);
  const releaseErrorText = raw.releaseErrorText ?? null;
  return {
    id: raw.materialIssueRequestId,
    no: raw.issueRequestNo,
    origin: raw.replenishmentOriginCode ?? null,
    productionWarehouseName:
      raw.destinationWarehouseName ?? String(raw.destinationWarehouseId ?? ''),
    sourceWarehouseName: raw.sourceWarehouseName ?? String(raw.sourceWarehouseId ?? ''),
    destinationName: raw.destinationLocationName ?? String(raw.destinationLocationId),
    lineCount: raw.lineCount ?? 0,
    shortage: (raw.shortageQtyTotal ?? 0) + (raw.dynamicShortageQtyTotal ?? 0),
    status,
    releaseFailed: status === 'WAITING' && releaseErrorText !== null && releaseErrorText !== '',
    releaseErrorText,
    closeReasonCode: closeReason,
    closeReasonDetailCode: raw.closeReasonDetailCode ?? null,
    closeRemark: raw.closeRemark ?? null,
    closedAt: raw.closedAt ?? null,
    remarks: raw.remarks ?? null,
    requestedAt: raw.releasedAt ?? null,
    receipt: raw.receiptSummary ?? null,
    qty: raw.qtySummary ?? null,
    goodsIssues: raw.goodsIssues ?? [],
    versionNo: raw.versionNo ?? 0,
  };
};

const toLineView = (raw: Line): ReplenishmentLineView => ({
  id: raw.materialIssueRequestLineId,
  itemCode: raw.itemCode ?? String(raw.itemId),
  itemName: raw.itemName ?? '',
  uomCode: raw.uomCode ?? '',
  requested: raw.requestedQty,
  picked: raw.pickedQty ?? 0,
  issued: raw.issuedQty,
  shortage: (raw.shortageQty ?? 0) + (raw.dynamicShortageQty ?? 0),
});

export const toDetailView = (raw: MaterialIssueRequestDetailForward): ReplenishmentDetailView => ({
  request: toRequestView(raw.materialIssueRequest),
  lines: raw.lines.map(toLineView),
});

/** 줄의 마감 양 — 잔량 마감한 요청은 미출고분이 닫혔다(요청 − 출고). */
export const lineClosedQty = (request: ReplenishmentRequestView, line: ReplenishmentLineView) =>
  request.status === 'CLOSED' ? Math.max(0, line.requested - line.issued) : 0;

/** 집었지만 출고하지 않은 양 — 있으면 잔량 마감을 잠근다(R-5, plan 확인할 것 5). */
export const pickedNotIssued = (lines: readonly ReplenishmentLineView[]): number =>
  lines.reduce((sum, line) => sum + Math.max(0, line.picked - line.issued), 0);

/** 진행이 있는가 — 출고나 피킹이 하나라도 있으면 취소 대신 잔량 마감이다. */
export const hasProgress = (
  request: ReplenishmentRequestView,
  lines: readonly ReplenishmentLineView[],
): boolean =>
  request.status === 'IN_PROGRESS' || lines.some((line) => line.issued > 0 || line.picked > 0);

/** 상세 버튼 — 진행 없음은 취소, 진행 있음은 잔량 마감, 닫힌 요청은 보기만. */
export type DetailAction = 'cancel' | 'close' | 'none';

export const detailAction = (
  request: ReplenishmentRequestView,
  lines: readonly ReplenishmentLineView[],
): DetailAction => {
  if (!['WAITING', 'RELEASED', 'IN_PROGRESS'].includes(request.status)) return 'none';
  return hasProgress(request, lines) ? 'close' : 'cancel';
};

export const statusLabel = (request: Pick<ReplenishmentRequestView, 'status'>): string =>
  t.status[request.status];

export const formatQty = (value: number): string => value.toLocaleString('ko-KR');

export const qtyWithUom = (value: number, uom: string): string =>
  uom === '' ? formatQty(value) : `${formatQty(value)} ${uom}`;

/** `YYYY-MM-DD` → `MM-DD(요일)`. 요일 글자는 W-CO-15 와 같은 문구를 쓴다. */
export const formatDay = (iso: string | null | undefined): string => {
  if (iso === null || iso === undefined || iso === '') return t.common.none;
  const day = new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay();
  return `${iso.slice(5, 10)}(${messages.plantWorkingDays.weekdays[day] ?? ''})`;
};

/** `MM-DD HH:mm`(공장 시각) — 응답 시각은 UTC 로 올 수 있다. */
export const plantMinute = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return t.common.none;
  const parts = toPlantDateTimeParts(value);
  return parts === null ? value : `${parts.date.slice(5)} ${parts.time}`;
};

/** 오류 응답에 이 업무 코드가 있는가. */
export const hasErrorCode = (error: ApiError | null, code: string): boolean => {
  if (error === null) return false;
  switch (error.kind) {
    case 'validation':
    case 'stateLocked':
      return error.errors.some((item) => item.code === code);
    case 'conflict':
    case 'http':
      return error.code === code;
    default:
      return false;
  }
};

/** 수량 칸 글을 수로 — 비었거나 수가 아니면 null. */
export const parseQty = (text: string): number | null => {
  const trimmed = text.replaceAll(',', '').trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
};
