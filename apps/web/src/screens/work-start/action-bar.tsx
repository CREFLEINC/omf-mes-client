import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PuActionBar, PuButton } from '../../patterns/pop-uniform';

const t = messages.workStart.actions;

export interface ActionBarProps {
  /**
   * 주 동작의 종류. 시작, 재개, 다시 시작, 이어하기는 다른 경로라 이름도 갈린다. 재개는 열린 세션에
   * 사건을 붙이고, 시작과 다시 시작은 새 세션을 연다. 이어하기는 쓰기 없이 자재 투입으로 자리만
   * 옮긴다. `checking`은 중단 W/O의 열린 세션을 아직 모르는 동안이다.
   */
  mode: 'start' | 'resume' | 'restart' | 'checking' | 'continue';
  /** 막혀 있는가. 꺼진 버튼은 흐리게만 보인다(POP 통일 규칙 3). */
  isBlocked: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  /** 주 동작을 설명하는 글(막힘 사유·지금 할 수 있는 일)의 id — 읽어 주기용. */
  describedBy: string;
  /** 왼쪽 보조 동작. 단말 권한 [다시 확인] 등. */
  leading?: ReactNode;
  /** 주 버튼 왼쪽에 서는 버튼 — 긴급 작업지시의 [자재 투입]·[실적 입력](#295). */
  secondary?: ReactNode;
}

/**
 * 아래 작업 줄(POP 통일 규칙 2·3): 버튼만. 왼쪽에 안내 글을 띄우지 않고, 빨간 주 버튼 하나가 오른쪽.
 * 고른 것을 무르는 길은 카드를 한 번 더 누르는 것 하나다(§5-A). [다시 선택]을 따로 두지 않는다.
 */
export const ActionBar = ({
  mode,
  isBlocked,
  isSaving,
  onSubmit,
  describedBy,
  leading,
  secondary,
}: ActionBarProps) => (
  <PuActionBar lead={leading}>
    {secondary}
    <PuButton
      variant="primary"
      disabled={isBlocked || isSaving}
      aria-describedby={describedBy}
      onClick={onSubmit}
    >
      {isSaving ? t.starting : mode === 'continue' ? t.continueToSession : t[mode]}
    </PuButton>
  </PuActionBar>
);
