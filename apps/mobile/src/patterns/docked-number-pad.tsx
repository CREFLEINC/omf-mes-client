import { Keyboard } from '@capacitor/keyboard';
import { IconButton, NumberPad } from '@crefle/web-ui';
import { useEffect, useRef } from 'react';

import './docked-number-pad.css';

/**
 * 화면 아래에 붙는 숫자판. 전에는 화면마다 세 갈래여서 작업자가 화면마다 다른 버릇을
 * 익혀야 했다. 줄 안에 끼우면 아래 줄이 화면 밖으로 밀려 붙박이로 둔다.
 *
 * 쓰는 쪽은 바깥 요소에 `docked-pad-open` 을 붙인다. 판이 내용 위에 뜨므로 그만큼 아래를
 * 비우지 않으면 마지막 줄이 가려진 채 남는다.
 */
export interface DockedNumberPadMove {
  /** 앞으로 갈 곳이 있는가. 없으면 단추는 서되 눌리지 않는다. */
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
}

export interface DockedNumberPadProps {
  /** 무엇을 적는 중인지. 칸이 하나인 화면에서도 비우지 않는다. */
  head: string;
  /** 지금 적는 칸의 `id`. 이동 단추를 누른 뒤 포커스는 바탕에 있어 이것 없이는 못 찾는다. */
  fieldId?: string;
  value: string;
  onChange: (value: string) => void;
  /** 숫자판을 닫는다. 소수점 키 옆 빈 칸이 이 자리다 — 닫는 단추를 따로 세우지 않는다. */
  onClose: () => void;
  /** 적을 칸이 여럿일 때만 넘긴다. 갈 곳이 없는데 단추를 세우면 눌러 보고 나서야 안다. */
  move?: DockedNumberPadMove;
  allowDecimal?: boolean;
  max?: number;
  maxLength?: number;
}

export const DockedNumberPad = ({
  head,
  fieldId,
  value,
  onChange,
  onClose,
  move,
  allowDecimal,
  max,
  maxLength,
}: DockedNumberPadProps) => {
  const padRef = useRef<HTMLDivElement | null>(null);

  /*
   * 잰 높이를 알린다. 눈금 하나로 못 박으면 머리줄이 두 줄로 접힌 화면에서 모자라 칸이 덮인다.
   * 칸을 화면에 들이는 아래 효과보다 먼저 두어야 그 효과가 새 높이로 맞춘다.
   */
  useEffect(() => {
    const pad = padRef.current;

    if (pad === null) {
      return;
    }

    document.documentElement.style.setProperty(
      '--docked-pad-height',
      `${String(pad.offsetHeight)}px`,
    );
  }, [head]);

  useEffect(
    () => () => {
      document.documentElement.style.removeProperty('--docked-pad-height');
    },
    [],
  );

  /*
   * 확인 키를 못 찾은 사람은 화면을 눌러 닫으려 한다. 누름의 시작에서 닫는다 - 끝난 뒤에
   * 닫으면 그 아래 있던 것이 눌리지 않는다.
   */
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && padRef.current?.contains(target) === true) {
        return;
      }

      onClose();
    };

    document.addEventListener('pointerdown', onDown);

    return () => {
      document.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  /*
   * 비고처럼 자판이 필요한 칸을 치다가 숫자칸을 누르면 자판이 남아 둘이 겹친다. 칸의 설정으로는
   * 못 내린다 - 이미 올라온 자판은 그 값을 보지 않는다. 웹에는 통로가 없어 조용히 지나간다.
   */
  useEffect(() => {
    void Keyboard.hide().catch(() => undefined);
  }, []);

  /*
   * 적는 칸을 판 위로 끌어올리고 포커스도 함께 옮긴다. `nearest` 로는 못 푼다 - 덮인 칸도
   * 창 안에는 있어 이미 보인다고 보고 그냥 둔다. `end` 여야 아래 여백을 쓴다.
   */
  useEffect(() => {
    const target = fieldId === undefined ? null : document.getElementById(fieldId);

    /* 맞추는 일은 아래에서 한 번에 한다. 여기서 함께 움직이면 두 번 튄다. */
    if (target !== null) {
      target.focus({ preventScroll: true });
    }

    const shown = target ?? document.activeElement;

    /* 이 기능이 없는 환경에서 던지면 화면이 통째로 멈춘다. 맞추기는 있으면 좋은 것이다. */
    if (!(shown instanceof HTMLElement) || typeof shown.scrollIntoView !== 'function') {
      return;
    }

    /* 움직임을 줄여 달라는 설정을 존중한다. 그 물음을 못 받는 환경도 있다. */
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    shown.scrollIntoView({ block: 'end', behavior: reduced ? 'auto' : 'smooth' });
  }, [head, fieldId]);

  return (
    <div className="docked-pad" ref={padRef}>
      <p className="docked-pad__head">{head}</p>
      <div className="docked-pad__row">
        {move === undefined ? null : (
          <IconButton
            icon="chevron_left"
            size="xl"
            aria-label={move.previousLabel}
            disabled={!move.canPrevious}
            onClick={move.onPrevious}
          />
        )}
        <NumberPad
          value={value}
          onChange={onChange}
          onConfirm={onClose}
          allowDecimal={allowDecimal}
          max={max}
          maxLength={maxLength}
        />
        {move === undefined ? null : (
          <IconButton
            icon="chevron_right"
            size="xl"
            aria-label={move.nextLabel}
            disabled={!move.canNext}
            onClick={move.onNext}
          />
        )}
      </div>
    </div>
  );
};
