import { messages } from '@omf-mes/i18n';

import { PuActionBar, PuButton } from '../../patterns/pop-uniform';

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
  /**
   * 이 단말의 번호. **설비를 모르는 «이유»를 가르는 데만 쓴다**(#1149) — 단말을 모르면 설비도
   * 알 수 없으므로 「설비가 지정되지 않았다」는 사실이 아니라 **아직 아무것도 모르는 것**이다.
   */
  terminalId: number | null;
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
  terminalId,
  gate,
  hasOngoing,
}: SaveBlockInput): SaveBlock => {
  if (workerNo === null) return 'worker-missing';
  /*
   * ⛔ **단말을 모르는 것을 「설비가 지정되지 않았다」로 말하지 않는다**(#1149). 설비는 단말에
   *    붙어 오므로 단말이 서기 전에는 없는 것이 당연하고, 그때 관리자에게 설비 지정을
   *    요청하라고 말하면 **아무도 풀 수 없는 심부름**이 된다 — 풀리는 것은 단말 등록이다.
   */
  if (equipmentId === null) {
    return terminalId === null ? 'gate-unidentified' : 'equipment-missing';
  }
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
    /* ⭐ 사번 미확인은 모든 POP 화면이 같은 문구로 말한다(사용자 지시 2026-09-17). */
    case 'worker-missing':
      return messages.popChrome.workerMissing;
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
  /** 아직 아무것도 적지 않았다 — 비울 것이 없으면 「입력 초기화」를 잠근다. */
  isEmpty: boolean;
  /** 시작 시각·사유가 아직 덜 찼는가(스펙 §5-1 활성 조건). */
  isIncomplete: boolean;
  /** 꺼진 [실적 저장]에 손을 올리면 보이는 이유(#295 — 작업 줄에 글을 띄우지 않는다). */
  blockedReason: string | null;
  onReset: () => void;
  onSave: () => void;
}

/**
 * 아래 작업 줄 — [입력 초기화]와 [실적 저장]. 버튼만 둔다(#295 규칙 3): 꺼진 버튼은 흐리게만,
 * 이유는 손을 올리면 보인다. 화면이 고칠 수 없는 막힘(설비·단말·권한)은 「오늘 이 설비」 구획 안 안내 줄이 말한다.
 *
 * ⛔ **「입력 초기화」는 서버를 부르지 않는다.** 저장 전 화면 안의 초기화이고, 계약에 대응하는
 * 오퍼레이션이 없는 것도 그래서다. 비울 것이 없으면 잠근다(선례 `P-02-04` §5-2 「입력 있음」).
 *
 * ⛔ **덜 차면 저장을 잠근다**(스펙 §5-1 활성 조건 · 사용자 확인 2026-09-12 실화면). 큐에 담는
 * 것이 곧 성공이라 「저장하는 중」이 없다.
 */
export const ActionBar = ({
  block,
  isEmpty,
  isIncomplete,
  blockedReason,
  onReset,
  onSave,
}: ActionBarProps) => (
  <PuActionBar>
    <PuButton icon="reset" disabled={isEmpty} onClick={onReset}>
      {t.actions.reset}
    </PuButton>
    <PuButton
      variant="primary"
      disabled={block !== null || isIncomplete}
      title={blockedReason ?? undefined}
      onClick={onSave}
    >
      {t.actions.save}
    </PuButton>
  </PuActionBar>
);
