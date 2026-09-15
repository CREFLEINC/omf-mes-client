import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MarkerOverlay, type OverlayMarker } from './marker-overlay';

/*
 * 판의 시험.
 *
 * ⭐ **이 부품이 틀리는 방식은 조용하다.** 점이 한 픽셀 밀리거나, 고르려다 옮겨지거나, 잠긴
 * 판이 눌리는 것은 화면에서 멀쩡해 보인다 — 저장하고 나서야 드러난다. 그래서 「무엇이
 * 보이는가」가 아니라 **「밖으로 어떤 값이 나갔는가」**를 잰다.
 *
 * ⚠ **jsdom 은 배치를 계산하지 않는다.** `getBoundingClientRect` 가 늘 0 이라 비율을 낼 수
 * 없으므로 판의 칸을 손으로 세워 준다(아래 `BOARD_RECT`). 이 스텁이 없으면 좌표를 다루는
 * 시험이 전부 「판이 0 픽셀」이라는 이유로 조용히 통과해 버린다.
 */

const IMAGE_LABEL = '창고 도면';

/** 200×100 짜리 판. 가로 20px = 0.1, 세로 20px = 0.2 로 떨어져 셈이 눈으로 확인된다. */
const BOARD_RECT = { left: 0, top: 0, width: 200, height: 100 };

const MARKERS: OverlayMarker[] = [{ id: '7', x: 0.1, y: 0.2, label: 'A-01' }];

const stubRect = (element: HTMLElement): void => {
  element.getBoundingClientRect = (): DOMRect =>
    ({
      ...BOARD_RECT,
      right: BOARD_RECT.left + BOARD_RECT.width,
      bottom: BOARD_RECT.top + BOARD_RECT.height,
      x: BOARD_RECT.left,
      y: BOARD_RECT.top,
      toJSON: () => ({}),
    }) as DOMRect;
};

interface Harness {
  board: HTMLElement;
  pin: HTMLElement;
  live: HTMLElement;
  onPlace: ReturnType<typeof vi.fn>;
  onSelect: ReturnType<typeof vi.fn>;
  onMove: ReturnType<typeof vi.fn>;
}

const setup = (
  props: Partial<ComponentProps<typeof MarkerOverlay>> = {},
): Omit<Harness, 'pin'> & { pin: (label?: string) => HTMLElement } => {
  const onPlace = vi.fn();
  const onSelect = vi.fn();
  const onMove = vi.fn();

  const { container } = render(
    <MarkerOverlay
      src="blob:map"
      imageLabel={IMAGE_LABEL}
      markers={MARKERS}
      onPlace={onPlace}
      onSelect={onSelect}
      onMove={onMove}
      {...props}
    />,
  );

  const board = screen.getByRole('group', { name: IMAGE_LABEL });
  const live = container.querySelector<HTMLElement>('[aria-live="polite"]');

  if (live === null) throw new Error('낭독 영역이 서 있지 않습니다.');

  stubRect(board);

  return {
    board,
    live,
    pin: (label = 'A-01') => screen.getByRole('button', { name: label }),
    onPlace,
    onSelect,
    onMove,
  };
};

/** 마우스 왼쪽 버튼으로 누른다 — 기본값에 기대지 않는다(빈 `pointerType` 은 마우스가 아니다). */
const press = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerDown(target, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX,
    clientY,
  });
};

const moveTo = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerMove(target, { pointerId: 1, pointerType: 'mouse', clientX, clientY });
};

const release = (target: HTMLElement, clientX: number, clientY: number): void => {
  fireEvent.pointerUp(target, { pointerId: 1, pointerType: 'mouse', clientX, clientY });
};

/** 손가락으로 누른다 — 터치는 `button` 번호를 따지지 않는다. */
const touchDown = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerDown(target, { pointerId, pointerType: 'touch', button: -1, clientX, clientY });
};

const touchMove = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerMove(target, { pointerId, pointerType: 'touch', clientX, clientY });
};

const touchUp = (
  target: HTMLElement,
  pointerId: number,
  clientX: number,
  clientY: number,
): void => {
  fireEvent.pointerUp(target, { pointerId, pointerType: 'touch', clientX, clientY });
};

