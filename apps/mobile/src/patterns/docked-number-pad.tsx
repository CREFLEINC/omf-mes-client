import { Keyboard } from '@capacitor/keyboard';
import { IconButton, NumberPad } from '@crefle/web-ui';
import { useEffect, useRef } from 'react';

import './docked-number-pad.css';

/**
 * 화면 아래에 붙는 숫자판.
 *
 * 한 모양으로 모은다. 전에는 화면마다 세 갈래였다 — 늘 떠 있는 것, 대상을 고르면 계속
 * 서 있는 것, 줄 안에 떴다 사라지는 것. 작업자가 화면마다 다른 버릇을 익혀야 했다.
 *
 * 줄 안에 그리지 않는다. 끼우면 아래 줄이 화면 밖으로 밀리고, 뒤이어 뜨는 칸이 숫자판
 * 아래에 생겨 어디서 온 것인지 알 수 없다.
 *
 * 머리줄은 칸이 하나여도 둔다. 목록 밖에 서기 때문에 무엇을 적는 중인지 화면이 스스로
 * 말해야 한다.
 *
 * 쓰는 쪽은 바깥 요소에 `docked-pad-open` 을 붙인다. 숫자판이 내용 위에 뜨므로 그만큼
 * 아래를 비우지 않으면 마지막 줄이 가려진 채 남는다.
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
  /**
   * 지금 적는 칸의 `id`. 적을 칸이 여럿이면 넘긴다 - 이동 단추를 누른 뒤 포커스는 칸이 아니라
   * 바탕에 있어, 누가 대상인지 화면을 뒤져서는 알 수 없다.
   */
  fieldId?: string;
  value: string;
  onChange: (value: string) => void;
  /** 숫자판을 닫는다. 소수점 키 옆 빈 칸이 이 자리다 — 닫는 단추를 따로 세우지 않는다. */
  onClose: () => void;
  /**
   * 적을 칸이 여럿일 때만 넘긴다. 넘기지 않으면 이동 단추를 그리지 않는다 — 갈 곳이
   * 없는데 단추만 세우면 눌러 보고 나서야 알게 된다.
   */
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
   * 숫자판 바깥을 누르면 닫는다. 확인 키를 못 찾은 사람은 화면을 눌러 닫으려 하는데, 그대로
   * 두면 아래 절반이 덮인 채 남는다.
   *
   * 누름의 시작에서 닫는다 - 누름이 끝난 뒤에 닫으면 그 아래 있던 것이 눌리지 않는다.
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
   * 기기 자판을 내린다. 비고처럼 자판이 필요한 칸을 치다가 숫자칸을 누르면 포커스가 옮겨
   * 가도 자판이 남아, 앱 숫자판이 그 위에 서서 둘이 겹친다(실기 2026-09-17).
   *
   * 칸의 설정으로는 내릴 수 없다 - 이미 올라온 자판은 그 값을 보지 않는다. 단말에 직접
   * 내리라고 이른다. 웹으로 열었을 때는 통로가 없으므로 조용히 지나간다.
   */
  useEffect(() => {
    void Keyboard.hide().catch(() => undefined);
  }, []);

  /*
   * 적는 칸이 화면 아래에 있으면 숫자판이 그 위에 서면서 칸을 덮는다. 무엇을 치는지 보이지
   * 않으므로 칸을 숫자판 위로 끌어올린다. 비울 자리는 `docked-pad-open` 이 만든다.
   *
   * `nearest` 로는 못 푼다 - 덮인 칸도 창 안에는 있어 이미 보인다고 보고 그냥 둔다. `end` 로
   * 맞춰야 `scroll-margin-block-end` 만큼 아래를 비워 판 위로 올라온다(실기 2026-09-17).
   *
   * 옮겨 간 칸에는 포커스를 함께 옮긴다. 이동 단추를 누른 뒤 포커스는 바탕에 있어, 그대로
   * 두면 앞 칸이 판 위에 선 채 남고 적는 칸은 덮인다.
   */
  useEffect(() => {
    const target = fieldId === undefined ? null : document.getElementById(fieldId);

    if (target !== null) {
      target.focus();
    }

    const shown = target ?? document.activeElement;

    if (shown instanceof HTMLElement && typeof shown.scrollIntoView === 'function') {
      shown.scrollIntoView({ block: 'end' });
    }
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
