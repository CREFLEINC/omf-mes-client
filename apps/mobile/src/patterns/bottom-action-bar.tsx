import { Icon } from '@crefle/web-ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from './button';
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
  /**
   * 주 단추 아래 한 줄에 반씩 서는 낮은 두 길(48px). 초과 입하의 「정량분만 / 초과분만」처럼
   * 기본 길이 아닌 대안이다.
   */
  alternatives?: [BottomAction, BottomAction];
  /**
   * 단추 위의 물음. 고르는 단추가 곧 등록인 자리(부족 납품)에서, 무엇을 고르는지를 단추와 같은
   * 눈높이에 둔다 - 본문에 두면 그 물음 하나 때문에 화면이 한 화면을 넘었다.
   */
  prompt?: ReactNode;
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
export const BottomActionBar = ({
  primary,
  secondary,
  alternatives,
  prompt,
}: BottomActionBarProps) => {
  const reasonId = useId();
  const locked = primary.disabled === true && primary.lockReason !== undefined;
  const barRef = useRef<HTMLDivElement | null>(null);

  /*
   * 바의 높이를 문서에 알린다. 화면 오른쪽 아래에 뜨는 단추(스캔 구역의 직접 입력)가 바 바로 위에
   * 서려면 바가 얼마나 높은지 알아야 하는데, 잠긴 이유 · 두 번째 길에 따라 높이가 달라져 CSS 에
   * 적어 둘 수 없다.
   */
  useEffect(() => {
    const bar = barRef.current;

    if (bar === null) {
      return;
    }

    const root = document.documentElement;
    const record = () => {
      root.style.setProperty('--bottom-action-bar-height', `${String(bar.offsetHeight)}px`);
    };

    record();

    /* 이 기능이 없는 환경에서 던지면 화면이 통째로 멈춘다. 처음 잰 높이로 둔다. */
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(record) : null;
    observer?.observe(bar);

    return () => {
      observer?.disconnect();
      root.style.removeProperty('--bottom-action-bar-height');
    };
  }, []);

  return (
    <div ref={barRef} className="bottom-action-bar">
      {prompt === undefined ? null : <div className="bottom-action-bar__prompt">{prompt}</div>}
      {locked ? (
        <p id={reasonId} className="bottom-action-bar__reason">
          <Icon name="lock" size={16} />
          <span>{primary.lockReason}</span>
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
      {/*
       * 두 번째 길은 한 단계 낮춘다(60px). 둘 다 72px 이면 바가 화면 아래 4분의 1을 덮어, 고르기
       * 전에 읽어야 할 물음이 그 밑에 깔린다.
       */}
      {secondary === undefined ? null : (
        <Button
          variant="outlined"
          size="xl"
          className="bottom-action-bar__button"
          disabled={secondary.disabled}
          loading={secondary.busy}
          onClick={secondary.onClick}
        >
          {secondary.label}
        </Button>
      )}
      {alternatives === undefined ? null : (
        <div className="bottom-action-bar__alternatives">
          {alternatives.map((each) => (
            <Button
              key={each.label}
              variant="outlined"
              size="lg"
              className="bottom-action-bar__button"
              disabled={each.disabled}
              loading={each.busy}
              onClick={each.onClick}
            >
              {each.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
