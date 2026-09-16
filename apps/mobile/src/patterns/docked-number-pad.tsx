import { IconButton, NumberPad } from '@crefle/web-ui';

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
  value,
  onChange,
  onClose,
  move,
  allowDecimal,
  max,
  maxLength,
}: DockedNumberPadProps) => (
  <div className="docked-pad">
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
