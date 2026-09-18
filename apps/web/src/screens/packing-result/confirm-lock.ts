import { messages } from '@omf-mes/i18n';

import type { GateVerdict } from './terminal-gating';
import type { PackedLine } from './types';

/**
 * [포장 확정]을 막는 사유 — **하나라도 걸리면 사유를 말하고 잠근다.**
 *
 * ⛔ **감추지 않는다.** 버튼만 흐려 두면 작업자는 무엇을 채워야 하는지 알 수 없고, 스캔을
 * 처음부터 다시 한다. ⛔ **「모른다」와 「막혔다」를 한 문장으로 묶지 않는다**(공유계약 F-6) —
 * 게이팅을 확인하지 못한 것과 권한이 없는 것은 사용자가 할 수 있는 일이 다르다.
 *
 * **순서가 뜻을 정한다.** 연결·권한처럼 화면 밖 사정을 먼저 말한다 — 담을 것을 다 채운 뒤에야
 * 「연결이 끊겼다」를 보게 되면 그 입력이 헛일이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.packingResult;

export interface ConfirmLockInput {
  isOnline: boolean;
  gate: GateVerdict;
  workerNo: string | null;
  /** 어느 출하를 포장하는가. 이것이 없으면 아직 «고르지 않은» 것이다. */
  shipmentId: number | null;
  /** 확정 본문이 실어야 하는 창고. 출하 전표에서 온다. */
  warehouseId: number | null;
  /** 그 포장을 지금 만드는 중인가. 「모르는 것」과 「막힌 것」을 가른다. */
  isOpeningUnit: boolean;
  handlingUnitTypeCode: string;
  lines: readonly PackedLine[];
}

export const confirmLockReason = (input: ConfirmLockInput): string | undefined => {
  if (!input.isOnline) return t.locks.offline;

  switch (input.gate) {
    case 'checking':
      return t.locks.gateChecking;
    case 'denied':
      return t.locks.gateDenied;
    case 'unavailable':
      return t.locks.gateUnavailable;
    case 'unidentified':
      return t.locks.gateUnidentified;
    case 'allowed':
      break;
  }

  if (input.workerNo === null || input.workerNo.trim() === '') return t.locks.workerMissing;
  /*
   * ⛔ **고르기 전과 고른 뒤를 갈라 말한다**(#1093 리뷰). 창고는 출하 전표에서 오므로
   *    출하를 고르기 전에는 언제나 비어 있다 — 그것까지 「전표에 창고가 없다」고 말하면
   *    진입 직후의 정상 상태가 자료 결함처럼 읽힌다.
   */
  if (input.shipmentId === null) return t.locks.shipmentMissing;
  /* ⛔ 처리기가 조용히 되돌아오던 조건이다(#1093) — 잠그고 사유를 말한다. */
  if (input.warehouseId === null) return t.locks.warehouseMissing;
  if (input.handlingUnitTypeCode === '') return t.locks.noType;
  if (input.lines.length === 0) return t.locks.noContents;
  /*
   * ⭐ **포장이 아직 없어도 확정을 막지 않는다**(사용자 지시 2026-09-18 · omf-all-around#5).
   *    담는 동안 만든 포장이 실패하면 「포장을 만들지 못했습니다」로 잠갔는데, 담긴 것이 있는데
   *    확정을 못 하게 되고 그 문구가 LOT 거부 안내와 겹쳐 보였다. 이제 확정이 포장이 없으면
   *    그 자리에서 만들고 담는다(`screen.tsx` 확정 처리) — 실패는 확정 실패 안내 자리에 뜬다.
   *    ⛔ 되돌려 이 잠금을 되살리지 않는다.
   *    만드는 «중»에만 잠근다 — 두 번 만들지 않기 위해서다(문구는 하단에 적지 않는다).
   */
  if (input.isOpeningUnit) return t.locks.unitOpening;

  return undefined;
};
