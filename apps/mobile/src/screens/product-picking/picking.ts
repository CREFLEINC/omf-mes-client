import type { ApiError, components } from '@omf-mes/api-client';

export type ShipmentRequest = components['schemas']['ShipmentRequest'];
export type ShipmentRequestLine = components['schemas']['ShipmentRequestLine'];
export type ShipmentRequestLot = components['schemas']['ShipmentRequestLot'];
export type ShipmentLotPickResult = components['schemas']['ShipmentLotPickResult'];
export type ShipmentLotReplaceResult = components['schemas']['ShipmentLotReplaceResult'];
export type ShipmentCompletionBlocker = components['schemas']['ShipmentCompletionBlocker'];
export type OqcLotStatus = NonNullable<ShipmentRequestLot['oqcLotStatus']>;

/** 출하 관리 코드 상한(FR-020). 서버도 같은 값으로 400 을 낸다. */
export const MANAGEMENT_CODE_MAX = 100;

const remainingOf = (line: ShipmentRequestLine): number => line.allocatedQty - line.pickedQty;

/**
 * 스캔한 LOT 의 품목으로 라인을 고른다.
 *
 * 같은 품목 라인이 둘 이상이면 아직 목표에 못 미친 앞 라인이다. 모두 채웠으면 앞 라인으로
 * 보낸다 — 서버가 「목표 수량을 채웠습니다」로 거절하고, 그 말이 현장에 맞는 말이다.
 * 그 품목 라인이 없으면 null — 보내지 않고 「이 품목 라인이 없습니다」를 보인다.
 */
export const chooseLine = (
  lines: readonly ShipmentRequestLine[],
  itemId: number,
): ShipmentRequestLine | null => {
  const same = lines.filter((line) => line.itemId === itemId);

  return same.find((line) => remainingOf(line) > 0) ?? same[0] ?? null;
};

export interface LineTiles {
  target: number;
  picked: number;
  /** 목표에 못 미치면 남음, 목표 이상이면 초과(서버 `overQty`). */
  kind: 'remaining' | 'over';
  value: number;
}

/** 목표 · 피킹 · 남음(또는 초과). 초과는 서버가 센 값을 그대로 쓴다. */
export const lineTiles = (line: ShipmentRequestLine): LineTiles => {
  const left = remainingOf(line);

  return left > 0
    ? { target: line.allocatedQty, picked: line.pickedQty, kind: 'remaining', value: left }
    : { target: line.allocatedQty, picked: line.pickedQty, kind: 'over', value: line.overQty };
};

/** 살아 있는 피킹 LOT(교체 아님). 새로 집은 LOT 이 맨 위다. */
export const activeLots = (line: ShipmentRequestLine): ShipmentRequestLot[] =>
  line.lots
    .filter((lot) => lot.statusCode !== 'REPLACED')
    .sort((left, right) => right.pickedAt.localeCompare(left.pickedAt));

/** 교체로 빠진 LOT — 라인 맨 아래 흐린 이력 줄로만 남는다. */
export const replacedLots = (line: ShipmentRequestLine): ShipmentRequestLot[] =>
  line.lots.filter((lot) => lot.statusCode === 'REPLACED');

/** [교체]는 판정이 불합격인 피킹 LOT 에만 선다(FR-013). 보류는 막기만 한다. */
export const canReplace = (lot: ShipmentRequestLot): boolean =>
  lot.statusCode === 'PICKED' && lot.oqcLotStatus === 'REJECTED';

export interface ReplaceEffect {
  before: number;
  after: number;
  /** 교체 뒤 라인이 다시 받는 수량. 빠져도 목표 이상이면 0. */
  receive: number;
}

/** 교체 확인 상자에 미리 보일 수치 — 서버 결과가 정본이고 이것은 묻기 전의 안내다. */
export const replaceEffect = (
  line: ShipmentRequestLine,
  lot: ShipmentRequestLot,
): ReplaceEffect => {
  const after = line.pickedQty - lot.pickedQty;

  return { before: line.pickedQty, after, receive: Math.max(0, line.allocatedQty - after) };
};

export type OqcTone = 'success' | 'error' | 'warning' | 'info' | 'idle';

/** LOT 판정 배지 6종(FR-007)의 색. */
export const oqcTone = (status: OqcLotStatus): OqcTone => {
  switch (status) {
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
      return 'error';
    case 'HELD':
      return 'warning';
    case 'NOT_INSPECTED':
      return 'info';
    default:
      return 'idle';
  }
};

export const codeProblem = (text: string): 'tooLong' | null =>
  text.trim().length > MANAGEMENT_CODE_MAX ? 'tooLong' : null;

export type PickRejectionCode =
  | 'LOT_TARGET_REACHED'
  | 'LOT_ALREADY_RESERVED'
  | 'LOT_ALREADY_PICKED'
  | 'NO_LINE_FOR_ITEM'
  /** 피처 013 — POP 에서 나눈 뒤 PDA 「LOT 분리 확인」 전인 원래 · 새 LOT. */
  | 'LOT_SPLIT_UNCONFIRMED';

export type PickRejection =
  | { kind: 'code'; code: PickRejectionCode }
  /** 보류·불량·재고 없음·유효기간 — 사유가 서버 문구 안에 있다. */
  | { kind: 'server'; message: string }
  /** 응답이 없었다. 같은 LOT 을 다시 스캔하면 같은 멱등 키로 간다. */
  | { kind: 'failed' };

const REJECTION_CODES: readonly string[] = [
  'LOT_TARGET_REACHED',
  'LOT_ALREADY_RESERVED',
  'LOT_ALREADY_PICKED',
  'NO_LINE_FOR_ITEM',
  'LOT_SPLIT_UNCONFIRMED',
];

/** `:pick-lot` 의 거절을 화면 말로 가른다. 409 는 `code` 로, 나머지는 서버 문구로. */
export const pickRejectionOf = (error: ApiError): PickRejection => {
  if (error.kind === 'network') {
    return { kind: 'failed' };
  }

  const code = 'code' in error ? error.code : undefined;

  if (code !== undefined && REJECTION_CODES.includes(code)) {
    return { kind: 'code', code: code as PickRejectionCode };
  }

  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    const message = error.errors[0]?.message;

    return message === undefined || message === ''
      ? { kind: 'failed' }
      : { kind: 'server', message };
  }

  const message = 'message' in error ? error.message : undefined;

  return message === undefined || message === '' ? { kind: 'failed' } : { kind: 'server', message };
};

/** 교체를 서버가 물렸는가(재검 합격이 먼저 들어옴 등) — 다시 눌러도 풀리지 않는다. */
export const isNotRejected = (error: ApiError): boolean =>
  error.kind !== 'network' && 'code' in error && error.code === 'LOT_NOT_REJECTED';

/** 카드·코드 화면의 「고객, 납품처」 — 납품처가 없거나 고객과 같으면 고객만 쓴다(가운뎃점 대신 쉼표, C-13). */
export const partiesText = (customer: string, shipTo: string | null): string =>
  shipTo === null || shipTo === customer ? customer : `${customer}, ${shipTo}`;
