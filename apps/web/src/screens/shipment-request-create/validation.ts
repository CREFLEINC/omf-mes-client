import { messages } from '@omf-mes/i18n';

import type { AssignmentMode, ShipmentRequestLineDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 머리 필수(고객·납품처·출하요청일) | `validateHeader` — 단독 생성만. 지시서 경유는 지시서가 이미 채운다 |
 * | 라인 형식(품목·단위 필수 · 요청 수량 형식 — 단독 생성만) | `validateLines` |
 * | **배정 수량 ≥ 0 · ≤ 요청 수량**(둘 다 모드) | `validateLines` — 서버가 거절할 것을 화면이 앞당긴다 |
 * | 가용 부족 | **막지 않는다** — `shortage-banner.tsx`가 경고만 낸다(C5) |
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.shipmentRequestCreate;

export const HEADER_FORM_FIELDS: readonly string[] = [
  'businessUnitId',
  'customerId',
  'shipToPartnerId',
  'requestedShipDate',
];

export type LineFieldName = 'itemId' | 'uomId' | 'requestedQty' | 'allocatedQty' | 'warehouseId';

/** 줄 단위 오류의 열쇠. 줄 키가 앞에 온다 — 잘못 친 줄이 둘일 때 서로 섞이지 않는다. */
export const lineFieldId = (key: string, field: LineFieldName): string => `${key}.${field}`;

export interface HeaderDraft {
  /** 지시서 사업부(피처 012 FR-001·002) — 「출하 담당 공장」 자리. */
  businessUnitId: string;
  customerId: string;
  shipToPartnerId: string;
  requestedShipDate: string;
}

/** 머리 필수 값. **단독 생성에서만 판정한다** — 지시서 경유는 지시서가 값을 채워 잠근다. */
export const validateHeader = (
  mode: AssignmentMode,
  draft: HeaderDraft,
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.businessUnitId === '') errors.businessUnitId = t.errors.businessUnitRequired;
  if (draft.requestedShipDate === '') errors.requestedShipDate = t.errors.requestedShipDateRequired;

  if (mode === 'standalone') {
    if (draft.customerId === '') errors.customerId = t.errors.customerRequired;
    if (draft.shipToPartnerId === '') errors.shipToPartnerId = t.errors.shipToPartnerRequired;
  }

  return errors;
};

/** 친 글자의 해석 결과. 형식 오류를 수의 값역 안에 담지 않는다(`NaN`을 그대로 흘리지 않는다). */
export type QtyRead = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'qty'; value: number };

/** 친 글자를 수량으로 읽는다. `Number('')`은 0, `Number('12x')`는 `NaN`이라 둘 다 걸러 낸다. */
export const readQty = (raw: string): QtyRead => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid' };

  return { kind: 'qty', value };
};

export interface LineValidation {
  /**
   * 칸 아래에 **그리는** 오류 — 사용자가 «친» 값이 잘못됐을 때만 든다.
   *
   * ⛔ **아직 안 채운 칸은 여기 들어오지 않는다**(사용자 지시 2026-09-18). 라인을 막 추가한
   *    사람에게 붉은 문구가 먼저 서면, 아무것도 안 했는데 잘못한 것처럼 읽힌다.
   */
  errors: Record<string, string>;
  /**
   * 아직 채워지지 않은 칸이 있는가 — **편성은 그대로 막는다.**
   *
   * ⭐ 막는 것과 «줄마다 붉게 적는 것»은 다른 일이다. 막는 사유는 편성 단추 옆에 한 번만 선다
   *    (`screen.tsx` 의 `submitBlockReason`) — 그 자리가 이미 「무엇을 해야 열리는가」를 말한다.
   */
  isIncomplete: boolean;
}

/**
 * 요청 수량 오류(단독 생성 줄만) — 지시서 경유 줄은 읽기 전용이라 판정할 것이 없다.
 *
 * ⛔ **비었을 때는 오류가 아니다** — 아직 안 친 것이지 잘못 친 것이 아니다. 비어 있으면
 *    `isIncomplete` 가 편성을 막고, 그 사유는 단추 옆에 한 번 선다.
 */
const requestedQtyError = (line: ShipmentRequestLineDraft): string | null => {
  if (line.salesOrderLineId !== null) return null;

  const read = readQty(line.requestedQty);

  if (read.kind === 'empty') return null;
  if (read.kind === 'invalid') return t.errors.qtyNotNumber;

  return read.value <= 0 ? t.errors.requestedQtyNotPositive : null;
};

/** 아직 안 채운 칸이 있는 줄인가. 단독 생성 줄만 본다 — 지시서 경유 줄은 지시서가 채운다. */
const isIncompleteLine = (line: ShipmentRequestLineDraft): boolean =>
  line.salesOrderLineId === null &&
  (line.itemId === '' || line.uomId === '' || readQty(line.requestedQty).kind === 'empty');

/**
 * 배정 수량 오류(둘 다 모드) — 비었으면 0으로 보아 오류가 아니다(그 줄은 제외된다).
 *
 * 나눈 줄은 요청 수량이 없다(보내기 직전 정한다) — 「요청 수량을 넘는가」는 묶음 합(`splitGroupsOf`)이 본다.
 */
