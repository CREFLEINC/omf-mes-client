import type { ShipmentRow } from './shipment-types';

/**
 * W-04-12 출하 내역의 판정 규칙(시안 W0412-After 「판정 규칙」).
 *
 * ⛔ ERP 송신 상태는 서버가 판정한다(`erpSendStatus`) — 화면은 그 값으로 무엇을 할 수 있는지만 가른다.
 */

export type ShipmentFlow =
  /** POP 출하 완료(P-04-07)로 생긴 출하 — 확정 단계가 없다. */
  | 'completed'
  /** 배포 전 관리웹 출하 처리(W-04-04)로 만든 미확정 출하. */
  | 'legacyUnconfirmed'
  | 'expeditedUnconfirmed'
  /** 옛 흐름에서 확정된 출하 — 「확정」 그대로 보인다. */
  | 'confirmed'
  | 'cancelled';

const isPopCompleted = (row: ShipmentRow): boolean => row.completedTerminalCode !== null;

export const flowOf = (row: ShipmentRow): ShipmentFlow => {
  if (row.statusCode === 'CANCELLED') return 'cancelled';
  if (row.statusCode === 'UNCONFIRMED') {
    return row.expedited ? 'expeditedUnconfirmed' : 'legacyUnconfirmed';
  }
  return isPopCompleted(row) ? 'completed' : 'confirmed';
};

/** [확정]은 옛 흐름·긴급 직행 미확정 출하 상세에만 선다(한 건씩 · 일괄 없음). */
export const canConfirm = (row: ShipmentRow): boolean => row.statusCode === 'UNCONFIRMED';

export type CancelLock =
  'sent' | 'cancelPending' | 'cancelApproved' | 'confirmedLegacy' | 'cancelled';

/**
 * 취소 요청을 막는 이유. 막지 않으면 `null`.
 *
 * - 미확정(옛 흐름·긴급 직행): 지금처럼 확정 전에는 요청할 수 있다.
 * - POP 완료 출하: ERP 로 보내기 «전»(대기 · 송신 안 함 · 송신 오류)이면 요청할 수 있다(FR-023 · 2026-11-19 사용자 결정).
 *   보냈으면 「ERP 에서 처리」. 송신 오류라도 ERP 에 들어간 행이 있으면 서버가 409 `ERP_ALREADY_SENT` 로 막고 화면은 그 이유를 보인다.
 * - 열린 취소 결재가 있으면 다시 올리지 않는다(FR-024).
 */
export const cancelLockOf = (row: ShipmentRow, cancelApproved = false): CancelLock | null => {
  const flow = flowOf(row);
  if (flow === 'cancelled') return 'cancelled';
  if (row.cancelRequestPending) return 'cancelPending';
  /* 승인된 취소가 남아 있다 — 다시 요청하지 않고 [취소 실행]한다(Q13). */
  if (cancelApproved) return 'cancelApproved';
  if (flow === 'legacyUnconfirmed' || flow === 'expeditedUnconfirmed') return null;
  if (flow === 'confirmed') return 'confirmedLegacy';

  switch (row.erpSendStatus) {
    case 'PENDING':
    case 'NOT_SENT_NO_SALES_ORDER':
    case 'SEND_ERROR':
      return null;
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'sent';
  }
};

/**
 * 창고 칸 — 하나면 그 이름, 여럿이면 「창고 n곳」(올리면 이름), 없으면 비운다.
 */
export const warehouseDisplay = (
  row: ShipmentRow,
):
  | { kind: 'none' }
  | { kind: 'one'; name: string }
  | { kind: 'many'; count: number; names: string } => {
  const names = row.warehouses.map((warehouse) => warehouse.warehouseName);
  const [only] = names;
  if (only === undefined) return { kind: 'none' };
  if (names.length === 1) return { kind: 'one', name: only };
  return { kind: 'many', count: names.length, names: names.join(', ') };
};
