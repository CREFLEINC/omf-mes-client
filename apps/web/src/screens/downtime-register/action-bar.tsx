import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { GateVerdict } from './terminal-gating';

const t = messages.downtimeRegister;

/**
 * 저장이 막히는 사유. **순서가 규정이다** — 먼저 걸리는 것을 말한다.
 *
 * ⛔ **「모른다」를 「통과」로 처리하지 않는다.** 사번·설비를 모르는 상태와 권한이 없는 상태는
 * 작업자가 할 일이 다르므로 문장도 갈린다.
 */
export type SaveBlock =
  | 'worker-missing'
  | 'equipment-missing'
  | 'gate-denied'
  | 'gate-unavailable'
  | 'gate-checking'
  | 'ongoing-exists'
  | null;

export interface SaveBlockInput {
  workerNo: string | null;
  equipmentId: number | null;
  gate: GateVerdict;
  hasOngoing: boolean;
}

/**
 * ⛔ **입력 오류는 여기 들어오지 않는다.** 덜 채운 칸 때문에 버튼을 잠그면 눌러 볼 수 없고,
 * 눌러 볼 수 없으면 **무엇이 모자란지 말할 계기가 사라진다** — 작업자는 잠긴 버튼 앞에서
 * 이유를 모른 채 선다. 채우지 못한 것은 누른 뒤 칸 옆에서 말한다.
 */
export const resolveSaveBlock = ({
  workerNo,
  equipmentId,
  gate,
  hasOngoing,
}: SaveBlockInput): SaveBlock => {
  if (workerNo === null) return 'worker-missing';
  if (equipmentId === null) return 'equipment-missing';
  if (gate === 'denied' || gate === 'unidentified') return 'gate-denied';
  if (gate === 'unavailable') return 'gate-unavailable';
  if (gate === 'checking') return 'gate-checking';
  /*
   * ⛔ **진행 중이 있으면 새로 시작할 수 없다**(스펙 §6-1). 먼저 종료하지 않으면 한 설비에
   * 열린 구간이 둘 쌓이고, 그 뒤로는 무엇을 닫아야 하는지 화면이 말할 수 없게 된다.
   */
  if (hasOngoing) return 'ongoing-exists';

  return null;
};

export const describeSaveBlock = (block: SaveBlock): string | null => {
  switch (block) {
    case 'worker-missing':
      return t.errors.workerMissing;
    case 'equipment-missing':
      return t.errors.equipmentMissing;
    case 'gate-denied':
      return t.errors.gateDenied;
    case 'gate-unavailable':
      return t.errors.gateUnavailable;
    case 'gate-checking':
      return t.errors.gateChecking;
    case 'ongoing-exists':
      return t.ongoing.blocksNew;
    case null:
      return null;
  }
};

export interface ActionBarProps {
  block: SaveBlock;
  onReset: () => void;
  onSave: () => void;
}

/**
 * 액션바 — 「다시 입력」과 「실적 저장」.
 *
 * ⛔ **「다시 입력」은 서버를 부르지 않는다.** 저장 전 화면 안의 초기화이고, 계약에 대응하는
 * 오퍼레이션이 없는 것도 그래서다.
 */
export const ActionBar = ({ block, onReset, onSave }: ActionBarProps) => {
  const reason = describeSaveBlock(block);

  return (
    <div className="downtime-actions">
      {/* 막힌 이유는 버튼 옆에 **항상 보이는 글자**로 둔다 — 눌러 봐야 아는 잠금은 잠금이 아니다. */}
      {reason !== null && <p className="downtime-block-reason">{reason}</p>}

      <Button variant="outlined" size="2xl" onClick={onReset}>
        {t.actions.reset}
      </Button>
      {/* 큐에 담는 것이 곧 성공이라 「저장하는 중」이 없다 — 통신을 기다리지 않는다. */}
      <Button variant="filled" size="2xl" disabled={block !== null} onClick={onSave}>
        {t.actions.save}
      </Button>
    </div>
  );
};
