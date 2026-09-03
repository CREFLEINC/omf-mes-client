import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { blocksSubmit, type LotReleaseState } from './lot-release';
import { quantityError, toQuantity, type QuantityLimits } from './quantity';
import {
  lineForItem,
  remainingQtyOf,
  type ProductionLotCandidate,
  type ShipmentRequestTarget,
  type ShipmentRequestTargetLine,
} from './types';

/**
 * 확정 게이트와 본문 조립을 **한 파일에 둔다.**
 *
 * ⭐ 둘이 갈라지면 「버튼은 열렸는데 본문이 안 만들어진다」(눌러도 아무 일도 안 일어난다) 또는
 * 「막았는데 본문은 만들어진다」가 생긴다. 되돌릴 수 없는 쓰기라 두 판정이 **같은 입력에서 같은
 * 순서로** 나와야 하고, 그러려면 한 자리에 있어야 한다.
 */

export type ShipmentCreateBody = components['schemas']['ShipmentCreate'];
type ShipmentLineCreate = components['schemas']['ShipmentLineCreate'];

/** ③ 상차 정보 — 전부 선택 입력이다(§5-7). */
export interface LoadingInfoDraft {
  vehicleNo: string;
  driverName: string;
  sealNo: string;
}

export const EMPTY_LOADING_INFO: LoadingInfoDraft = {
  vehicleNo: '',
  driverName: '',
  sealNo: '',
};

export interface ExpeditedShipmentDraft {
  qty: string;
  reason: string;
  loading: LoadingInfoDraft;
}

export const EMPTY_DRAFT: ExpeditedShipmentDraft = {
  qty: '',
  reason: '',
  loading: EMPTY_LOADING_INFO,
};

/**
 * 긴급 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다 — 자유 텍스트의 관례 값이다.
 *
 * ⚠ **입력칸의 글자 수 표시가 이 값을 그대로 쓴다.** 두 벌로 두면 한쪽만 고쳤을 때 「999자까지
 * 라고 적어 놓고 500자에서 막는」 화면이 된다.
 */
export const REASON_MAX = 500;

export interface SubmissionInput {
  lot: ProductionLotCandidate | null;
  release: LotReleaseState | null;
  target: ShipmentRequestTarget | null;
  /** 활성 창고가 정해졌을 때만 값이 있다. 계약이 필수로 두는데 스펙에 출처가 없다. */
  warehouseId: number | null;
  draft: ExpeditedShipmentDraft;
  isSaving: boolean;
  /** 전표를 제출하는 시각. 시험에서는 고정 시각을 주고 화면에서는 현재 시각을 쓴다. */
  now?: Date;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const toBusinessDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

const toOccurredAt = (at: Date): string => {
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;

  return `${toBusinessDate(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(
    at.getSeconds(),
  )}${offset}`;
};

/** 고른 LOT의 품목과 맞는 라인. 지시를 골랐어도 맞는 라인이 없으면 낼 수 없다. */
export const targetLineOf = (input: SubmissionInput): ShipmentRequestTargetLine | null =>
  input.target === null || input.lot === null ? null : lineForItem(input.target, input.lot.itemId);

/** 두 상한. LOT과 라인이 모두 정해져야 나온다 — 하나라도 없으면 상한으로 막지 않는다. */
export const quantityLimitsOf = (input: SubmissionInput): QuantityLimits | null => {
  const line = targetLineOf(input);
  if (input.lot === null || line === null) return null;

  return { lotQty: input.lot.initialQty, remainingQty: remainingQtyOf(line) };
};

export const reasonError = (raw: string): string | undefined => {
  const t = messages.expeditedShipment.reason;
  const value = raw.trim();

  if (value === '') return t.required;
  if (value.length > REASON_MAX) return t.tooLong;

  return undefined;
};

/**
 * 확정을 막는 사유. 없으면 `undefined`.
 *
 * ⭐ **하나만 낸다**(공유계약 G-3) — 여러 개를 늘어놓으면 무엇부터 고쳐야 하는지가 흐려진다.
 * 순서는 **사용자가 채우는 순서**다(LOT → 대상 → 수량 → 사유). 진행 중이 맨 앞인 이유는 그것이
 * 「고쳐서 풀 수 있는」 것이 아니라 「기다려야 하는」 것이라서다.
 */
export const submitLockReason = (input: SubmissionInput): string | undefined => {
  const t = messages.expeditedShipment.lock;

  if (input.isSaving) return t.saving;
  if (input.lot === null) return t.selectLot;
  if (blocksSubmit(input.release)) return t.notReleasable;
  if (input.target === null || targetLineOf(input) === null) return t.selectTarget;
  if (quantityError(input.draft.qty, quantityLimitsOf(input)) !== undefined) return t.qty;
  if (reasonError(input.draft.reason) !== undefined) return t.reason;
  if (input.warehouseId === null) return t.warehouse;

  return undefined;
};

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * 보낼 본문. **막을 사유가 하나라도 있으면 `null`을 낸다** — 부분적으로 유효한 요청을 만들지
 * 않는다.
 *
 * ⭐ **`expedited`가 참인 것이 이 화면의 전부다.** 서버가 그 값을 보고 제품 입고 전표와 입고
 * 전기를 같은 트랜잭션에서 함께 만든다 — 화면이 01 계약을 따로 부르지 않는다(계약 주석 ·
 * §5-1). ⛔ 참이면 사유가 필수이고, 없으면 서버가 400으로 막는다.
 */
export const toShipmentCreateBody = (input: SubmissionInput): ShipmentCreateBody | null => {
  if (submitLockReason(input) !== undefined) return null;

  const line = targetLineOf(input);
  const qty = toQuantity(input.draft.qty, quantityLimitsOf(input));

  /*
   * 게이트가 이미 보장한 것들이지만 타입을 좁히려면 다시 물어야 한다. 단언(`!`)으로 넘기면
   * 게이트가 나중에 느슨해졌을 때 조용히 통과한다.
   */
  if (input.lot === null || input.target === null || line === null) return null;
  if (qty === undefined || input.warehouseId === null) return null;

  const now = input.now ?? new Date();

  const lineCreate: ShipmentLineCreate = {
    shipmentRequestLineId: line.shipmentRequestLineId,
    shippedQty: qty,
    uomId: line.uomId,
    allocations: [{ lotId: input.lot.lotId, allocatedQty: qty, uomId: line.uomId }],
  };

  return {
    shipmentRequestId: input.target.shipmentRequestId,
    warehouseId: input.warehouseId,
    ...(trimmedOrUndefined(input.draft.loading.vehicleNo) === undefined
      ? {}
      : { vehicleNo: input.draft.loading.vehicleNo.trim() }),
    ...(trimmedOrUndefined(input.draft.loading.driverName) === undefined
      ? {}
      : { driverName: input.draft.loading.driverName.trim() }),
    ...(trimmedOrUndefined(input.draft.loading.sealNo) === undefined
      ? {}
      : { sealNo: input.draft.loading.sealNo.trim() }),
    expedited: true,
    expediteReason: input.draft.reason.trim(),
    businessDate: toBusinessDate(now),
    occurredAt: toOccurredAt(now),
    lines: [lineCreate],
  };
};
