import type { ApiError, InboundLot, InboundLotReopenReasonCode } from '@omf-mes/api-client';

import { plantDateTime, plantShortDateTime } from '../../patterns/plant-time';

/**
 * M-01-03 입하 마감의 판정 · 표기 — 화면이 그리기만 하게 여기 모은다(005 · screens/M-01-03.md).
 */

/** 수량 — 천 단위 쉼표, 소수는 받은 만큼. */
export const formatQty = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('ko-KR', { maximumFractionDigits: 6 })} ${uomCode}`;

/** 패키징 단위 이름(「봉지」) — 이름이 비면 코드(G2 L20 · M-01-01 과 같게). */
export const packageNameOf = (pkg: { uomCode: string; uomName?: string | null }): string => {
  const name = pkg.uomName?.trim() ?? '';
  return name === '' ? pkg.uomCode : name;
};

/** 「11-11 08:05」 — 공장 시각(G1). 읽지 못하면 받은 그대로. */
export const shortWhen = (iso: string | null): string =>
  iso === null ? '' : plantShortDateTime(iso);

/** 「2026-11-11 08:05」 — 공장 시각. */
export const fullWhen = (iso: string | null): string => (iso === null ? '' : plantDateTime(iso));

/** LOT 번호 끝 칸(일련번호) — 「…|0003」의 0003. */
export const lotTail = (lotNo: string): string => lotNo.split('|').at(-1) ?? lotNo;

/** 입하 LOT 번호 끝 4자리 — 막힘 창의 [0003 열기]. */
export const inboundTail = (inboundLotNo: string): string => inboundLotNo.slice(-4);

/** 마감 취소를 막는 입하 중 입하 LOT — 번호는 늘 있고, 지금 목록에 있으면 [열기]할 id 도 있다. */
export interface OpenBlocker {
  inboundLotNo: string;
  inboundLotId: number | null;
}

const blockerByNo = (inboundLotNo: string, receiving: readonly InboundLot[]): OpenBlocker => ({
  inboundLotNo,
  inboundLotId: receiving.find((each) => each.inboundLotNo === inboundLotNo)?.inboundLotId ?? null,
});

/**
 * 목록 행의 막힘 — 서버가 `reopenable=true` 목록에 「같은 공급사·품목 입하 중」 하나로만 막힌 건도 싣고
 * `reopenBlockerCode`·`openInboundLotNo` 를 준다(G1 · screens/M-01-03.md 「막힘 줄」). 화면은 그 칸만 읽는다.
 */
export const openBlockerOf = (
  target: InboundLot,
  receiving: readonly InboundLot[],
): OpenBlocker | null =>
  target.reopenBlockerCode === 'OPEN_RECEIPT_EXISTS' && target.openInboundLotNo !== null
    ? blockerByNo(target.openInboundLotNo, receiving)
    : null;

/**
 * 마감 취소 409 `OPEN_RECEIPT_EXISTS` 뒤 — 목록을 연 뒤 다른 기기가 같은 공급사·품목을 받기 시작한 경우다.
 * 행에 아직 막힘 칸이 없으니 입하 중 목록에서 같은 공급사·품목을 찾는다(공급사·품목마다 하나뿐).
 */
export const openBlockerAfterConflict = (
  target: InboundLot,
  receiving: readonly InboundLot[],
): OpenBlocker | null => {
  const listed = openBlockerOf(target, receiving);

  if (listed !== null) return listed;

  const same = receiving.find(
    (each) =>
      each.inboundLotId !== target.inboundLotId &&
      each.statusCode === 'RECEIVING' &&
      each.supplierId === target.supplierId &&
      each.itemId === target.itemId,
  );

  return same === undefined
    ? null
    : { inboundLotNo: same.inboundLotNo, inboundLotId: same.inboundLotId };
};

/** 마감 취소를 막는 서버 코드(계약 §3 `:reopen-receipt` 409 `blockers[]` — `errors[].code`). */
export const REOPEN_BLOCKER_CODES = [
  'OPEN_RECEIPT_EXISTS',
  'IQC_RECORDED',
  'GOODS_RECEIVED',
  'SKIP_PENDING',
  'INBOUND_LOT_FINALIZED',
  'LEGACY_INBOUND_LOT',
] as const;

export type ReopenBlockerCode = (typeof REOPEN_BLOCKER_CODES)[number];

const codesOf = (error: ApiError): string[] =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.map((item) => item.code)
    : [];

/** 409 의 막힘 코드들 — 계약에 적힌 것만. */
export const reopenBlockersOf = (error: ApiError): ReopenBlockerCode[] =>
  codesOf(error).filter((code): code is ReopenBlockerCode =>
    (REOPEN_BLOCKER_CODES as readonly string[]).includes(code),
  );

/** 판(버전)이 낡았는가 — 다른 기기가 먼저 바꿨다. */
export const isVersionConflict = (error: ApiError): boolean =>
  error.kind === 'conflict' || codesOf(error).includes('VERSION_CONFLICT');

/** 상태가 바뀌어 잠겼는가(그사이 마감 · 최종 마감 등). */
export const isStateLocked = (error: ApiError): boolean =>
  error.kind === 'stateLocked' || codesOf(error).includes('STATE_LOCKED');

/** 마감 취소 가능 건의 까닭 — 서버가 비워 보내면 IQC 결과 0건으로 읽는다(목록 조건이 그것만 낸다). */
export const reopenReasonOf = (lot: InboundLot): InboundLotReopenReasonCode =>
  lot.reopenReasonCode ?? (lot.inspectionRequired ? 'NO_IQC_RESULT' : 'INSPECTION_NOT_REQUIRED');
