import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { ActionBar as SharedActionBar } from '../../patterns/action-bar';
import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.workStart.actions;

export interface ActionBarProps {
  /**
   * 주 동작의 종류. 시작, 재개, 이어하기는 다른 경로라 이름도 갈린다. 이어하기는 쓰기 없이 자재
   * 투입으로 자리만 옮긴다.
   */
  mode: 'start' | 'resume' | 'continue';
  /** 「남은 일」 문장. 주 동작이 잠기면 이 문장이 사유다(C-4). */
  remaining: string;
  /** 사용자가 할 일인가. 참이면 「남은 일:」 머리말이 붙는다(C-5). */
  todo: boolean;
  /** 막혀 있는가. 사유는 `remaining`이 말한다. */
  isBlocked: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  /** 바 왼쪽 보조 동작(테두리). 단말 권한 [다시 확인] 등. */
  leading?: ReactNode;
}

/**
 * 하단 동작 바(C-3, C-4, C-5). 공용 `patterns/action-bar`를 POP에서 쓴다. 왼쪽 「남은 일」 한 줄,
 * 오른쪽 주 동작 하나.
 *
 * 버튼 크기는 POP 터치 규격(`touch-spec`)을 그대로 쓴다. 고른 것을 무르는 길은 카드를 한 번 더
 * 누르는 것 하나다(§5-A). [다시 선택]을 따로 두지 않는다.
 */
export const ActionBar = ({
  mode,
  remaining,
  todo,
  isBlocked,
  isSaving,
  onSubmit,
  leading,
}: ActionBarProps) => {
  const remainingId = useId();

  return (
    <SharedActionBar remaining={remaining} todo={todo} remainingId={remainingId} leading={leading}>
      <Button
        type="button"
        variant="filled"
        size={POP_TOUCH_SIZE}
        disabled={isBlocked || isSaving}
        aria-describedby={remainingId}
        onClick={onSubmit}
      >
        {isSaving
          ? t.starting
          : mode === 'resume'
            ? t.resume
            : mode === 'continue'
              ? t.continueToSession
              : t.start}
      </Button>
    </SharedActionBar>
  );
};
