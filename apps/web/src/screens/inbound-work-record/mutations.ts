import {
  createIdempotencyKey,
  type ApiError,
  type InboundLotFinalizeBlockerCode,
} from '@omf-mes/api-client';

import type { useApiClient } from '../../patterns/api-context';
import {
  ApiRequestError,
  runRequest,
  toApiError,
  type ApiCallResult,
} from '../../patterns/request';
import type {
  ErrorDetails,
  FinalizeBlocker,
  WorkRecordDetail,
  WorkRecordLot,
} from './forward-contract';

type Client = ReturnType<typeof useApiClient>['client'];

const BLOCKER_CODES: readonly InboundLotFinalizeBlockerCode[] = [
  'IQC_IN_PROGRESS',
  'DISPOSITION_IN_PROGRESS',
  'NOT_RECEIVED',
  'RECEIPT_CANCEL_PENDING',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * 오류 봉투의 `details`(계약 §5 — 400 `RANGE` 의 `purchaseOrderLineId`·`maxQty`, `UNALLOCATED_REMAINS` 의
 * `unallocatedQty`). 봉투 맨 위와 오류 줄 어디에 실려도 읽는다(C6 정함 — 계약이 자리를 적지 않았다).
 */
const readDetails = (body: unknown): ErrorDetails | null => {
  if (!isRecord(body)) return null;
  const sources: unknown[] = [body.details];
  if (Array.isArray(body.errors))
    for (const item of body.errors) if (isRecord(item)) sources.push(item.details);
  for (const source of sources) {
    if (!isRecord(source)) continue;
    const details: ErrorDetails = {};
    const lineId = numberOrUndefined(source.purchaseOrderLineId);
    const maxQty = numberOrUndefined(source.maxQty);
    const unallocatedQty = numberOrUndefined(source.unallocatedQty);
    const receivedQty = numberOrUndefined(source.receivedQty);
    const allocatedQty = numberOrUndefined(source.allocatedQty);
    if (receivedQty !== undefined) details.receivedQty = receivedQty;
    if (allocatedQty !== undefined) details.allocatedQty = allocatedQty;
    if (lineId !== undefined) details.purchaseOrderLineId = lineId;
    if (maxQty !== undefined) details.maxQty = maxQty;
    if (unallocatedQty !== undefined) details.unallocatedQty = unallocatedQty;
    if (Object.keys(details).length > 0) return details;
  }
  return null;
};

const isBlockerCode = (value: unknown): value is InboundLotFinalizeBlockerCode =>
  BLOCKER_CODES.some((code) => code === value);

/**
 * 409 막힘(계약 §5 `blockers[]`). G1 의 마감 취소처럼 `errors[].code` 로 올 수도 있어 둘 다 읽는다(C6 정함).
 * LOT 번호가 없으면 빈 배열 — 화면은 다시 읽은 상세의 `finalizeBlockers` 로 문구를 채운다.
 */
const readBlockers = (body: unknown): FinalizeBlocker[] => {
  if (!isRecord(body)) return [];
  const rows = [
    ...(Array.isArray(body.blockers) ? body.blockers : []),
    ...(Array.isArray(body.errors) ? body.errors : []),
  ];
  const blockers: FinalizeBlocker[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isBlockerCode(row.code)) continue;
    if (blockers.some((blocker) => blocker.code === row.code)) continue;
    const lotNos = Array.isArray(row.lotNos)
      ? row.lotNos.filter((lotNo): lotNo is string => typeof lotNo === 'string')
      : [];
    blockers.push({ code: row.code, lotNos });
  }
  return blockers;
};

/** 오류 봉투의 `details` · 막힘을 잃지 않는 요청 실패 — 정규화(`ApiError`)는 그 둘을 버린다. */
export class WorkRecordRequestError extends ApiRequestError {
  readonly details: ErrorDetails | null;
  readonly blockers: FinalizeBlocker[];

  constructor(source: ApiRequestError, body: unknown) {
    super(source.apiError, { cause: source, httpStatus: source.httpStatus });
    this.name = 'WorkRecordRequestError';
    this.details = readDetails(body);
    this.blockers = readBlockers(body);
  }
}

const runKeepingBody = async <TData>(call: () => Promise<ApiCallResult<TData>>): Promise<TData> => {
  let body: unknown;
  try {
    return await runRequest(async () => {
      const result = await call();
      body = result.error;
      return result;
    });
  } catch (cause) {
    if (cause instanceof ApiRequestError && body !== undefined)
      throw new WorkRecordRequestError(cause, body);
    throw cause;
  }
};

/** 매칭 저장(계약 §5 `PUT …/po-allocations`) — 배정 전체 교체, 0 인 라인은 싣지 않는다. → 상세. */
export const saveAllocations = (
  client: Client,
  inboundLotId: number,
  versionNo: number,
  allocations: { purchaseOrderLineId: number; qty: number }[],
): Promise<WorkRecordDetail> =>
  runKeepingBody(() =>
    client.PUT('/logistics/inbound-lots/{inboundLotId}/po-allocations', {
      params: { path: { inboundLotId } },
      body: { versionNo, allocations: allocations.filter((allocation) => allocation.qty > 0) },
    }),
  );

/** 최종 마감(계약 §5 `POST …:finalize`). ERP 구매입고 적재는 #265 — 여기서 보내는 것은 없다. */
export const finalizeInboundLot = (
  client: Client,
  inboundLotId: number,
  versionNo: number,
  acknowledgeUnallocated: boolean,
): Promise<WorkRecordLot> =>
  runKeepingBody(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:finalize', {
      params: {
        path: { inboundLotId },
        header: { 'Idempotency-Key': createIdempotencyKey() },
      },
      body: acknowledgeUnallocated ? { versionNo, acknowledgeUnallocated: true } : { versionNo },
    }),
  );

/** 쓰기 실패의 갈래(screens/W-01-16.md 「상태·예외」). */
export type WriteFailure =
  | { kind: 'conflict' }
  | { kind: 'stateLocked' }
  | { kind: 'finalized' }
  | { kind: 'range'; details: ErrorDetails | null }
  | { kind: 'unallocated'; details: ErrorDetails | null }
  | { kind: 'blocked'; blockers: FinalizeBlocker[] }
  | { kind: 'other'; error: ApiError };

const codesOf = (error: ApiError): string[] =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.map((item) => item.code)
    : error.kind === 'conflict' || error.kind === 'http'
      ? error.code === undefined
        ? []
        : [error.code]
      : [];

export const classifyFailure = (cause: unknown): WriteFailure => {
  const error = toApiError(cause);
  const codes = codesOf(error);
  const details = cause instanceof WorkRecordRequestError ? cause.details : null;
  const blockers = cause instanceof WorkRecordRequestError ? cause.blockers : [];

  if (codes.includes('VERSION_CONFLICT') || (error.kind === 'conflict' && codes.length === 0))
    return { kind: 'conflict' };
  if (codes.includes('INBOUND_LOT_FINALIZED')) return { kind: 'finalized' };
  if (codes.includes('UNALLOCATED_REMAINS')) return { kind: 'unallocated', details };
  if (codes.includes('RANGE')) return { kind: 'range', details };
  if (blockers.length > 0) return { kind: 'blocked', blockers };
  if (codes.includes('STATE_LOCKED')) return { kind: 'stateLocked' };
  if (error.kind === 'conflict') return { kind: 'conflict' };
  return { kind: 'other', error };
};
