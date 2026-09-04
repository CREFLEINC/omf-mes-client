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
  if (input.handlingUnitTypeCode === '') return t.locks.noType;
  if (input.lines.length === 0) return t.locks.noContents;

  return undefined;
};