const allocatedQtyError = (line: ShipmentRequestLineDraft): string | null => {
  const read = readQty(line.allocatedQty);

  if (read.kind === 'empty') return null;
  if (read.kind === 'invalid') return t.errors.qtyNotNumber;
  if (read.value < 0) return t.errors.allocatedQtyNegative;
  if (line.splitOf !== null) return null;

  const requested = readQty(line.requestedQty);

  if (requested.kind === 'qty' && read.value > requested.value) {
    return t.errors.allocatedQtyOverRequested(requested.value);
  }

  return null;
};

/** 이번 편성에 실리는 줄인가 — 배정 수량이 1 이상(`shipment-request-create-body.ts` 와 같은 기준). */
export const isSendingLine = (line: ShipmentRequestLineDraft): boolean => {
  const read = readQty(line.allocatedQty);

  return read.kind === 'qty' && read.value >= 1;
};

/**
 * 나눈 줄 묶음 하나(피처 012 FR-005) — 같은 S/O 줄을 가리키는 원 줄 + 나눈 줄들.
 *
 * `remaining` 은 원 줄의 요청 수량(= S/O 잔여, 승계 값)이다. `total` 은 묶음 배정 합.
 */
export interface SplitGroup {
  originKey: string;
  salesOrderLineNo: number | null;
  remaining: number;
  total: number;
  lines: ShipmentRequestLineDraft[];
  isOver: boolean;
}

/** 소수 수량의 합 오차를 피한다 — 계약 수량은 소수 6자리. 서버(`assertSalesOrderRemaining`)와 같은 셈. */
const exceeds = (total: number, remaining: number): boolean =>
  Math.round(total * 1e6) > Math.round(remaining * 1e6);

const qtyOf = (raw: string): number => {
  const read = readQty(raw);

  return read.kind === 'qty' ? read.value : 0;
};

/** 나눈 줄이 하나라도 있는 원 줄마다 묶음을 낸다 — 나누지 않은 줄은 줄 단위 검사(배정 ≤ 요청)로 충분하다. */
export const splitGroupsOf = (lines: readonly ShipmentRequestLineDraft[]): SplitGroup[] =>
  lines
    .filter((origin) => origin.splitOf === null && lines.some((line) => line.splitOf === origin.key))
    .map((origin) => {
      const group = lines.filter((line) => line.key === origin.key || line.splitOf === origin.key);
      const remaining = qtyOf(origin.requestedQty);
      const total = group.reduce((sum, line) => sum + qtyOf(line.allocatedQty), 0);

      return {
        originKey: origin.key,
        salesOrderLineNo: origin.salesOrderLineNo,
        remaining,
        total,
        lines: group,
        isOver: exceeds(total, remaining),
      };
    });

/**
 * 창고를 고르지 않은 채 나갈 줄(피처 012 FR-003 · US1-6). 배정 0 인 줄은 이번에 나가지 않으므로 묻지 않는다.
 */
export const linesMissingWarehouse = (
  lines: readonly ShipmentRequestLineDraft[],
): ShipmentRequestLineDraft[] =>
  lines.filter((line) => line.warehouseId === '' && isSendingLine(line));

export const validateLines = (lines: readonly ShipmentRequestLineDraft[]): LineValidation => {
  const errors: Record<string, string> = {};
  /*
   * 창고 빈 칸은 «사람이 창고를 고르기 시작한 뒤»에만 붉게 적는다 — S/O 를 막 고른 직후 모든 줄이 붉으면
   * 아무것도 안 했는데 잘못한 것처럼 읽힌다(2026-09-18 지시와 같은 규율). 막는 사유는 단추 옆에 늘 선다.
   * 사업부를 바꿔 비운 줄은 붉게 적지 않는다 — 노란 테와 띠가 이미 말한다.
   */
  const startedPicking = lines.some((line) => line.warehouseId !== '');

  for (const line of linesMissingWarehouse(lines)) {
    if (startedPicking && !line.warehouseCleared) {
      errors[lineFieldId(line.key, 'warehouseId')] = t.errors.warehouseRequired;
    }
  }

  for (const line of lines) {
    if (line.salesOrderLineId === null) {
      const requestedError = requestedQtyError(line);

      if (requestedError !== null) errors[lineFieldId(line.key, 'requestedQty')] = requestedError;
    }

    const allocatedError = allocatedQtyError(line);

    if (allocatedError !== null) errors[lineFieldId(line.key, 'allocatedQty')] = allocatedError;
  }

  return { errors, isIncomplete: lines.some(isIncompleteLine) };
};

/** 보낼 줄이 하나라도 남는가 — 배정 수량이 1 이상인 줄이 있어야 한다(계약 설명 · C4 인접 규칙). */
export const hasAllocatableLine = (lines: readonly ShipmentRequestLineDraft[]): boolean =>
  lines.some((line) => {
    const read = readQty(line.allocatedQty);

    return read.kind === 'qty' && read.value >= 1;
  });
