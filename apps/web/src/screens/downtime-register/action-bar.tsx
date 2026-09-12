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
  | 'gate-unidentified'
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
 * ⛔ **여기 담는 것은 「이 단말·이 작업자로는 안 된다」뿐이다.** 덜 채운 칸은 담지 않는다 —
 * 그쪽은 **누른 순간** 화면이 무엇이 모자란지 말한다(#1094 · `screen.tsx` 의 `blockedNotice`).
 *
 * 두 갈래를 가르는 이유: 여기 담기는 것들은 **작업자가 화면에서 고칠 수 없어**(권한·사번·설비)
 * 누르기 «전»에 말해야 하고, 덜 채운 칸은 작업자가 지금 채울 수 있어 누를 때 말하면 된다.
 */
export const resolveSaveBlock = ({
  workerNo,
  equipmentId,
  gate,
  hasOngoing,
}: SaveBlockInput): SaveBlock => {
  if (workerNo === null) return 'worker-missing';
  if (equipmentId === null) return 'equipment-missing';
  /*
   * ⛔ **「단말을 모른다」를 「권한이 없다」로 말하지 않는다.** 같은 슬라이스의
   *    `terminal-gating` 이 두 판정을 갈라 두었는데 여기서 다시 합쳐 놓았고, 그 결과 단말
   *    신원이 서지 않는 배포 셸에서 이 화면이 **상시 「이 단말에서는 입력할 수 없습니다」** 로
   *    잠겼다 — 현장은 그것을 권한 회수로 읽고 관리자를 부른다. 두 문장은 할 일이 다르다.
   */
  if (gate === 'denied') return 'gate-denied';
  if (gate === 'unidentified') return 'gate-unidentified';
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
    case 'gate-unidentified':
      return t.errors.gateUnidentified;
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
  /** 아직 아무것도 적지 않았다 — 비울 것이 없으면 「다시 입력」을 잠근다. */
  isEmpty: boolean;
  /** 저장에 필요한 것이 덜 찼다 — **시작 시각과 사유**다(스펙 §5-1 활성 조건). */
  onReset: () => void;
  onSave: () => void;
}

/**
 * 액션바 — 「다시 입력」과 「실적 저장」.
 *
 * ⛔ **「다시 입력」은 서버를 부르지 않는다.** 저장 전 화면 안의 초기화이고, 계약에 대응하는
 * 오퍼레이션이 없는 것도 그래서다.
 */
export const ActionBar = ({ block, isEmpty, onReset, onSave }: ActionBarProps) => {
  return (
    <div className="downtime-actions">
      {/*
       * ⛔ **막힌 사유를 이 자리에 붉은 글자로 두지 않는다**(사용자 지시 2026-09-12).
       *    말하지 않는 것이 아니라 **자리를 옮긴 것이다** — 화면 머리의 배너가 같은 문장을
       *    낸다(`screen.tsx`). 아래에서 붉게 한 번 더 하면 같은 말이 두 곳에 서고, 상시 붉은
       *    글자는 「늘 그런 것」으로 읽혀 정작 막혔을 때 아무도 보지 않는다.
       *
       * ⚠ **`describeSaveBlock` 은 그대로 쓴다** — 문장을 만드는 자리는 여전히 하나다.
       */}

      {/*
       * ⛔ **비울 것이 없으면 잠근다**(사용자 지적 2026-09-07 · 선례 `P-02-04` §5-2 「입력 있음」).
       *    아무것도 적지 않은 채로 눌리면 눌러도 아무 일이 없어 버튼이 고장 난 것처럼 보인다.
       *
       * ⚠ 저장 버튼과 달리 **사유를 적지 않는다** — 비울 것이 없다는 사실은 화면이 이미
       *    보이고 있고, 「입력이 없습니다」는 작업자가 할 일을 말하지 않는다.
       */}
      <Button variant="outlined" size="2xl" disabled={isEmpty} onClick={onReset}>
        {t.actions.reset}
      </Button>
      {/*
       * 큐에 담는 것이 곧 성공이라 「저장하는 중」이 없다 — 통신을 기다리지 않는다.
       *
       * ⛔ **덜 찼다고 잠그지 않는다**(#1094 · 사용자 확정 2026-09-12). 종전에는 시작 시각·사유가
       *    차기 전에 잠갔는데(§5-1 활성 조건), 현장은 **꺼진 버튼을 보고 무엇이 모자란지 알지
       *    못했다** — 88단계 2회차에서 그 오해가 실제로 났다. 이제 누를 수 있고, 누르면
       *    화면 머리에서 무엇이 모자란지 말한다.
       *
       * ⚠ **상주 사유는 여전히 두지 않는다.** 빈 화면을 붉은 글씨로 맞이하지 않는다는 종전
       *    판단(2026-09-07)은 그대로다 — 바뀐 것은 「언제 말하는가」뿐이다.
       */}
      <Button variant="filled" size="2xl" disabled={block !== null} onClick={onSave}>
        {t.actions.save}
      </Button>
    </div>
  );
};