describe('MarkerOverlay — 놓기', () => {
  it('⭐ 빈 자리를 누르면 픽셀이 아니라 비율이 나간다', () => {
    const { board, onPlace } = setup();

    fireEvent.click(board, { clientX: 50, clientY: 25 });

    expect(onPlace).toHaveBeenCalledWith(0.25, 0.25);
  });

  it('⭐ 판 밖으로 나간 자리도 0~1 로 묶인다', () => {
    const { board, onPlace } = setup();

    fireEvent.click(board, { clientX: -40, clientY: 400 });

    expect(onPlace).toHaveBeenCalledWith(0, 1);
  });

  it('⛔ 표식을 누른 것은 놓기가 아니다 — 고르는 순간 점이 하나 더 생기면 안 된다', () => {
    const { pin, onPlace, onSelect } = setup();

    fireEvent.click(pin());

    expect(onSelect).toHaveBeenCalledWith('7');
    expect(onPlace).not.toHaveBeenCalled();
  });
});

describe('MarkerOverlay — 화살표로 밀기', () => {
  it('⭐ 한 번에 `step` 만큼 민다 — 마우스 없이도 옮길 수 있어야 한다', () => {
    const { pin, onMove } = setup();

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });
    expect(onMove).toHaveBeenCalledWith('7', 0.11, 0.2);

    fireEvent.keyDown(pin(), { key: 'ArrowUp' });
    expect(onMove).toHaveBeenLastCalledWith('7', 0.1, 0.19);
  });

  it('⭐ `step` 은 밖에서 정한다', () => {
    const { pin, onMove } = setup({ step: 0.05 });

    fireEvent.keyDown(pin(), { key: 'ArrowDown' });

    expect(onMove).toHaveBeenCalledWith('7', 0.1, 0.25);
  });

  it('⛔ 판 밖으로는 못 민다 — 가장자리에서는 0·1 에 머문다', () => {
    const { pin, onMove } = setup({ markers: [{ id: '7', x: 0, y: 1, label: 'A-01' }] });

    fireEvent.keyDown(pin(), { key: 'ArrowLeft' });
    expect(onMove).toHaveBeenCalledWith('7', 0, 1);

    fireEvent.keyDown(pin(), { key: 'ArrowDown' });
    expect(onMove).toHaveBeenLastCalledWith('7', 0, 1);
  });

  it('화살표가 아닌 키는 건드리지 않는다', () => {
    const { pin, onMove } = setup();

    fireEvent.keyDown(pin(), { key: 'a' });

    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('MarkerOverlay — 끌어 옮기기', () => {
  it('⛔ 2px 떨림은 이동이 아니다 — 고르려는 손이 점을 밀면 안 된다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 22, 20);
    release(marker, 22, 20);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 임계값을 넘으면 그때부터 매 이동이 나간다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 24, 20);
    expect(onMove).toHaveBeenCalledWith('7', 0.12, 0.2);

    moveTo(marker, 40, 50);
    expect(onMove).toHaveBeenLastCalledWith('7', 0.2, 0.5);
    expect(onMove).toHaveBeenCalledTimes(2);

    release(marker, 40, 50);
  });

  it('⛔ 옮기고 손을 뗀 직후의 click 은 고르기가 아니다', () => {
    const { pin, onSelect } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 40, 50);
    release(marker, 40, 50);
    fireEvent.click(marker);

    expect(onSelect).not.toHaveBeenCalled();

    /* 삼키는 것은 그 한 번뿐이다 — 다음 누름은 평소대로 고른다. */
    press(marker, 40, 50);
    release(marker, 40, 50);
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('⛔ 옮기다 놓은 자리가 판에 새어 새 점이 되지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 40, 50);
    release(marker, 40, 50);
    /* 포인터 캡처가 없는 브라우저에서는 이 click 이 판으로 온다. */
    fireEvent.click(board, { clientX: 40, clientY: 50 });

    expect(onPlace).not.toHaveBeenCalled();
  });

  /*
   * ⭐ **click 이 오지 않는 드래그가 흔하다.** 터치에서는 브라우저가 드래그 뒤 click 을 아예
   * 보내지 않고, `pointercancel` 로 빼앗긴 제스처도 그렇다. 그러면 세워 둔 「삼킬 click」 표가
   * 쓰이지 못한 채 남아 **다음 판 누름**을 대신 먹는다 — 사용자에게는 한 번 씹히는 판이 된다.
   * 아래 둘은 그 묵은 표가 지워지는지를 잰다.
   */
  it('⛔ 터치 드래그 뒤 click 이 없어도 다음 판 누름이 씹히지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    touchDown(marker, 5, 20, 20);
    touchMove(marker, 5, 40, 50);
    touchUp(marker, 5, 40, 50);
    /* 여기서 click 이 오지 않는다 — 삼킬 표만 남는다. */

    touchDown(board, 6, 100, 50);
    touchUp(board, 6, 100, 50);
    fireEvent.click(board, { clientX: 100, clientY: 50 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('⛔ `pointercancel` 로 끝난 드래그도 다음 판 누름을 먹지 않는다', () => {
    const { board, pin, onPlace } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 40, 50);
    fireEvent.pointerCancel(marker, { pointerId: 1, pointerType: 'mouse' });

    press(board, 100, 50);
    release(board, 100, 50);
    fireEvent.click(board, { clientX: 100, clientY: 50 });

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('움직이지 않은 누름 뒤의 click 은 그대로 고르기다', () => {
    const { pin, onSelect } = setup();
    const marker = pin();

    press(marker, 20, 20);
    release(marker, 20, 20);
    fireEvent.click(marker);

    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('⛔ 오른쪽 버튼으로는 끌지 않는다 — 상황 메뉴를 부르다 점이 옮겨지면 안 된다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    fireEvent.pointerDown(marker, {
      pointerId: 1,
      pointerType: 'mouse',
      button: 2,
      clientX: 20,
      clientY: 20,
    });
    moveTo(marker, 40, 50);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 손가락은 버튼 번호를 따지지 않는다 — 터치는 `button: 0` 이 아니어도 끌린다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    touchDown(marker, 5, 20, 20);
    touchMove(marker, 5, 40, 50);

    expect(onMove).toHaveBeenCalledWith('7', 0.2, 0.5);
  });

  it('⛔ 이미 끌고 있으면 두 번째 손가락이 드래그를 빼앗지 않는다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    touchDown(marker, 5, 20, 20);
    /* 두 번째 손가락. 슬롯을 덮으면 첫 손가락의 이동이 「남의 드래그」가 되어 사라진다. */
    touchDown(marker, 6, 60, 60);

    touchMove(marker, 5, 40, 50);
    expect(onMove).toHaveBeenCalledWith('7', 0.2, 0.5);

    /* 받아 주지 않은 손가락의 이동은 드래그가 아니다. */
    touchMove(marker, 6, 100, 80);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('⭐ 제스처를 빼앗기면(`pointercancel`) 드래그가 끝난다 — 유령 이동이 남지 않는다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 20, 20);
    fireEvent.pointerCancel(marker, { pointerId: 1, pointerType: 'mouse' });
    moveTo(marker, 40, 50);

    expect(onMove).not.toHaveBeenCalled();
  });

  it('다른 포인터의 이동은 남의 드래그가 아니다', () => {
    const { pin, onMove } = setup();
    const marker = pin();

    press(marker, 20, 20);
    fireEvent.pointerMove(marker, { pointerId: 9, pointerType: 'touch', clientX: 40, clientY: 50 });

    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('MarkerOverlay — 잠긴 판', () => {
  /*
   * ⛔ **`aria-readonly` 로 재지 않는다** — `group` 이 받지 않는 속성이라 붙여 두어도 낭독기가
   * 통째로 버린다. 「잠겼다」가 닿으려면 `group` 에 허용된 `aria-disabled` 여야 한다.
   */
  it('⭐ 잠긴 사실이 접근성 트리에 드러난다', () => {
    const { board } = setup({ readOnly: true });

    expect(board).toHaveAttribute('aria-disabled', 'true');
    expect(board).not.toHaveAttribute('aria-readonly');
  });

  it('⛔ 잠긴 동안에는 눌러도 점이 생기지 않고 끌어도 옮겨지지 않는다', () => {
    const { board, pin, onPlace, onMove } = setup({ readOnly: true });
    const marker = pin();

    fireEvent.click(board, { clientX: 50, clientY: 25 });
    fireEvent.keyDown(marker, { key: 'ArrowRight' });
    press(marker, 20, 20);
    moveTo(marker, 40, 50);
    release(marker, 40, 50);

    expect(onPlace).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('⭐ 잠겨도 고르기는 된다 — 읽기 전용이지 못 보는 것이 아니다', () => {
    const { pin, onSelect } = setup({ readOnly: true });

    fireEvent.click(pin());

    expect(onSelect).toHaveBeenCalledWith('7');
  });

  it('잠기지 않은 판에는 `aria-disabled` 가 붙지 않는다', () => {
    const { board } = setup();

    expect(board).not.toHaveAttribute('aria-disabled');
  });
});

describe('MarkerOverlay — 듣는 사람에게 보이는 판', () => {
  it('⭐ 판은 이름을 가진 묶음이다 — `application` 이 아니다', () => {
    const { board } = setup();

    expect(board).toHaveAttribute('role', 'group');
    expect(screen.queryByRole('application')).toBeNull();
  });

  /*
   * ⛔ **부품은 사람의 말을 갖지 않는다.** `packages/ui` 는 표현 전용이라 한국어를 박아 두면
   * 베트남어 화면이 한국어를 듣는다. 기본값은 언어 중립인 숫자이고, 말은 밖에서 온다.
   */
  it('⭐ 표식의 이름은 보이는 말과 같고, 자리는 설명으로 딸린다 — 기본값은 숫자뿐이다', () => {
    const { pin, live } = setup();

    expect(pin()).toHaveAccessibleName('A-01');
    expect(pin()).toHaveAccessibleDescription('10% / 20%');

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });

    expect(live).toHaveTextContent('A-01: 11% / 20%');
  });

  it('⭐ 문구는 밖에서 받는다 — 판이 한 나라 말을 품지 않는다', () => {
    const { pin, live } = setup({
      describePosition: (xPercent, yPercent) =>
        `Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
      describeMove: (label, xPercent, yPercent) =>
        `${label}: Ngang ${String(xPercent)}%, dọc ${String(yPercent)}%`,
    });

    expect(pin()).toHaveAccessibleDescription('Ngang 10%, dọc 20%');

    fireEvent.keyDown(pin(), { key: 'ArrowRight' });

    expect(live).toHaveTextContent('A-01: Ngang 11%, dọc 20%');
  });

  it('⭐ 드래그는 **끝에서 한 번만** 읽는다 — 이동마다 읽으면 낭독기가 폭주한다', () => {
    const { pin, live } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 24, 20);
    moveTo(marker, 40, 50);

    /* 끄는 동안에는 말이 없다. */
    expect(live.textContent).toBe('');

    release(marker, 40, 50);

    expect(live).toHaveTextContent('A-01: 20% / 50%');
  });

  it('⛔ 임계값 안에서 끝난 누름은 아무 말도 하지 않는다', () => {
    const { pin, live } = setup();
    const marker = pin();

    press(marker, 20, 20);
    moveTo(marker, 22, 20);
    release(marker, 22, 20);

    expect(live.textContent).toBe('');
  });
});

describe('MarkerOverlay — 그림이 없을 때', () => {
  it('⭐ 안내와 표식이 «함께» 선다 — 도면을 받는 동안 편집 중인 점이 사라지면 안 된다', () => {
    const { pin } = setup({ src: undefined, placeholder: '도면을 올려 주세요.' });

    expect(screen.getByText('도면을 올려 주세요.')).toBeInTheDocument();
    expect(pin()).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('그림이 없어도 빈 자리를 눌러 점을 놓을 수 있다', () => {
    const { board, onPlace } = setup({ src: undefined, placeholder: '도면을 올려 주세요.' });

    fireEvent.click(board, { clientX: 100, clientY: 50 });

    expect(onPlace).toHaveBeenCalledWith(0.5, 0.5);
  });
});
