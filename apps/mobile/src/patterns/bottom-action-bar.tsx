import { Button } from '@crefle/web-ui';
import { useId } from 'react';

import './bottom-action-bar.css';

export interface BottomAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 누르는 중. 단추가 돌며 잠긴다 - 두 번 눌러 같은 것이 두 번 나가지 않게 한다. */
  busy?: boolean;
}

export interface PrimaryBottomAction extends BottomAction {
  /**
   * 잠겨 있는 이유(공유계약 G-1). 잠긴 단추만 두면 무엇을 해야 풀리는지 알 수 없다.
   * 잠겨 있지 않으면 보이지 않는다.
   */
  lockReason?: string;
}

export interface BottomActionBarProps {
  primary: PrimaryBottomAction;
  /** 같은 무게의 두 번째 길. 부족 납품의 「분할 / 보류」처럼 둘 중 하나를 고르는 자리다. */
  secondary?: BottomAction;
}

/**
 * 화면의 확정 단추를 늘 같은 자리 - 화면 맨 아래 - 에 세운다.
 *
 * 전에는 화면마다 확정 단추가 본문 끝, 바닥 바, 구획 안으로 갈렸다. 단말을 한 손으로 쥐면
 * 엄지가 닿는 곳은 화면 아래쪽이고, 같은 자리에 있어야 화면을 바꿔도 손이 먼저 간다.
 *
 * 화면 뿌리의 마지막 자식으로 둔다. 본문이 짧으면 바닥으로 내려가고(뿌리가 세로 flex),
 * 길면 본문 칸 바닥에 붙은 채 내용이 그 뒤로 흐른다.
 *
 * 숫자판(`DockedNumberPad`)이 열린 동안은 숨는다 - 판의 「확인」이 그 자리를 쓰고, 둘이
 * 겹치면 판의 아랫줄이 가린다. 판을 닫으면 돌아온다.
 */
export const BottomActionBar = ({ primary, secondary }: BottomActionBarProps) => {
  const reasonId = useId();
  const locked = primary.disabled === true && primary.lockReason !== undefined;

  return (
    <div className="bottom-action-bar">
      {locked ? (
        <p id={reasonId} className="bottom-action-bar__reason">
          {primary.lockReason}
        </p>
      ) : null}
      <Button
        variant="filled"
        size="2xl"
        className="bottom-action-bar__button"
        disabled={primary.disabled}
        loading={primary.busy}
        aria-describedby={locked ? reasonId : undefined}
        onClick={primary.onClick}
      >
        {primary.label}
      </Button>
      {secondary === undefined ? null : (
        <Button
          variant="outlined"
          size="2xl"
          className="bottom-action-bar__button"
          disabled={secondary.disabled}
          loading={secondary.busy}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </Button>
      )}
    </div>
  );
};
