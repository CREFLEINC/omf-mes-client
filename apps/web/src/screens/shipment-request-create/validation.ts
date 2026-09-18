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
  'fulfillmentPlantId',
  'customerId',
  'shipToPartnerId',
  'requestedShipDate',
];

export type LineFieldName = 'itemId' | 'uomId' | 'requestedQty' | 'allocatedQty';

/** 줄 단위 오류의 열쇠. 줄 키가 앞에 온다 — 잘못 친 줄이 둘일 때 서로 섞이지 않는다. */
export const lineFieldId = (key: string, field: LineFieldName): string => `${key}.${field}`;

export interface HeaderDraft {
  fulfillmentPlantId: string;
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

  if (draft.fulfillmentPlantId === '') errors.fulfillmentPlantId = t.errors.fulfillmentPlantRequired;
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

/** 배정 수량 오류(둘 다 모드) — 비었으면 0으로 보아 오류가 아니다(그 줄은 제외된다). */
const allocatedQtyError = (line: ShipmentRequestLineDraft): string | null => {
  const read = readQty(line.allocatedQty);

  if (read.kind === 'empty') return null;
  if (read.kind === 'invalid') return t.errors.qtyNotNumber;
  if (read.value < 0) return t.errors.allocatedQtyNegative;

  const requested = readQty(line.requestedQty);

  if (requested.kind === 'qty' && read.value > requested.value) {
    return t.errors.allocatedQtyOverRequested(requested.value);
  }

  return null;
};

export const validateLines = (lines: readonly ShipmentRequestLineDraft[]): LineValidation => {
  const errors: Record<string, string> = {};

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
